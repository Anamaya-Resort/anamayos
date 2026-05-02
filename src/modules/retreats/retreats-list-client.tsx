'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/shared';
import { RetreatCard } from '@/components/shared/retreat-card';
import { ActiveRetreatCard } from '@/components/shared/active-retreat-card';
import type { ActiveRetreatData } from '@/components/shared/active-retreat-card';
import { decodeHtml } from '@/lib/decode-html';
import { formatDateRange } from '@/lib/format-date';
import { Plus, ChevronDown, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';

interface Props {
  retreats: Array<Record<string, unknown>>;
  dict: TranslationKeys;
  locale: Locale;
}

export function RetreatsListClient({ retreats, dict, locale }: Props) {
  const router = useRouter();
  const [showTrash, setShowTrash] = useState(false);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const now = new Date().toISOString().split('T')[0];

  // Split retreats by category
  const active = retreats.filter((r) =>
    r.status === 'confirmed' && r.start_date && r.end_date &&
    (r.start_date as string) <= now && (r.end_date as string) >= now
  );
  const regular = retreats.filter((r) => (r.status as string) !== 'deleted' && !active.includes(r));
  const deleted = retreats.filter((r) => (r.status as string) === 'deleted');

  // For active retreats, determine check-in/check-out status
  // Saturday is check-in/check-out day
  const today = new Date();
  const isSaturday = today.getDay() === 6;

  const statusColors: Record<string, string> = {
    confirmed: 'text-status-success',
    draft: 'text-status-info',
    cancelled: 'text-status-destructive',
    completed: 'text-muted-foreground',
    deleted: 'text-destructive',
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteId) return;
    setDeleting(true);
    await fetch(`/api/admin/retreats/${permanentDeleteId}?permanent=true`, { method: 'DELETE' });
    setDeleting(false);
    setPermanentDeleteId(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.retreats.title}
        description={`${regular.length + active.length} retreats`}
        actions={
          <Link href="/dashboard/retreats/new"
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> New Retreat
          </Link>
        }
      />

      {/* Active retreats — full-width panels */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Currently Running ({active.length})
            {isSaturday && <span className="ml-2 text-primary">Check-in / Check-out Day</span>}
          </h3>
          {active.map((r) => {
            const leader = r.persons as Record<string, unknown> | null;
            const isCheckInDay = isSaturday && (r.start_date as string) === now;
            const isCheckOutDay = isSaturday && (r.end_date as string) === now;
            const label = isCheckOutDay ? 'CHECKING OUT TODAY' : isCheckInDay ? 'CHECK IN TODAY' : 'CURRENT RETREAT';
            const labelColor = isCheckOutDay ? 'var(--retreat-upcoming-soon)' : isCheckInDay ? 'var(--retreat-upcoming-far)' : undefined;

            const retreatData: ActiveRetreatData = {
              id: r.id as string, name: r.name as string,
              start_date: r.start_date as string | null, end_date: r.end_date as string | null,
              status: r.status as string, max_capacity: r.max_capacity as number | null,
              available_spaces: r.available_spaces as number | null,
              categories: (r.categories as string[]) ?? [], images: r.images,
              feature_image_url: r.feature_image_url as string | null,
              leader_name: (leader?.full_name as string) ?? null,
            };

            return (
              <ActiveRetreatCard key={r.id as string} retreat={retreatData}
                label={label} labelColor={labelColor} locale={locale}
                onClick={() => router.push(`/dashboard/retreats/${r.id}`)} />
            );
          })}
        </div>
      )}

      {/* Regular retreats table */}
      {regular.length === 0 && active.length === 0 ? (
        <EmptyState title={dict.retreats.noRetreats} description={dict.retreats.noRetreatsDesc} />
      ) : regular.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">{dict.retreats.name}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.retreats.dates}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.retreats.leader}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.retreats.status}</th>
                    <th className="pb-3 font-medium">{dict.retreats.capacity}</th>
                  </tr>
                </thead>
                <tbody>
                  {regular.map((r) => {
                    const leader = r.persons as Record<string, unknown> | null;
                    const status = r.status as string;
                    const statusLabel = dict.retreats[`status_${status}` as keyof typeof dict.retreats] as string ?? status;

                    return (
                      <tr key={r.id as string}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/dashboard/retreats/${r.id}`)}>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-primary">{decodeHtml(r.name as string)}</span>
                          {(r.categories as string[])?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(r.categories as string[]).slice(0, 3).map((cat) => (
                                <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatDateRange(r.start_date as string | null, r.end_date as string | null, locale)}
                        </td>
                        <td className="py-3 pr-4">{(leader?.full_name as string) ?? '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={statusColors[status] ?? ''}>{statusLabel}</span>
                        </td>
                        <td className="py-3">
                          {r.max_capacity != null
                            ? `${r.available_spaces ?? '?'}/${r.max_capacity}`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trash bin — at the very bottom */}
      {deleted.length > 0 && (
        <div className="pt-6 border-t">
          <button onClick={() => setShowTrash(!showTrash)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5" />
            Trash ({deleted.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTrash ? 'rotate-180' : ''}`} />
          </button>
          {showTrash && (
            <div className="mt-3 space-y-2">
              {deleted.map((r) => (
                <div key={r.id as string} className="flex items-center justify-between rounded border border-dashed border-destructive/30 px-4 py-2.5 bg-destructive/5">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground line-through">{decodeHtml(r.name as string)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.start_date ? formatDateRange(r.start_date as string, r.end_date as string | null, locale) : 'No dates'}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" className="text-xs h-7"
                    onClick={() => setPermanentDeleteId(r.id as string)}>
                    Permanently Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permanent delete confirmation */}
      <Dialog open={!!permanentDeleteId} onOpenChange={(open) => { if (!open) setPermanentDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Permanently Delete Retreat</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this retreat and all its associated data. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermanentDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
