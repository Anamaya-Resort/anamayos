'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/auth';
import { mainNavItems } from '@/config/navigation';
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
};

interface SidebarProps {
  dict: TranslationKeys;
}

export function Sidebar({ dict }: SidebarProps) {
  const pathname = usePathname();
  const { signOut, accessLevel } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Clear pending state when navigation completes
  useEffect(() => { setPendingHref(null); }, [pathname]);

  const visibleItems = mainNavItems.filter(
    (item) => !item.minAccessLevel || accessLevel >= item.minAccessLevel,
  );

  return (
    <aside className="flex h-full w-full flex-col border-r bg-card">
      <div className="flex h-14 items-center justify-center border-b px-2 overflow-hidden">
        <Image
          src="/AnamayaOS_full_logo_800px_black.webp"
          alt="AnamayaOS"
          width={184}
          height={37}
          className="object-contain max-w-full h-auto"
        />
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => {
          const Icon = item.icon ? iconMap[item.icon] : null;
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          const isPending = pendingHref === item.href;
          const hasChildren = item.children && item.children.length > 0;

          if (hasChildren) {
            return (
              <NavGroup key={item.href} item={item} Icon={Icon} isActive={isActive}
                pathname={pathname} dict={dict} pendingHref={pendingHref} setPendingHref={setPendingHref} />
            );
          }

          return (
            <Link key={item.href} href={item.href}
              onClick={() => setPendingHref(item.href)}>
              <span
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive || isPending
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {t(dict, item.labelKey)}
                {isPending && !isActive && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {dict.nav.signOut}
        </Button>
      </div>
    </aside>
  );
}

/** Collapsible nav group with children */
function NavGroup({ item, Icon, isActive, pathname, dict, pendingHref, setPendingHref }: {
  item: NavItem; Icon: LucideIcon | null; isActive: boolean;
  pathname: string; dict: TranslationKeys; pendingHref: string | null;
  setPendingHref: (href: string | null) => void;
}) {
  const [open, setOpen] = useState(isActive);

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}>
        {Icon && <Icon className="h-4 w-4" />}
        {t(dict, item.labelKey)}
        <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && item.children && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l pl-2">
          {item.children.map((child) => {
            const childActive = child.href === item.href
              ? pathname === child.href
              : pathname.startsWith(child.href);
            const childPending = pendingHref === child.href;
            return (
              <Link key={child.href} href={child.href} onClick={() => setPendingHref(child.href)}>
                <span className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  childActive || childPending
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}>
                  {t(dict, child.labelKey)}
                  {childPending && !childActive && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
