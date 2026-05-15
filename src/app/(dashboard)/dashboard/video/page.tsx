import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { defaultOrgConfig } from '@/config/app';
import { listConnections } from '@/modules/video/drive/connections';
import { ConnectionsList } from '@/modules/video/ui/ConnectionsList';
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

  const orgId = await getActiveOrgId();
  const connections = orgId ? await listConnections(orgId) : [];

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
    </div>
  );
}
