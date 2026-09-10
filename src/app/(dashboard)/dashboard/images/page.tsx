import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDictionary } from '@/i18n';
import { getSessionLocale, getSession } from '@/lib/session';
import { canUseVisuals } from '@/modules/video/auth';
import { MediaLibraryGrid } from '@/modules/video/ui/MediaLibraryGrid';
import { CollapsiblePanel } from '@/components/shared';
import { getActiveOrgId } from '@/lib/get-active-org';
import { listConnections } from '@/modules/video/drive/connections';
import { listSources, sourceProgress } from '@/modules/video/sources/queries';
import { countAssetsBySource } from '@/modules/video/library/queries';
import { ConnectionsList } from '@/modules/video/ui/ConnectionsList';
import { SourcesPanel } from '@/modules/video/ui/SourcesPanel';
import { Images } from 'lucide-react';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Image Collection — AO Platform' };

/**
 * The media library on its own page.
 *
 * Same grid as the one inside Video Maker, deliberately the same
 * component rather than a copy: browsing the photo collection is a job
 * in its own right and should not require walking past Drive
 * connections and scan controls to reach it. Open to visuals_creative
 * as well, since looking at pictures needs no admin rights.
 */
export default async function ImageCollectionPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const session = await getSession();

  if (!session || !canUseVisuals(session)) {
    return (
      <div className="space-y-6">
        <PageHeader title={dict.nav.imageCollection} />
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
  const [connections, sources, counts, progress] = orgId
    ? await Promise.all([
        listConnections(orgId),
        listSources(orgId),
        countAssetsBySource(orgId),
        sourceProgress(orgId),
      ])
    : [[], [], {}, {}];

  return (
    <div className="space-y-4">
      <PageHeader
        title={dict.nav.imageCollection}
        description={dict.video.library.collectionSubtitle}
      />
      <MediaLibraryGrid dict={dict} showGalleriesLink />

      {/* Where the pictures come from. Needed rarely, so closed by
          default and parked below the collection it fills. */}
      <div className="space-y-2 pt-2">
        <CollapsiblePanel
          title={dict.video.connections.title}
          subtitle={dict.video.connections.panelHint.replace(
            '{n}',
            String(connections.length),
          )}
        >
          <ConnectionsList connections={connections} dict={dict} locale={locale} />
        </CollapsiblePanel>
        <CollapsiblePanel
          title={dict.video.sources.title}
          subtitle={dict.video.sources.panelHint.replace('{n}', String(sources.length))}
        >
          <SourcesPanel
            sources={sources}
            counts={counts}
            progress={progress}
            dict={dict}
            locale={locale}
          />
        </CollapsiblePanel>
      </div>
    </div>
  );
}
