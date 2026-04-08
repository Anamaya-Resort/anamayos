// Ring 0: People & Roles
export type {
  Person,
  Role,
  PersonRole,
  PersonRoleStatus,
  EmploymentType,
  RoleCategory,
  StaffDetails,
  PractitionerDetails,
  VendorDetails,
  GuestDetails,
  PersonWithRoles,
  PersonRelationship,
  AccessLevel,
} from './database';

export { ACCESS_LEVELS } from './database';

// Ring 1a: Property
export type {
  Bed,
  BedType,
  BedConfiguration,
  Facility,
  FacilityType,
  RoomAvailability,
} from './database';

// Ring 1b: Workforce
export type {
  StaffAvailability,
  ServiceCatalogItem,
  ServiceDomain,
  ServiceProvider,
  VendorType,
} from './database';

// Existing (some deprecated)
export type {
  UserRole,
  BookingStatus,
  LeadStatus,
  Profile,
  Lead,
  Booking,
  BookingParticipant,
} from './database';

// SSO
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
  minAccessLevel?: number;
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
