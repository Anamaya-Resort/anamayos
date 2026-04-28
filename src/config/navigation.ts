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
    children: [
      { labelKey: 'nav.allPeople', href: '/dashboard/people' },
      { labelKey: 'nav.retreatLeaders', href: '/dashboard/people/retreat-leaders' },
      { labelKey: 'nav.team', href: '/dashboard/people/team' },
      { labelKey: 'nav.guests', href: '/dashboard/people/guests' },
    ],
  },
  {
    labelKey: 'nav.calendar',
    href: '/dashboard/calendar',
    icon: 'CalendarDays',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.book',
    href: '/dashboard/book',
    icon: 'PlusCircle',
  },
  {
    labelKey: 'nav.bookingForm',
    href: '/dashboard/booking-form',
    icon: 'FileText',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.bookings',
    href: '/dashboard/bookings',
    icon: 'CalendarCheck',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.retreats',
    href: '/dashboard/retreats',
    icon: 'Mountain',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.products',
    href: '/dashboard/products',
    icon: 'Package',
    minAccessLevel: ACCESS_LEVELS.staff,
    children: [
      { labelKey: 'nav.allProducts', href: '/dashboard/products' },
      { labelKey: 'nav.retreatWorkshops', href: '/dashboard/products/retreat-workshops' },
    ],
  },
  {
    labelKey: 'nav.rooms',
    href: '/dashboard/rooms',
    icon: 'Bed',
    minAccessLevel: ACCESS_LEVELS.staff,
  },
  {
    labelKey: 'nav.transactions',
    href: '/dashboard/transactions',
    icon: 'Receipt',
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
