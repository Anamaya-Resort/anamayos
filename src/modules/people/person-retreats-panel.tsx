'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RetreatCard } from '@/components/shared/retreat-card';
import type { RetreatCardData } from '@/components/shared/retreat-card';
import { Plus, ChevronDown, Copy } from 'lucide-react';

interface Props {
  retreats: RetreatCardData[];
  personId: string;
}

export function PersonRetreatsPanel({ retreats, personId }: Props) {
  const router = useRouter();
  const [showPast, setShowPast] = useState(false);
  const now = new Date().toISOString().split('T')[0];

  const active = retreats.filter((r) =>
    r.status === 'confirmed' && r.start_date && r.end_date && r.start_date <= now && r.end_date >= now
  );
  const upcoming = retreats.filter((r) =>
    r.status === 'confirmed' && r.start_date && r.start_date > now
  );
  const development = retreats.filter((r) => r.status === 'draft');
  const past = retreats.filter((r) =>
    r.status === 'completed' || (r.status === 'confirmed' && r.end_date && r.end_date < now)
  );
  const cancelled = retreats.filter((r) => r.status === 'cancelled');

  const handleDuplicate = async (retreatId: string) => {
    const res = await fetch('/api/admin/retreats/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retreat_id: retreatId }),
    });
    const data = await res.json();
    if (data.retreat?.id) {
      router.push(`/dashboard/retreats/${data.retreat.id}/edit`);
    }
  };

  const renderGroup = (title: string, items: RetreatCardData[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title} ({items.length})</h4>
        <div className="grid grid-cols-1 gap-2">
          {items.map((r) => (
            <RetreatCard key={r.id} retreat={r} variant="compact" statusBorder
              onClick={() => router.push(`/dashboard/retreats/${r.id}/edit`)}
              actions={
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(r.id); }}>
                  <Copy className="h-3 w-3" /> Duplicate
                </Button>
              }
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] text-foreground/70">Retreats</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
            onClick={() => router.push('/dashboard/retreats/new')}>
            <Plus className="h-3 w-3" /> New Retreat
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {retreats.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">No retreats yet.</p>
        ) : (
          <>
            {renderGroup('Active', active)}
            {renderGroup('Upcoming', upcoming)}
            {renderGroup('Under Development', development)}
            {cancelled.length > 0 && renderGroup('Cancelled', cancelled)}
            {past.length > 0 && (
              <div>
                <button onClick={() => setShowPast(!showPast)}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  Past ({past.length})
                  <ChevronDown className={`h-3 w-3 transition-transform ${showPast ? 'rotate-180' : ''}`} />
                </button>
                {showPast && (
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {past.map((r) => (
                      <RetreatCard key={r.id} retreat={r} variant="mini" statusBorder
                        onClick={() => router.push(`/dashboard/retreats/${r.id}`)}
                        actions={
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(r.id); }}>
                            <Copy className="h-3 w-3" /> Duplicate
                          </Button>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
