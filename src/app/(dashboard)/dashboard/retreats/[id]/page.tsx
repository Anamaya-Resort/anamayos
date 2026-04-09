import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared';
import Link from 'next/link';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Retreat Detail — AO Platform' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RetreatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: retreat } = await supabase
    .from('retreats')
    .select('*, persons!retreats_leader_person_id_fkey(full_name, email)')
    .eq('id', id)
    .single();

  if (!retreat) notFound();
  const r = retreat as Record<string, unknown>;
  const leader = r.persons as Record<string, unknown> | null;

  // Get bookings for this retreat
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, reference_code, check_in, check_out, status, num_guests, total_amount, persons(full_name)')
    .eq('retreat_id', id)
    .order('check_in');

  // Get room blocks
  const { data: blocks } = await supabase
    .from('retreat_room_blocks')
    .select('id, name, start_date, end_date, block_type, retreat_room_block_rooms(room_id, rooms(name))')
    .eq('retreat_id', id);

  const statusLabel = dict.retreats[`status_${r.status}` as keyof typeof dict.retreats] as string ?? r.status;

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.name as string}
        description={`${r.start_date ?? ''} — ${r.end_date ?? ''}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{dict.retreats.title}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={dict.retreats.status} value={statusLabel as string} />
            <Row label={dict.retreats.leader} value={(leader?.full_name as string) ?? '—'} />
            <Row label={dict.retreats.capacity} value={r.max_capacity != null ? `${r.available_spaces ?? '?'}/${r.max_capacity}` : '—'} />
            <Row label={dict.retreats.pricing} value={`${r.pricing_type} (${r.deposit_percentage}% deposit)`} />
            <Row label="Currency" value={r.currency as string} />
            {(r.categories as string[])?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(r.categories as string[]).map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{dict.retreats.roomBlocks} ({(blocks ?? []).length})</CardTitle></CardHeader>
          <CardContent>
            {(blocks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{dict.common.noResults}</p>
            ) : (
              <ul className="space-y-3">
                {(blocks ?? []).map((bl: Record<string, unknown>) => {
                  const roomLinks = (bl.retreat_room_block_rooms as Array<Record<string, unknown>>) ?? [];
                  const roomNames = roomLinks.map((rl) => (rl.rooms as Record<string, unknown>)?.name as string).filter(Boolean);
                  return (
                    <li key={bl.id as string} className="text-sm">
                      <p className="font-medium">{bl.name as string}</p>
                      <p className="text-muted-foreground text-xs">{bl.start_date as string} — {bl.end_date as string}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {roomNames.map((rn) => (
                          <Badge key={rn} variant="outline" className="text-xs">{rn}</Badge>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bookings for this retreat */}
      <Card>
        <CardHeader><CardTitle>{dict.bookings.title} ({(bookings ?? []).length})</CardTitle></CardHeader>
        <CardContent>
          {(bookings ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.bookings.noBookings}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">{dict.bookings.reference}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.bookings.guest}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.bookings.checkIn}</th>
                    <th className="pb-3 pr-4 font-medium">{dict.bookings.status}</th>
                    <th className="pb-3 font-medium text-right">{dict.bookings.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookings ?? []).map((b: Record<string, unknown>) => {
                    const guest = b.persons as Record<string, unknown> | null;
                    return (
                      <tr key={b.id as string} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4">
                          <Link href={`/dashboard/bookings/${b.id}`} className="font-mono text-primary hover:underline text-xs">
                            {b.reference_code as string}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">{(guest?.full_name as string) ?? '—'}</td>
                        <td className="py-3 pr-4">{b.check_in as string}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs">
                            {dict.bookings[`status_${b.status}` as keyof typeof dict.bookings] as string ?? b.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-mono">${Number(b.total_amount).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
