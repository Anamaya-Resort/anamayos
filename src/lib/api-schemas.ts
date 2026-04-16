import { z } from 'zod';

// ── Persons ──

export const createPersonSchema = z.object({
  email: z.string().email().max(320),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  gender: z.string().max(30).optional(),
  date_of_birth: z.string().date().optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  nationality: z.string().max(100).optional(),
  pronouns: z.string().max(50).optional(),
  whatsapp_number: z.string().max(50).optional(),
  instagram_handle: z.string().max(100).optional(),
  communication_preference: z.enum(['email', 'whatsapp', 'phone']).default('email'),
  notes: z.string().max(5000).optional(),
});

export const updatePersonSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  gender: z.string().max(30).optional(),
  date_of_birth: z.string().date().optional().nullable(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  nationality: z.string().max(100).optional(),
  pronouns: z.string().max(50).optional(),
  whatsapp_number: z.string().max(50).optional(),
  instagram_handle: z.string().max(100).optional(),
  communication_preference: z.enum(['email', 'whatsapp', 'phone']).optional(),
  notes: z.string().max(5000).optional(),
  is_active: z.boolean().optional(),
});

// ── Bookings ──

export const createBookingSchema = z.object({
  person_id: z.string().uuid(),
  retreat_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  status: z.string().max(50).default('inquiry'),
  check_in: z.string().date(),
  check_out: z.string().date(),
  num_guests: z.number().int().min(1).max(100).default(1),
  total_amount: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  guest_type: z.string().max(50).default('participant'),
  notes: z.string().max(5000).optional(),
});

export const updateBookingSchema = z.object({
  id: z.string().uuid(),
  status: z.string().max(50).optional(),
  room_id: z.string().uuid().nullable().optional(),
  retreat_id: z.string().uuid().nullable().optional(),
  check_in: z.string().date().optional(),
  check_out: z.string().date().optional(),
  num_guests: z.number().int().min(1).max(100).optional(),
  total_amount: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  guest_type: z.string().max(50).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// ── Tax Rates ──

export const taxRateSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  rate: z.number().min(0).max(1),
  is_compound: z.boolean().default(false),
  applies_to: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

// ── Line Items ──

export const createLineItemSchema = z.object({
  booking_id: z.string().uuid(),
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  facility_id: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(10000).default(1),
  unit_price: z.number().min(0).optional(),
  discount_amount: z.number().min(0).default(0),
  discount_percent: z.number().min(0).max(100).default(0),
  currency: z.string().length(3).optional(),
  status: z.string().max(50).default('confirmed'),
  scheduled_date: z.string().date().optional(),
  scheduled_start: z.string().max(20).optional(),
  scheduled_end: z.string().max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateLineItemSchema = z.object({
  id: z.string().uuid(),
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  staff_notes: z.string().max(5000).optional(),
  approved_signature: z.string().max(50000).optional(),
  approved_at: z.string().optional(),
  approved_location_name: z.string().max(200).optional(),
  approved_location_coords: z.string().max(100).optional(),
  approved_by_person_id: z.string().uuid().optional(),
  approval_method: z.string().max(50).optional(),
});

// ── Person Roles ──

export const assignRoleSchema = z.object({
  person_id: z.string().uuid(),
  role_id: z.string().uuid(),
  employment_type: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
});

export const removeRoleSchema = z.object({
  person_role_id: z.string().uuid(),
});

// ── Folio Approve ──

export const folioApproveSchema = z.object({
  line_item_id: z.string().uuid(),
  signature: z.string().min(1).max(50000).refine(
    (s) => s.startsWith('data:image/png;base64,'),
    { message: 'Signature must be a PNG data URL' },
  ),
  location_name: z.string().max(200).optional(),
  location_coords: z.string().max(100).optional(),
});

// ── Auth ──

export const verifyTokenSchema = z.object({
  access_token: z.string().min(1).max(10000),
});

export const localeSchema = z.object({
  locale: z.string().min(2).max(5),
});

// ── Profile ──

export const updateProfileSchema = z.object({
  full_name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  gender: z.string().max(30).optional(),
  date_of_birth: z.string().date().optional().nullable(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  nationality: z.string().max(100).optional(),
  pronouns: z.string().max(50).optional(),
  address_line: z.string().max(500).optional(),
  whatsapp_number: z.string().max(50).optional(),
  instagram_handle: z.string().max(100).optional(),
  communication_preference: z.enum(['email', 'whatsapp', 'phone']).optional(),
});
