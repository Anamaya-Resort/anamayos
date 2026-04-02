import { AuthProvider } from '@/modules/auth';
import { AppShell } from '@/components/layout';
import { getDictionary } from '@/i18n';
import { defaultOrgConfig } from '@/config/app';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dict = getDictionary('en');

  return (
    <AuthProvider>
      <AppShell dict={dict} orgName={defaultOrgConfig.name}>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
