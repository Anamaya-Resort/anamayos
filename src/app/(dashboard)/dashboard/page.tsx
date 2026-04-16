import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getBookings, BookingTable } from '@/modules/bookings';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Dashboard — AO Platform' };

export default async function DashboardPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalBookings },
    { count: activeGuests },
    { count: pendingInquiries },
    { count: totalPeople },
    recentBookings,
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .lte('check_in', today).gte('check_out', today).neq('status', 'cancelled'),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .eq('status', 'inquiry'),
    supabase.from('persons').select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    getBookings({ limit: 12, orderBy: 'created_at' }),
  ]);

  const stats = [
    { key: 'totalBookings', value: String(totalBookings ?? 0) },
    { key: 'activeGuests', value: String(activeGuests ?? 0) },
    { key: 'pendingInquiries', value: String(pendingInquiries ?? 0) },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={dict.dashboard.title} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.dashboard[stat.key]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {dict.nav.people}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalPeople ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.recentBookings}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.bookings.noBookings}</p>
          ) : (
            <BookingTable bookings={recentBookings} dict={dict} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
