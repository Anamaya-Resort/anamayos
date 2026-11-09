'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  CalendarCheck,
  Users,
  Contact,
  Mountain,
  Package,
  Bed,
  Receipt,
  Settings,
  LogOut,
  PlusCircle,
  Loader2,
  ChevronDown,
  Clapperboard,
  Images,
  CalendarRange,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/auth';
import { mainNavItems } from '@/config/navigation';
import { APP_VERSION } from '@/config/app';
import type { NavItem } from '@/types';
import type { TranslationKeys } from '@/i18n/en';
import { t } from '@/i18n';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  FileText,
  CalendarCheck,
  Users,
  Contact,
  Mountain,
  Package,
  Bed,
  Receipt,
  Settings,
  PlusCircle,
  Clapperboard,
  CalendarRange,
  Images,
  TrendingUp,
};

const ROW = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors';
const ROW_ON = 'bg-primary/10 text-primary';
const ROW_OFF = 'text-muted-foreground hover:bg-muted hover:text-foreground';

/**
 * Does this path sit at or below this nav href?
 *
 * A plain `startsWith` lit up several items at once, because it ignores
 * segment boundaries: `/dashboard/bookings` starts with the string
 * `/dashboard/book`, so Book and Bookings were both highlighted, and
 * `/dashboard/booking-form` highlighted Book as well. Comparing against
 * `href + '/'` makes the match stop at a real path segment.
 */
function matches(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A group is current if it, or any of its children, is current. */
function groupActive(pathname: string, item: NavItem): boolean {
  if (matches(pathname, item.href)) return true;
  return (item.children ?? []).some((c) => matches(pathname, c.href));
}

/**
 * Spinner for the link it sits inside.
 *
 * `useLinkStatus` reports the real pending state of its own Link, which
 * the hand-rolled version could not: that tracked one clicked href in
 * component state and cleared it on a pathname change, so a click on the
 * page you were already on spun forever. Always rendered and toggled by
 * opacity, because appearing and disappearing shifts the row.
 */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  return (
    <Loader2
      aria-hidden
      className={cn(
        'ml-auto h-3 w-3 shrink-0 animate-spin transition-opacity',
        pending ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

export function Sidebar({ dict }: { dict: TranslationKeys }) {
  const pathname = usePathname();
  const { signOut, accessLevel, roleSlugs, isLoading } = useAuth();

  const visibleItems = mainNavItems.filter((item) => {
    const byLevel = !item.minAccessLevel || accessLevel >= item.minAccessLevel;
    const byRole = !!item.anyRole && item.anyRole.some((r) => roleSlugs.includes(r));
    return byLevel || byRole;
  });

  return (
    <aside className="flex h-full w-full flex-col border-r bg-card">
      <div className="flex flex-col items-center justify-center gap-0.5 overflow-hidden border-b px-2 py-2">
        <Image
          src="/AnamayaOS_full_logo_800px_black.webp"
          alt="AnamayaOS"
          width={184}
          height={37}
          className="h-auto max-w-full object-contain"
        />
        <span className="text-[10px] leading-none text-muted-foreground">v{APP_VERSION}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {/* Placeholder rows while access level is unknown. Without them the
            real items appear a moment later and shift whatever is under the
            cursor, so a click lands on the wrong row or on nothing. */}
        {isLoading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted/60" />
            ))
          : visibleItems.map((item) => {
              const Icon = item.icon ? iconMap[item.icon] : null;
              const active = groupActive(pathname, item);

              if (item.children && item.children.length > 0) {
                return (
                  <NavGroup
                    key={item.href} item={item} Icon={Icon}
                    isActive={active} pathname={pathname} dict={dict}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(ROW, active ? ROW_ON : ROW_OFF)}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{t(dict, item.labelKey)}</span>
                  <PendingSpinner />
                </Link>
              );
            })}
      </nav>

      <div className="border-t p-2">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
          {dict.nav.signOut}
        </Button>
      </div>
    </aside>
  );
}

/**
 * A nav item with sub-pages.
 *
 * The row is a real link, so one click goes to the section. The chevron
 * beside it is a separate button that only expands. It used to be a
 * single button that expanded and nothing more, which is why reaching a
 * sub-page always took two clicks.
 */
function NavGroup({ item, Icon, isActive, pathname, dict }: {
  item: NavItem; Icon: LucideIcon | null; isActive: boolean;
  pathname: string; dict: TranslationKeys;
}) {
  const [open, setOpen] = useState(isActive);

  // Open on arrival, but never force it shut: collapsing by hand sticks.
  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  return (
    <div>
      <div className={cn('flex items-center gap-1', isActive ? ROW_ON : '', 'rounded-md')}>
        <Link
          href={item.href}
          className={cn(ROW, 'flex-1', isActive ? ROW_ON : ROW_OFF)}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="truncate">{t(dict, item.labelKey)}</span>
          <PendingSpinner />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t(dict, item.labelKey)}
          className={cn(
            'shrink-0 rounded-md p-2 transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && item.children && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l pl-2">
          {item.children.map((child) => {
            // A child pointing at the group's own href is the "all" page,
            // so it is only current on an exact match. Otherwise every
            // sub-page would light it up too.
            const childActive = child.href === item.href
              ? pathname === child.href
              : matches(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  childActive ? ROW_ON : ROW_OFF,
                )}
              >
                <span className="truncate">{t(dict, child.labelKey)}</span>
                <PendingSpinner />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
