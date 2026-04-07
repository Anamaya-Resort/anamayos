import { AuthProvider } from '@/modules/auth';
import { AppShell } from '@/components/layout';
import { getDictionary } from '@/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dict = getDictionary('en');

  return (
    <AuthProvider>
      <AppShell dict={dict}>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
