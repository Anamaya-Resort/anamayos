import { AuthProvider } from '@/modules/auth';
import { AppShell } from '@/components/layout';
import { getDictionary } from '@/i18n';
import { getSession } from '@/lib/session';
import { getOrgBranding, brandingToStyleTag } from '@/lib/branding';
import { BrandingTestModeProvider } from '@/lib/branding-test-mode';
import type { Locale } from '@/config/app';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const locale = (session?.locale ?? 'en') as Locale;
  const dict = getDictionary(locale);
  const { branding, hasOverrides } = await getOrgBranding();
  // Handed to the client provider so the first paint already knows the
  // access level, instead of fetching the same cookie back over HTTP.
  const auth = session && {
    user: session.user,
    personId: session.personId,
    displayName: session.displayName ?? '',
    topRole: session.topRole ?? '',
    accessLevel: session.accessLevel,
    roleSlugs: session.roleSlugs ?? [],
    locale,
  };
  const styleTag = hasOverrides ? brandingToStyleTag(branding) : '';

  return (
    <AuthProvider initial={auth ?? null}>
      {styleTag && <style dangerouslySetInnerHTML={{ __html: styleTag }} />}
      <BrandingTestModeProvider>
        <AppShell dict={dict}>
          {children}
        </AppShell>
      </BrandingTestModeProvider>
    </AuthProvider>
  );
}
