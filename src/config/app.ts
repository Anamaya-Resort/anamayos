import type { OrgConfig } from '@/types';

/**
 * Displayed under the logo in the sidebar. Format: MAJOR.MINOR.PATCH.
 *
 * Every Claude Code agent working in this repo: bump PATCH (the last
 * number) on every change you ship, no exceptions. Only bump MINOR (the
 * middle number) when Geoff explicitly says to -- e.g. starting a new
 * feature. Never touch MAJOR without being told to.
 */
export const APP_VERSION = '2.5.28';

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
    video_maker: true,
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
