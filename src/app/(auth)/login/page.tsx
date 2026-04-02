import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/modules/auth';
import { getDictionary } from '@/i18n';

export const metadata = { title: 'Sign In — AO Platform' };

export default function LoginPage() {
  const dict = getDictionary('en');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Suspense>
          <LoginForm dict={dict} />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          {dict.auth.noAccount}{' '}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            {dict.auth.signup}
          </Link>
        </p>
      </div>
    </div>
  );
}
