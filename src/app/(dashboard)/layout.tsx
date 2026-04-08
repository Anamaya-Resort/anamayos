import { AuthProvider } from '@/modules/auth';
import { AppShell } from '@/components/layout';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);

  return (
    <AuthProvider>
      <AppShell dict={dict}>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
