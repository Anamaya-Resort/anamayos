import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import Link from 'next/link';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Retreats — AO Platform' };

export default async function RetreatsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: retreats } = await supabase
    .from('retreats')
    .select('*, persons!retreats_leader_person_id_fkey(full_name)')
    .order('start_date', { ascending: false })
    .limit(200);

  const items = (retreats ?? []) as Array<Record<string, unknown>>;

  const statusColors: Record<string, string> = {
    confirmed: 'text-status-success',
    draft: 'text-status-info',
    cancelled: 'text-status-destructive',
    completed: 'text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.retreats.title}
        description={`${items.length} ${dict.retreats.title.toLowerCase()}`}
        actions={
          <Link href="/dashboard/retreats/new"
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            + New Retreat
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState title={dict.retreats.noRetreats} description={dict.retreats.noRetreatsDesc} />
      ) : (
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
                  {items.map((r) => {
                    const leader = r.persons as Record<string, unknown> | null;
                    const status = r.status as string;
                    const statusLabel = dict.retreats[`status_${status}` as keyof typeof dict.retreats] as string ?? status;

                    return (
                      <tr key={r.id as string} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4">
                          <Link
                            href={`/dashboard/retreats/${r.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {r.name as string}
                          </Link>
                          {(r.categories as string[])?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(r.categories as string[]).slice(0, 3).map((cat) => (
                                <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {r.start_date && r.end_date
                            ? `${r.start_date as string} — ${r.end_date as string}`
                            : (r.start_date as string) ?? '—'}
                        </td>
                        <td className="py-3 pr-4">
                          {(leader?.full_name as string) ?? '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={statusColors[status] ?? ''}>
                            {statusLabel}
                          </span>
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
    </div>
  );
}
