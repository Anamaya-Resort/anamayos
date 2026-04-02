import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';

export const metadata = { title: 'Dashboard — AO Platform' };

export default function DashboardPage() {
  const dict = getDictionary('en');

  const stats = [
    { key: 'totalBookings', value: '0' },
    { key: 'activeGuests', value: '0' },
    { key: 'pendingInquiries', value: '0' },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={dict.dashboard.title} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.recentBookings}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{dict.bookings.noBookings}</p>
        </CardContent>
      </Card>
    </div>
  );
}
