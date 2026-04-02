export type {
  UserRole,
  BookingStatus,
  LeadStatus,
  Profile,
  Lead,
  Booking,
  BookingParticipant,
  Database,
} from './database';

export type {
  SSOUser,
  SSOVerifySuccess,
  SSOVerifyError,
  SSOVerifyResponse,
  SessionData,
} from './sso';

/** Navigation item for the app shell */
export interface NavItem {
  labelKey: string;
  href: string;
  icon?: string;
  roles?: string[];
  children?: NavItem[];
}

/** Organization config loaded from DB or config */
export interface OrgConfig {
  name: string;
  tagline: string;
  logoUrl: string | null;
  supportEmail: string;
  defaultCurrency: string;
  defaultLanguage: string;
  timezone: string;
  features: Record<string, boolean>;
}
