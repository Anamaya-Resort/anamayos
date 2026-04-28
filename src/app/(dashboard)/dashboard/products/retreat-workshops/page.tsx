import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';

export const metadata = { title: 'Retreat Workshops — AO Platform' };

const decodeHtml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default async function RetreatWorkshopsPage() {
  const supabase = createServiceClient();

  const { data: workshops } = await supabase
    .from('retreat_workshops')
    .select(`
      id, name, description, price, currency,
      sales_commission_pct, anamaya_pct, retreat_leader_pct,
      payout_person_id, sort_order, is_active,
      retreat:retreat_id ( id, name, start_date, end_date ),
      payout:payout_person_id ( id, full_name )
    `)
    .order('retreat_id')
    .order('sort_order');

  const items = (workshops ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retreat Workshops"
        description={`${items.length} workshop${items.length === 1 ? '' : 's'} across all retreats`}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No retreat workshops yet"
          description="Workshops appear here once retreats are imported or created with optional add-on workshops."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">Workshop</th>
                    <th className="pb-3 pr-4 font-medium">Retreat</th>
                    <th className="pb-3 pr-4 font-medium">Instructor / Payee</th>
                    <th className="pb-3 pr-4 font-medium text-right">Price</th>
                    <th className="pb-3 pr-4 font-medium text-right">Split (Sales / House / Leader)</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => {
                    const retreat = w.retreat as Record<string, unknown> | null;
                    const payout = w.payout as Record<string, unknown> | null;
                    const price = w.price != null ? Number(w.price) : null;
                    const currency = (w.currency as string) ?? 'USD';
                    const desc = stripHtml(w.description as string | null);
                    const descSnippet = desc.length > 100 ? desc.slice(0, 100).trim() + '…' : desc;

                    return (
                      <tr key={w.id as string} className="border-b last:border-0 hover:bg-muted/50 align-top">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{w.name as string}</div>
                          {descSnippet && (
                            <div className="text-xs text-muted-foreground mt-0.5 max-w-md">{descSnippet}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {retreat ? (
                            <Link
                              href={`/dashboard/retreats/${retreat.id as string}`}
                              className="text-primary hover:underline"
                            >
                              {decodeHtml(retreat.name as string)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {payout ? (
                            <span>{(payout.full_name as string) ?? '—'}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-mono text-right">
                          {price != null ? `${currency === 'USD' ? '$' : ''}${price.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right text-muted-foreground">
                          {Number(w.sales_commission_pct ?? 0).toFixed(0)}% / {Number(w.anamaya_pct).toFixed(0)}% / {Number(w.retreat_leader_pct).toFixed(0)}%
                        </td>
                        <td className="py-3">
                          <Badge variant={w.is_active ? 'outline' : 'secondary'} className="text-xs">
                            {w.is_active ? 'Active' : 'Inactive'}
                          </Badge>
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
