import { getDictionary } from '@/i18n';
import { SSOLoginButton } from '@/modules/auth/sso-login-button';

export const metadata = { title: 'Sign In — AO Platform' };

export default function LoginPage() {
  const dict = getDictionary('en');

  return (
    <div className="flex min-h-screen items-center justify-center bg-ana-bg-subtle p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {dict.auth.loginTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dict.auth.loginSubtitle}
          </p>
        </div>
        <SSOLoginButton label={dict.auth.login} />
      </div>
    </div>
  );
}
