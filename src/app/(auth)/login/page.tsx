import Image from 'next/image';
import { getDictionary } from '@/i18n';
import { SSOLoginButton } from '@/modules/auth/sso-login-button';

export const metadata = { title: 'Sign In — AO Platform' };

export default function LoginPage() {
  const dict = getDictionary('en');

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-subtle p-4">
      <div className="w-full max-w-[860px] space-y-18 text-center">
        {/* Logo */}
        <Image
          src="/AnamayaOS_full_logo_800px_black.webp"
          alt="AnamayaOS"
          width={360}
          height={72}
          className="mx-auto"
          priority
        />

        {/* Top divider */}
        <Image
          src="/flower-divider.png"
          alt=""
          width={640}
          height={32}
          className="mx-auto"
        />

        {/* Content */}
        <div className="space-y-18">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {dict.auth.loginTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {dict.auth.loginSubtitle}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="w-1/3">
              <SSOLoginButton label={dict.auth.login} />
            </div>
          </div>
        </div>

        {/* Bottom divider (rotated 180) */}
        <Image
          src="/flower-divider.png"
          alt=""
          width={640}
          height={32}
          className="mx-auto rotate-180"
        />
      </div>
    </div>
  );
}
