import type { NavItem } from '@/types';

export const mainNavItems: NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    labelKey: 'nav.bookings',
    href: '/dashboard/bookings',
    icon: 'CalendarCheck',
  },
  {
    labelKey: 'nav.leads',
    href: '/dashboard/leads',
    icon: 'Users',
  },
  {
    labelKey: 'nav.settings',
    href: '/dashboard/settings',
    icon: 'Settings',
    roles: ['admin', 'owner'],
  },
];
