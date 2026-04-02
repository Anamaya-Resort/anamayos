'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/modules/auth';
import type { TranslationKeys } from '@/i18n/en';

interface TopBarProps {
  dict: TranslationKeys;
  onMenuToggle: () => void;
}

export function TopBar({ dict, onMenuToggle }: TopBarProps) {
  const { profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            {profile?.email}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()}>
            {dict.nav.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
