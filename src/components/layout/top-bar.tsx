'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

/** Check if a URL points to a video file */
function isVideoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.(mp4|webm|mov|avi)$/i.test(path);
  } catch {
    return false;
  }
}

export function TopBar({ dict, onMenuToggle }: TopBarProps) {
  const { user, signOut } = useAuth();

  const displayName = user?.display_name || user?.username || '';
  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const avatarUrl = user?.avatar_url ?? null;
  const hasVideoAvatar = avatarUrl ? isVideoUrl(avatarUrl) : false;
  const hasImageAvatar = avatarUrl && !hasVideoAvatar;

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
            {hasVideoAvatar && avatarUrl && (
              <video
                src={avatarUrl}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full rounded-full object-cover"
              />
            )}
            {hasImageAvatar && <AvatarImage src={avatarUrl} alt={displayName} />}
            {!hasVideoAvatar && <AvatarFallback>{initials}</AvatarFallback>}
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            {user?.email}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()}>
            {dict.nav.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
