import Link from 'next/link';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/i18n';
import { getSessionLocale, getSession } from '@/lib/session';
import { canManageVisuals } from '@/modules/video/auth';
import { ScanTheater } from '@/modules/video/ui/ScanTheater';
import { ArrowLeft, Clapperboard } from 'lucide-react';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Scan Theater — AO Platform' };

export default async function ScanTheaterPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const session = await getSession();

  if (!session || !canManageVisuals(session)) {
    return (
      <div className="space-y-6">
        <PageHeader title={dict.video.scan.title} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-muted-foreground" />
              {dict.video.adminRequired}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {dict.video.adminRequiredHint} ({session?.user?.email ?? 'not signed in'})
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title={dict.video.scan.title} description={dict.video.scan.subtitle} />
        <Link href="/dashboard/video">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {dict.video.scan.back}
          </Button>
        </Link>
      </div>
      <ScanTheater dict={dict} />
    </div>
  );
}
