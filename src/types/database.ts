/**
 * Database types for Supabase.
 * In production, generate these with: npx supabase gen types typescript
 */

// ============================================================
// ENUMS
// ============================================================

/** @deprecated Use access levels from person_roles instead */
export type UserRole = 'guest' | 'staff' | 'manager' | 'admin' | 'owner';

export type BookingStatus =
  | 'inquiry'
  | 'quote_sent'
  | 'confirmed'
  | 'deposit_paid'
  | 'paid_in_full'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type PersonRoleStatus = 'active' | 'suspended' | 'expired';

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'volunteer' | 'seasonal';

export type BedType = 'single' | 'single_long' | 'double' | 'queen' | 'king' | 'bunk_top' | 'bunk_bottom';

export type BedAssignmentStatus = 'confirmed' | 'pending_approval' | 'declined';

export type AccommodationRuleType = 'acknowledgment' | 'warning' | 'restriction';

export type FacilityType = 'yoga_deck' | 'spa_room' | 'pool' | 'kitchen' | 'gift_shop' | 'event_space' | 'other';

export type ServiceDomain = 'spa' | 'yoga' | 'excursion' | 'education' | 'activity' | 'other';

export type VendorType = 'art' | 'food' | 'crafts' | 'services' | 'other';

export type RoleCategory =
  | 'ownership' | 'management' | 'staff_front' | 'staff_kitchen'
  | 'staff_housekeeping' | 'staff_admin' | 'wellness' | 'education'
  | 'activity_provider' | 'guest' | 'external' | 'vendor' | 'volunteer';

// ============================================================
// ACCESS LEVELS
// ============================================================

export const ACCESS_LEVELS = {
  guest: 1,
  collaborator: 2,
  staff: 3,
  manager: 4,
  admin: 5,
  owner: 6,
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

// ============================================================
// RING 0: PEOPLE & ROLES
// ============================================================

export interface Person {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: string;
  preferred_currency: string;
  access_level: number;
  is_active: boolean;
  notes: string | null;
  date_of_birth: string | null;
  gender: string | null;
  pronouns: string | null;
  nationality: string | null;
  country: string | null;
  city: string | null;
  address_line: string | null;
  passport_number: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  communication_preference: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: RoleCategory;
  access_level: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface PersonRole {
  id: string;
  person_id: string;
  role_id: string;
  status: PersonRoleStatus;
  starts_at: string;
  ends_at: string | null;
  employment_type: EmploymentType | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffDetails {
  id: string;
  person_role_id: string;
  department: string | null;
  position: string | null;
  hourly_rate: number | null;
  monthly_salary: number | null;
  currency: string;
  manager_person_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface PractitionerDetails {
  id: string;
  person_role_id: string;
  specialties: string[];
  certifications: string[];
  languages: string[];
  bio: string | null;
  hourly_rate: number | null;
  currency: string;
  is_bookable: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorDetails {
  id: string;
  person_role_id: string;
  business_name: string | null;
  vendor_type: VendorType;
  commission_rate: number | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestDetails {
  id: string;
  person_role_id: string;
  dietary_restrictions: string | null;
  accessibility_needs: string | null;
  preferences: Record<string, unknown>;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_email: string | null;
  emergency_contact_relationship: string | null;
  medical_conditions: string | null;
  medications: string | null;
  allergies: string | null;
  injuries_limitations: string | null;
  is_pregnant: boolean;
  fitness_level: string | null;
  yoga_experience: string | null;
  room_preference: string | null;
  retreat_interests: string[] | null;
  how_heard_about_us: string | null;
  referral_person_id: string | null;
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  waiver_document_url: string | null;
  photo_release: boolean;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonRelationship {
  id: string;
  person_id: string;
  related_person_id: string;
  relationship_type: string;
  notes: string | null;
  created_at: string;
}

// ============================================================
// RING 1a: PROPERTY
// ============================================================

export interface Bed {
  id: string;
  room_id: string;
  label: string;
  bed_type: BedType;
  width_m: number | null;
  length_m: number | null;
  capacity: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BedConfiguration {
  id: string;
  bed_id: string;
  retreat_id: string | null;
  override_bed_type: BedType;
  override_capacity: number | null;
  override_label: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
}

export interface BookingBedAssignment {
  id: string;
  booking_id: string;
  bed_id: string;
  status: BedAssignmentStatus;
  assigned_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccommodationRule {
  id: string;
  entity_type: 'room' | 'bed';
  entity_id: string;
  rule_type: AccommodationRuleType;
  title: string;
  description: string | null;
  image_url: string | null;
  requires_acknowledgment: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  name: string;
  slug: string;
  facility_type: FacilityType;
  description: string | null;
  capacity: number | null;
  is_bookable: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RoomAvailability {
  id: string;
  room_id: string;
  date: string;
  is_available: boolean;
  override_rate: number | null;
  override_currency: string | null;
  block_reason: string | null;
  created_at: string;
}

// ============================================================
// RING 1b: WORKFORCE
// ============================================================

export interface StaffAvailability {
  id: string;
  person_id: string;
  date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
}

export interface ServiceCatalogItem {
  id: string;
  domain: ServiceDomain;
  category_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  max_participants: number;
  is_addon: boolean;
  contraindications: string | null;
  preparation_notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceProvider {
  id: string;
  person_id: string;
  service_id: string;
  is_primary: boolean;
  custom_rate: number | null;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// RING 2: PRODUCT CATALOG
// ============================================================

export type ProductType =
  | 'accommodation' | 'service' | 'activity' | 'item'
  | 'rental' | 'transfer' | 'package' | 'gift_certificate';

export type LineItemStatus =
  | 'pending' | 'confirmed' | 'scheduled' | 'in_progress'
  | 'completed' | 'cancelled' | 'no_show';

export interface ProductCategory {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_type: ProductType;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  base_price: number | null;
  currency: string;
  duration_minutes: number | null;
  max_participants: number;
  requires_provider: boolean;
  is_addon: boolean;
  is_active: boolean;
  sort_order: number;
  capacity_per_slot: number | null;
  service_catalog_id: string | null;
  images: unknown[];
  metadata: Record<string, unknown>;
  contraindications: string | null;
  preparation_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryMap {
  product_id: string;
  category_id: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_minutes: number | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackageItem {
  id: string;
  package_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  is_included: boolean;
  is_optional: boolean;
  addon_price: number;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductProvider {
  id: string;
  product_id: string;
  person_id: string;
  is_primary: boolean;
  custom_rate: number | null;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// RING 3: FOLIO — TAXES, LINE ITEMS, APPROVALS
// ============================================================

export type ApprovalMethod = 'self' | 'staff_presented';

export interface TaxRate {
  id: string;
  slug: string;
  name: string;
  rate: number;
  is_compound: boolean;
  applies_to: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LineItemTax {
  id: string;
  line_item_id: string;
  tax_rate_id: string;
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PricingResult {
  subtotal: number;
  taxes: Array<{ taxRateId: string; name: string; rate: number; amount: number }>;
  totalTax: number;
  total: number;
}

export interface FolioSummary {
  subtotal: number;
  taxBreakdown: Array<{ name: string; total: number }>;
  totalTax: number;
  grandTotal: number;
  paymentsApplied: number;
  balanceDue: number;
}

export interface BookingLineItem {
  id: string;
  booking_id: string;
  product_id: string;
  variant_id: string | null;
  person_id: string | null;
  provider_id: string | null;
  facility_id: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: LineItemStatus;
  scheduled_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  package_item_id: string | null;
  parent_line_item_id: string | null;
  notes: string | null;
  guest_notes: string | null;
  staff_notes: string | null;
  approved_at: string | null;
  approved_signature: string | null;
  approved_location_name: string | null;
  approved_location_coords: string | null;
  approved_by_person_id: string | null;
  approval_method: ApprovalMethod | null;
  created_at: string;
  updated_at: string;
}

export interface FolioLineItem extends BookingLineItem {
  product_name: string;
  variant_name: string | null;
  category_slugs: string[];
  taxes: LineItemTax[];
}

// ============================================================
// COMPOSITE / JOINED TYPES
// ============================================================

export interface PersonWithRoles extends Person {
  roles: Array<PersonRole & { role: Role }>;
}

export interface ProductWithCategories extends Product {
  categories: ProductCategory[];
}

export interface PackageFull extends Product {
  items: Array<PackageItem & {
    product: Product;
    variant: ProductVariant | null;
  }>;
}

export interface BookingWithLineItems extends Booking {
  line_items: BookingLineItem[];
}

// ============================================================
// LEGACY (kept for backward compat during transition)
// ============================================================

/** @deprecated Use Person instead */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  preferred_language: string;
  preferred_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  reference_code: string;
  person_id: string;
  lead_id: string | null;
  retreat_id: string | null;
  room_id: string | null;
  lodging_type_id: string | null;
  status: BookingStatus;
  check_in: string;
  check_out: string;
  num_guests: number;
  total_amount: number;
  currency: string;
  guest_type: string;
  rg_parent_booking_id: number | null;
  parent_booking_id: string | null;
  questions: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingParticipant {
  id: string;
  booking_id: string;
  person_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  dietary_requirements: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  arrival_flight: string | null;
  departure_flight: string | null;
  transport_arrival: string | null;
  transport_departure: string | null;
  arrival_notes: string | null;
  departure_notes: string | null;
  created_at: string;
  updated_at: string;
}
