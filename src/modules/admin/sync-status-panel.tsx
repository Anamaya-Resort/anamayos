'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

type SourceReport = {
  ok: boolean;
  error?: string;
  newCount: number;
  changedCount: number;
  newItems: { id: number; name: string; start_date: string | null }[];
};

type CheckResult = { retreatGuru: SourceReport; weTravel: SourceReport };

type Phase = 'idle' | 'checking' | 'clean' | 'found' | 'updating' | 'updated' | 'error';

/**
 * Live sync banner. Checks Retreat Guru (retreats) and WeTravel
 * (payments) on mount so anyone opening the dashboard sees straight
 * away whether AO is behind, and can pull the changes in with one
 * click. Read-only until the button is pressed.
 */
export function SyncStatusPanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [message, setMessage] = useState('');
  const ranRef = useRef(false);

  const check = useCallback(async () => {
    setPhase('checking');
    setMessage('Connecting to Retreat Guru…');
    try {
      const res = await fetch('/api/admin/sync/check');
      if (!res.ok) throw new Error(res.status === 403 ? 'Not permitted' : `Check failed (${res.status})`);
      const data = (await res.json()) as CheckResult;
      setResult(data);
      const total = data.retreatGuru.newCount + data.retreatGuru.changedCount + data.weTravel.newCount;
      setPhase(total > 0 ? 'found' : 'clean');
      setMessage('');
    } catch (e) {
      setPhase('error');
      setMessage((e as Error).message);
    }
  }, []);

  // Check once when the dashboard opens.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void check();
  }, [check]);

  const apply = useCallback(async () => {
    setPhase('updating');
    setMessage('Updating…');
    try {
      const res = await fetch('/api/admin/sync/apply', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      const parts: string[] = [];
      if (data.added) parts.push(`${data.added} new retreat${data.added === 1 ? '' : 's'}`);
      if (data.updated) parts.push(`${data.updated} updated`);
      if (data.weTravelImported) parts.push(`${data.weTravelImported} WeTravel payment${data.weTravelImported === 1 ? '' : 's'}`);
      setPhase('updated');
      const errCount = (data.failures?.length ?? 0) + (data.weTravelErrors?.length ?? 0);
      setMessage(
        parts.length
          ? `Updated ${parts.join(', ')}${errCount ? ` (${errCount} errors)` : ''}`
          : 'Already up to date',
      );
      // Re-check so the banner reflects the new state.
      setTimeout(() => void check(), 1200);
    } catch (e) {
      setPhase('error');
      setMessage((e as Error).message);
    }
  }, [check]);

  const busy = phase === 'checking' || phase === 'updating';

  return (
    <Card className="max-w-[85vw] sm:max-w-md">
      <CardContent className="flex items-center gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{headline(phase, result, message)}</p>
          <p className="text-xs leading-snug text-muted-foreground">{detail(phase, result, message)}</p>
        </div>
        <Button
          size="sm"
          variant={phase === 'found' ? 'default' : 'outline'}
          onClick={phase === 'found' ? apply : check}
          disabled={busy}
          className="ml-auto gap-1.5 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          {phase === 'found' ? 'Update' : 'Check'}
        </Button>
      </CardContent>
    </Card>
  );
}

function headline(phase: Phase, r: CheckResult | null, message: string): string {
  switch (phase) {
    case 'idle':
    case 'checking': return 'Connecting to Retreat Guru…';
    case 'clean': return 'Up to date with Retreat Guru';
    case 'updating': return 'Updating…';
    case 'updated': return message;
    case 'error': return 'Could not check for updates';
    case 'found': {
      const bits: string[] = [];
      if (r?.retreatGuru.newCount) bits.push(`Found ${r.retreatGuru.newCount} new retreat${r.retreatGuru.newCount === 1 ? '' : 's'}`);
      if (r?.retreatGuru.changedCount) bits.push(`${r.retreatGuru.changedCount} changed`);
      if (!bits.length && r?.weTravel.newCount) bits.push(`${r.weTravel.newCount} new WeTravel payment${r.weTravel.newCount === 1 ? '' : 's'}`);
      return bits.join(', ');
    }
  }
}

function detail(phase: Phase, r: CheckResult | null, message: string): string {
  if (phase === 'error') return message;
  if (phase === 'checking' || phase === 'idle') return 'Checking Retreat Guru and WeTravel for changes';
  if (!r) return '';

  const notes: string[] = [];
  if (!r.retreatGuru.ok) notes.push('Retreat Guru unreachable');
  if (!r.weTravel.ok) notes.push('WeTravel unreachable');

  // Name the soonest new retreat — more useful than a bare count.
  if (phase === 'found' && r.retreatGuru.newItems.length) {
    const first = r.retreatGuru.newItems[0];
    const more = r.retreatGuru.newItems.length - 1;
    notes.unshift(`${first.name}${first.start_date ? ` · ${first.start_date}` : ''}${more > 0 ? ` and ${more} more` : ''}`);
  }
  if (phase === 'found' && r.weTravel.newCount && r.retreatGuru.newCount) {
    notes.push(`${r.weTravel.newCount} new WeTravel payment${r.weTravel.newCount === 1 ? '' : 's'} (import from Settings)`);
  }
  if (phase === 'clean') notes.unshift('Retreats and payments both match');
  return notes.join(' · ');
}
