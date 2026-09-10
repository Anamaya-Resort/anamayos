import Link from 'next/link';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/i18n';
import { getSessionLocale, getSession } from '@/lib/session';
import { canManageVisuals } from '@/modules/video/auth';
import { defaultOrgConfig } from '@/config/app';
import { MediaLibraryGrid } from '@/modules/video/ui/MediaLibraryGrid';
import { Clapperboard, ScanLine, ShieldCheck } from 'lucide-react';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Video Maker — AO Platform' };

export default async function VideoMakerPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const enabled = defaultOrgConfig.features.video_maker === true;

  if (!enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title={dict.video.title} description={dict.video.subtitle} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-muted-foreground" />
              {dict.video.featureDisabled}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{dict.video.featureDisabledHint}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = await getSession();
  if (!session || !canManageVisuals(session)) {
    const who = session?.user?.email ?? 'not signed in';
    return (
      <div className="space-y-6">
        <PageHeader title={dict.video.title} description={dict.video.subtitle} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-muted-foreground" />
              {dict.video.adminRequired}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {dict.video.adminRequiredHint} ({who})
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader title={dict.video.title} description={dict.video.subtitle} />
      <div className="flex justify-end gap-2">
        <Link href="/dashboard/video/review">
          <Button variant="outline" size="sm">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {dict.video.review.openCta}
          </Button>
        </Link>
        <Link href="/dashboard/video/scan">
          <Button variant="outline" size="sm">
            <ScanLine className="mr-2 h-4 w-4" />
            {dict.video.scan.watchCta}
          </Button>
        </Link>
      </div>
      <MediaLibraryGrid dict={dict} />
    </div>
  );
}
