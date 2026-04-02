import Link from 'next/link';
import { SignupForm } from '@/modules/auth';
import { getDictionary } from '@/i18n';

export const metadata = { title: 'Sign Up — AO Platform' };

export default function SignupPage() {
  const dict = getDictionary('en');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <SignupForm dict={dict} />
        <p className="text-center text-sm text-muted-foreground">
          {dict.auth.hasAccount}{' '}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {dict.auth.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
