'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/auth';
import { mainNavItems } from '@/config/navigation';
import type { TranslationKeys } from '@/i18n/en';
import { t } from '@/i18n';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Settings,
};

interface SidebarProps {
  dict: TranslationKeys;
  orgName: string;
}

export function Sidebar({ dict, orgName }: SidebarProps) {
  const pathname = usePathname();
  const { signOut, accessLevel } = useAuth();

  const visibleItems = mainNavItems.filter(
    (item) => !item.minAccessLevel || accessLevel >= item.minAccessLevel,
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold">{orgName}</span>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => {
          const Icon = item.icon ? iconMap[item.icon] : null;
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {t(dict, item.labelKey)}
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
