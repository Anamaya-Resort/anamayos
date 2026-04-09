import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Dashboard — AO Platform' };

export default async function DashboardPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const today = new Date().toISOString().split('T')[0];

  // Fetch real stats
  const [
    { count: totalBookings },
    { count: activeGuests },
    { count: pendingInquiries },
    { count: totalPeople },
    { data: recentBookings },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .lte('check_in', today).gte('check_out', today).neq('status', 'cancelled'),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .eq('status', 'inquiry'),
    supabase.from('persons').select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('bookings')
      .select('id, reference_code, check_in, check_out, status, total_amount, persons(full_name)')
      .order('created_at', { ascending: false })
      .limit(8),
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
          {!recentBookings || recentBookings.length === 0 ? (
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
                  {recentBookings.map((b: Record<string, unknown>) => {
                    const guest = b.persons as Record<string, unknown> | null;
                    const status = b.status as string;
                    return (
                      <tr key={b.id as string} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4">
                          <Link href={`/dashboard/bookings/${b.id}`} className="font-mono text-xs text-primary hover:underline">
                            {b.reference_code as string}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">{(guest?.full_name as string) ?? '—'}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{b.check_in as string}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs">
                            {dict.bookings[`status_${status}` as keyof typeof dict.bookings] as string ?? status}
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
