'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, Globe, Check, LogOut, ChevronLeft, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/modules/auth';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';

interface TopBarProps {
  dict: TranslationKeys;
  onMenuToggle: () => void;
}

const languageNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

function isVideoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.(mp4|webm|mov|avi)$/i.test(path);
  } catch {
    return false;
  }
}

export function TopBar({ dict, onMenuToggle }: TopBarProps) {
  const { user, locale, accessLevel, roleSlugs, signOut, setLocale } = useAuth();

  // Show the highest-priority role
  const ROLE_PRIORITY: Record<string, number> = { superadmin: 7, owner: 6, admin: 5, manager: 4 };
  const topRole = roleSlugs
    .slice()
    .sort((a, b) => (ROLE_PRIORITY[b] ?? 1) - (ROLE_PRIORITY[a] ?? 1))[0];
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleLeave() {
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setLangOpen(false);
    }, 200);
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setLangOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

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

      {/* Role label + avatar */}
      {topRole && (
        <span className="text-xs text-muted-foreground mr-2 hidden sm:inline capitalize">
          {topRole.replace(/_/g, ' ')}
        </span>
      )}

      {/* Custom dropdown — opens on hover */}
      <div
        ref={menuRef}
        className="relative"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          onClick={() => setOpen(!open)}
        >
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
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-50 min-w-[176px] rounded-md border bg-popover p-1 shadow-lg">
            {/* User name — links to profile */}
            <a
              href="/dashboard/profile"
              className="block px-3 py-2 text-sm font-medium truncate rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={() => setOpen(false)}
            >
              {displayName || user?.email}
            </a>

            <div className="my-1 h-px bg-border" />

            {/* Language with submenu */}
            <div
              className="relative"
              onMouseEnter={() => setLangOpen(true)}
              onMouseLeave={() => setLangOpen(false)}
            >
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setLangOpen(true)}
              >
                <Globe className="h-4 w-4" />
                <span>{dict.nav.language}</span>
                <ChevronLeft className="ml-auto h-4 w-4 text-muted-foreground" />
              </button>

              {langOpen && (
                <div className="absolute right-full top-0 mr-1 min-w-[140px] rounded-md border bg-popover p-1 shadow-lg">
                  {(Object.keys(languageNames) as Locale[]).map((loc) => (
                    <button
                      key={loc}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setLocale(loc);
                        setOpen(false);
                        setLangOpen(false);
                      }}
                    >
                      {locale === loc ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="w-4" />
                      )}
                      {languageNames[loc]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dark mode toggle */}
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                const html = document.documentElement;
                const isDark = html.classList.contains('dark');
                html.classList.toggle('dark', !isDark);
                localStorage.setItem('ao-theme', isDark ? 'light' : 'dark');
              }}
            >
              {typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />}
              {typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
                ? 'Light Mode'
                : 'Dark Mode'}
            </button>

            <div className="my-1 h-px bg-border" />

            {/* Sign out */}
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              {dict.nav.signOut}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
