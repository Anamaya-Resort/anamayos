import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { ImportPanel } from '@/modules/admin/import-panel';
import { ButtonEffectsShowcase } from '@/modules/admin/button-effects-showcase';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Settings — AO Platform' };

export default async function SettingsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <PageHeader title={dict.settings.title} />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{dict.settings.general}</TabsTrigger>
          <TabsTrigger value="organization">{dict.settings.organization}</TabsTrigger>
          <TabsTrigger value="import">{dict.settings.import}</TabsTrigger>
          <TabsTrigger value="effects">{dict.settings.buttonEffects}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.settings.general}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{dict.settings.comingSoon}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.settings.organization}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{dict.settings.comingSoon}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <ImportPanel dict={dict} />
        </TabsContent>

        <TabsContent value="effects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.settings.buttonEffects}</CardTitle>
            </CardHeader>
            <CardContent>
              <ButtonEffectsShowcase />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
