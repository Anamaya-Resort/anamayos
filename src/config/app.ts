import type { OrgConfig } from '@/types';

/**
 * Default app configuration.
 * In production, override these from the database org_settings table.
 * No brand-specific values here — this is the generic fallback.
 */
export const defaultOrgConfig: OrgConfig = {
  name: 'AO Platform',
  tagline: 'Operations Management',
  logoUrl: null,
  supportEmail: 'support@example.com',
  defaultCurrency: 'USD',
  defaultLanguage: 'en',
  timezone: 'UTC',
  features: {
    bookings: true,
    leads: true,
    transport: false,
    folios: false,
    treatments: false,
    payroll: false,
    reports: false,
  },
};

/** Supported currencies */
export const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
] as const;

/** Supported locales */
export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
