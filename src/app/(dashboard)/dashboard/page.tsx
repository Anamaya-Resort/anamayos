import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared';
import { ActiveRetreatCard } from '@/components/shared/active-retreat-card';
import type { ActiveRetreatData } from '@/components/shared/active-retreat-card';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { decodeHtml } from '@/lib/decode-html';
import { formatDate } from '@/lib/format-date';
import Link from 'next/link';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Dashboard — AO Platform' };

export default async function DashboardPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const showNextWeek = dayOfWeek !== 6; // Don't show next week on Saturday

  // Calculate upcoming range: tomorrow through 10 days from now
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tenDaysOut = new Date();
  tenDaysOut.setDate(tenDaysOut.getDate() + 10);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tenDaysStr = tenDaysOut.toISOString().split('T')[0];

  const [
    { count: totalBookings },
    { count: activeGuests },
    { count: pendingInquiries },
    { count: totalPeople },
    { data: recentBookingsRaw },
    { data: recentTransactionsRaw },
    { data: activeRetreatsRaw },
    { data: nextWeekRetreatsRaw },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .lte('check_in', today).gte('check_out', today).neq('status', 'cancelled'),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .eq('status', 'inquiry'),
    supabase.from('persons').select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('bookings')
      .select('id, reference_code, status, check_in, check_out, total_amount, currency, created_at, persons(full_name, email), rooms(name), retreats(name)')
      .order('created_at', { ascending: false }).limit(8),
    supabase.from('transactions')
      .select('id, trans_date, description, class, category, charge_amount, credit_amount, currency, persons(full_name)')
      .order('trans_date', { ascending: false }).limit(8),
    supabase.from('retreats')
      .select('id, name, start_date, end_date, status, max_capacity, available_spaces, categories, images, feature_image_url, persons!retreats_leader_person_id_fkey(full_name)')
      .eq('status', 'confirmed').lte('start_date', today).gte('end_date', today),
    showNextWeek ? supabase.from('retreats')
      .select('id, name, start_date, end_date, status, max_capacity, available_spaces, categories, images, feature_image_url, persons!retreats_leader_person_id_fkey(full_name)')
      .eq('status', 'confirmed').gte('start_date', tomorrowStr).lte('start_date', tenDaysStr)
      : { data: [] },
  ]);

  const recentBookings = (recentBookingsRaw ?? []) as Array<Record<string, unknown>>;
  const recentTransactions = (recentTransactionsRaw ?? []) as Array<Record<string, unknown>>;
  const activeRetreats: ActiveRetreatData[] = ((activeRetreatsRaw ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string, name: r.name as string, start_date: r.start_date as string,
    end_date: r.end_date as string, status: r.status as string,
    max_capacity: r.max_capacity as number | null, available_spaces: r.available_spaces as number | null,
    categories: (r.categories as string[]) ?? [], images: r.images,
    feature_image_url: r.feature_image_url as string | null,
    leader_name: (r.persons as Record<string, unknown>)?.full_name as string | null,
  }));
  const nextWeekRetreats: ActiveRetreatData[] = ((nextWeekRetreatsRaw ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string, name: r.name as string, start_date: r.start_date as string,
    end_date: r.end_date as string, status: r.status as string,
    max_capacity: r.max_capacity as number | null, available_spaces: r.available_spaces as number | null,
    categories: (r.categories as string[]) ?? [], images: r.images,
    feature_image_url: r.feature_image_url as string | null,
    leader_name: (r.persons as Record<string, unknown>)?.full_name as string | null,
  }));

  // Separate check-ins and check-outs on Saturday
  const checkingOut = isSaturday ? activeRetreats.filter((r) => r.end_date === today) : [];
  const checkingIn = isSaturday ? activeRetreats.filter((r) => r.start_date === today) : [];
  const currentRetreats = isSaturday
    ? activeRetreats.filter((r) => r.start_date !== today && r.end_date !== today)
    : activeRetreats;

  const stats = [
    { key: 'totalBookings', value: String(totalBookings ?? 0) },
    { key: 'activeGuests', value: String(activeGuests ?? 0) },
    { key: 'pendingInquiries', value: String(pendingInquiries ?? 0) },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={dict.dashboard.title} />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard[stat.key]}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stat.value}</p></CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.nav.people}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalPeople ?? 0}</p></CardContent>
        </Card>
      </div>

      {/* Two-column: Recent Bookings + Recent Transactions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bookings — compact two-row format */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{dict.dashboard.recentBookings}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{dict.bookings.noBookings}</p>
            ) : (
              <div className="space-y-2">
                {recentBookings.map((b) => {
                  const person = b.persons as Record<string, unknown> | null;
                  const room = b.rooms as Record<string, unknown> | null;
                  const retreat = b.retreats as Record<string, unknown> | null;
                  return (
                    <Link key={b.id as string} href={`/dashboard/bookings/${b.id}`}
                      className="block rounded border px-3 py-2 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{(person?.full_name as string) ?? (person?.email as string) ?? '—'}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{b.status as string}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">
                          {retreat ? decodeHtml(retreat.name as string) : (room?.name as string) ?? '—'}
                        </span>
                        <span className="shrink-0">{formatDate(b.check_in as string)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions — compact two-row format */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((t) => {
                  const person = t.persons as Record<string, unknown> | null;
                  const charge = Number(t.charge_amount) || 0;
                  const credit = Number(t.credit_amount) || 0;
                  const amount = credit > 0 ? credit : charge;
                  const isPayment = credit > 0;
                  return (
                    <div key={t.id as string} className="rounded border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{(t.description as string) ?? (t.category as string) ?? '—'}</span>
                        <span className={`text-sm font-mono font-medium shrink-0 ${isPayment ? 'text-status-success' : ''}`}>
                          {isPayment ? '+' : ''}${amount.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{(person?.full_name as string) ?? '—'}</span>
                        <span className="shrink-0">{formatDate(t.trans_date as string)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Retreats — full width */}
      {(activeRetreats.length > 0 || (showNextWeek && nextWeekRetreats.length > 0)) && (
        <div className="space-y-4">
          {/* Checking out today (Saturday only) */}
          {checkingOut.length > 0 && (
            <div className="space-y-2">
              {checkingOut.map((r) => (
                <Link key={r.id} href={`/dashboard/retreats/${r.id}`}>
                  <ActiveRetreatCard retreat={r} label="CHECKING OUT TODAY" labelColor="var(--retreat-upcoming-soon)" />
                </Link>
              ))}
            </div>
          )}

          {/* Checking in today (Saturday only) */}
          {checkingIn.length > 0 && (
            <div className="space-y-2">
              {checkingIn.map((r) => (
                <Link key={r.id} href={`/dashboard/retreats/${r.id}`}>
                  <ActiveRetreatCard retreat={r} label="CHECK IN TODAY" labelColor="var(--retreat-upcoming-far)" />
                </Link>
              ))}
            </div>
          )}

          {/* Current retreats (always) */}
          {currentRetreats.length > 0 && (
            <div className="space-y-2">
              {currentRetreats.map((r) => (
                <Link key={r.id} href={`/dashboard/retreats/${r.id}`}>
                  <ActiveRetreatCard retreat={r} label="CURRENT RETREAT" />
                </Link>
              ))}
            </div>
          )}

          {/* Next week retreats (shown Sun-Fri, not Saturday) */}
          {showNextWeek && nextWeekRetreats.length > 0 && (
            <div className="space-y-2">
              {nextWeekRetreats.map((r) => (
                <Link key={r.id} href={`/dashboard/retreats/${r.id}`}>
                  <ActiveRetreatCard retreat={r} label="NEXT WEEK RETREAT" labelColor="var(--retreat-upcoming-far)" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
