import Link from 'next/link';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/i18n';
import { getSessionLocale, getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canUseVisuals } from '@/modules/video/auth';
import { listGalleries } from '@/modules/video/galleries/queries';
import { GalleryList } from '@/modules/video/ui/GalleryList';
import { Images, ArrowLeft } from 'lucide-react';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Galleries — AO Platform' };

/**
 * The galleries index.
 *
 * A gallery's code is the thing an editor actually needs from this
 * page - it goes into a gallery block on a page or template - so the
 * code is shown plainly and is one click to copy.
 */
export default async function GalleriesPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const session = await getSession();

  if (!session || !canUseVisuals(session)) {
    return (
      <div className="space-y-6">
        <PageHeader title={dict.nav.galleries} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Images className="h-5 w-5 text-muted-foreground" />
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

  const orgId = await getActiveOrgId();
  const galleries = orgId ? await listGalleries(orgId) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={dict.nav.galleries}
          description={dict.video.galleries.pageSubtitle}
        />
        <Link href="/dashboard/images">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {dict.video.galleries.backToImages}
          </Button>
        </Link>
      </div>
      <GalleryList galleries={galleries} dict={dict} />
    </div>
  );
}
