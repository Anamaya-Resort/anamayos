import { AuthProvider } from '@/modules/auth';
import { AppShell } from '@/components/layout';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { getOrgBranding, brandingToStyleTag } from '@/lib/branding';
import type { Locale } from '@/config/app';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const branding = await getOrgBranding();
  const styleTag = brandingToStyleTag(branding);

  return (
    <AuthProvider>
      {styleTag && <style dangerouslySetInnerHTML={{ __html: styleTag }} />}
      <AppShell dict={dict}>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
