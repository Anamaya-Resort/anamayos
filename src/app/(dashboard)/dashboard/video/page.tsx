import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { defaultOrgConfig } from '@/config/app';
import { Clapperboard, CircleDashed } from 'lucide-react';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Video Maker — AO Platform' };

export default async function VideoMakerPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const enabled = defaultOrgConfig.features.video_maker === true;

  return (
    <div className="space-y-6">
      <PageHeader title={dict.video.title} description={dict.video.subtitle} />

      {!enabled ? (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDashed className="h-5 w-5 text-brand-highlight animate-pulse" />
              {dict.video.comingSoon}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{dict.video.nextSlice}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
