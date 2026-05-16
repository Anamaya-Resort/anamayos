import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDictionary } from '@/i18n';
import { getSessionLocale, getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { defaultOrgConfig } from '@/config/app';
import { listConnections } from '@/modules/video/drive/connections';
import { listSources } from '@/modules/video/sources/queries';
import { countAssets, countAssetsBySource, recentAssets } from '@/modules/video/library/queries';
import { ConnectionsList } from '@/modules/video/ui/ConnectionsList';
import { SourcesPanel } from '@/modules/video/ui/SourcesPanel';
import { InventoryPreview } from '@/modules/video/ui/InventoryPreview';
import { Clapperboard } from 'lucide-react';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Video Maker — AO Platform' };

export default async function VideoMakerPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; msg?: string }>;
}) {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const enabled = defaultOrgConfig.features.video_maker === true;
  const sp = await searchParams;

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

  const orgId = await getActiveOrgId();
  const [connections, sources, total, counts, recent] = orgId
    ? await Promise.all([
        listConnections(orgId),
        listSources(orgId),
        countAssets(orgId),
        countAssetsBySource(orgId),
        recentAssets(orgId),
      ])
    : [[], [], 0, {}, []];

  return (
    <div className="space-y-6">
      <PageHeader title={dict.video.title} description={dict.video.subtitle} />
      <ConnectionsList
        connections={connections}
        dict={dict}
        locale={locale}
        oauthState={sp.oauth}
        oauthMsg={sp.msg}
      />
      <SourcesPanel sources={sources} counts={counts} dict={dict} locale={locale} />
      <InventoryPreview assets={recent} total={total} dict={dict} />
    </div>
  );
}
