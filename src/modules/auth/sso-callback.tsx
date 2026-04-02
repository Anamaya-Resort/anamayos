'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDictionary } from '@/i18n';

/**
 * Handles the SSO callback.
 * The SSO redirects here with tokens in the URL hash fragment:
 *   /auth/callback#access_token=JWT&refresh_token=TOKEN&token_type=bearer
 *
 * Hash fragments are only accessible in JavaScript, not server-side.
 */
export function SSOCallbackHandler() {
  const router = useRouter();
  const dict = getDictionary('en');
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');

      if (!accessToken) {
        setError(dict.auth.callbackNoToken);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        });

        const data = await res.json();

        if (data.success) {
          router.push('/dashboard');
          router.refresh();
        } else {
          setError(dict.auth.callbackFailed);
          setTimeout(() => router.push('/login'), 2000);
        }
      } catch {
        setError(dict.auth.callbackFailed);
        setTimeout(() => router.push('/login'), 2000);
      }
    }

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{dict.auth.signingIn}</p>
      </div>
    </div>
  );
}
