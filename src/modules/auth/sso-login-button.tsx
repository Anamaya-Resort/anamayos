'use client';

import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { getSSOLoginUrl, safeNext } from '@/config/sso';

interface SSOLoginButtonProps {
  label: string;
}

export function SSOLoginButton({ label }: SSOLoginButtonProps) {
  function handleLogin() {
    // Carry the page the user was trying to reach through the SSO round
    // trip, so a bookmarked deep link lands where it was pointed rather
    // than on the dashboard. If the SSO drops the query, the callback just
    // falls back to /dashboard.
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    const callbackUrl = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ''
    }`;
    window.location.href = getSSOLoginUrl(callbackUrl);
  }

  return (
    <Button
      onClick={handleLogin}
      size="lg"
      className="w-full gap-2 bg-brand-btn text-brand-btn-text hover:bg-brand-btn-hover ao-btn-fx--strong ao-btn-fx--slow"
    >
      <LogIn className="h-4 w-4" />
      {label}
    </Button>
  );
}
