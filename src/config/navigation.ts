import { ACCESS_LEVELS } from '@/types';
import type { NavItem } from '@/types';

export const mainNavItems: NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    labelKey: 'nav.people',
    href: '/dashboard/people',
    icon: 'Contact',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.calendar',
    href: '/dashboard/calendar',
    icon: 'CalendarDays',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.bookings',
    href: '/dashboard/bookings',
    icon: 'CalendarCheck',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.leads',
    href: '/dashboard/leads',
    icon: 'Users',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.settings',
    href: '/dashboard/settings',
    icon: 'Settings',
    minAccessLevel: ACCESS_LEVELS.admin,
  },
];
