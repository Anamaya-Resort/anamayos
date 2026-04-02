'use client';

import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { getSSOLoginUrl } from '@/config/sso';

interface SSOLoginButtonProps {
  label: string;
}

export function SSOLoginButton({ label }: SSOLoginButtonProps) {
  function handleLogin() {
    // Build callback URL from current origin
    const callbackUrl = `${window.location.origin}/auth/callback`;
    window.location.href = getSSOLoginUrl(callbackUrl);
  }

  return (
    <Button
      onClick={handleLogin}
      size="lg"
      className="w-full gap-2 bg-ana-btn text-white hover:bg-ana-btn-hover"
    >
      <LogIn className="h-4 w-4" />
      {label}
    </Button>
  );
}
