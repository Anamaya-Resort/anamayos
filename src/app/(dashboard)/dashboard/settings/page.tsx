import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';

export const metadata = { title: 'Settings — AO Platform' };

export default function SettingsPage() {
  const dict = getDictionary('en');

  return (
    <div className="space-y-6">
      <PageHeader title={dict.settings.title} />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{dict.settings.general}</TabsTrigger>
          <TabsTrigger value="organization">{dict.settings.organization}</TabsTrigger>
          <TabsTrigger value="users">{dict.settings.users}</TabsTrigger>
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

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.settings.users}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{dict.settings.comingSoon}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
