/**
 * Retreat Guru API client.
 * Handles pagination and authentication for all RG endpoints.
 */

const RG_BASE_URL = process.env.RG_API_URL ?? 'https://anamaya.secure.retreat.guru/api/v1';
const RG_TOKEN = process.env.RG_API_TOKEN ?? '';
const FETCH_TIMEOUT_MS = 60_000;
const MAX_PAGES = 500;

/** Fetch with timeout */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a single page from the RG API */
async function rgFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
  const url = new URL(`${RG_BASE_URL}${endpoint}`);
  url.searchParams.set('token', RG_TOKEN);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetchWithTimeout(url.toString(), FETCH_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`RG API error: ${res.status} ${res.statusText} for ${endpoint}`);
  }
  return res.json();
}

/** Fetch all records with pagination and max-page guard */
async function rgFetchAll<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= MAX_PAGES) {
    const batch = await rgFetch<T>(endpoint, {
      ...params,
      page: String(page),
      limit: String(perPage),
    });
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return all;
}

// ============================================================
// Typed fetchers
// ============================================================

export async function fetchRGRooms() {
  return rgFetch<RGRoom>('/rooms');
}

export async function fetchRGLodgings() {
  return rgFetch<RGLodging>('/lodgings');
}

export async function fetchRGTeachers() {
  return rgFetchAll<RGTeacher>('/teachers');
}

export async function fetchRGPeople() {
  return rgFetchAll<RGPerson>('/people');
}

export async function fetchRGPrograms() {
  return rgFetchAll<RGProgram>('/programs');
}

export async function fetchRGRegistrations() {
  return rgFetchAll<RGRegistration>('/registrations');
}

export async function fetchRGLeads() {
  return rgFetchAll<RGLead>('/leads');
}

export async function fetchRGTransactions() {
  return rgFetchAll<RGTransaction>('/transactions');
}

export async function fetchRGRoomBlocks() {
  return rgFetchAll<RGRoomBlock>('/room_blocks');
}

// ============================================================
// Types for RG API responses
// ============================================================

export interface RGRoom {
  id: number;
  name: string;
  room_status?: { slug: string; name: string };
}

export interface RGLodging {
  id: number;
  name: string;
  description?: string;
  occupancy_type?: string;
  max_occupancy?: number;
  base_price?: number;
  images?: unknown[];
}

export interface RGTeacher {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  content?: string;
  categories?: string[];
  images?: unknown;
  website?: string;
  phone?: string;
  location?: string;
}

export interface RGPerson {
  id: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  registered?: string;
  questions?: Record<string, unknown>;
}

export interface RGProgram {
  id: number;
  name: string;
  excerpt?: string;
  content?: string;
  date_type?: string;
  start_date?: string;
  end_date?: string;
  package_nights?: number;
  status?: string;
  public?: boolean;
  program_registration_status?: string;
  categories?: string[];
  pricing_type?: string;
  pricing_options?: unknown;
  deposit_percentage?: number;
  max_capacity?: number;
  available_spaces?: number;
  currency?: string;
  waitlist_enabled?: boolean;
  program_info?: unknown;
  images?: unknown[];
  program_link?: string;
  registration_link?: string;
  updated_at_gmt?: string;
}

export interface RGRegistration {
  id: number;
  submitted?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  guest_type?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  program_id?: number;
  program?: string;
  room_id?: number;
  room?: string;
  lodging_id?: number;
  lodging?: string;
  nights?: number;
  person_id?: number;
  parent_registration_id?: number;
  total_items?: number;
  total_payments?: number;
  total_taxes?: number;
  grand_total?: number;
  balance_due?: number;
  registration_total?: number;
  questions?: Record<string, unknown>;
}

export interface RGLead {
  id: number;
  submitted?: string;
  lead_type?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  program_id?: number;
  program?: string;
  language?: string;
  questions?: Record<string, unknown>;
}

export interface RGTransaction {
  id: number;
  submitted?: string;
  trans_date?: string;
  class?: string;
  category?: string;
  status?: string;
  description?: string;
  program_id?: number;
  person_id?: number;
  registration_id?: number;
  charge_amount?: number;
  credit_amount?: number;
  grand_total?: number;
  subtotal?: number;
  tax_1_info?: string;
  tax_1_amount?: number;
  tax_2_info?: string;
  tax_2_amount?: number;
  discount_amount?: number;
  discount_percent?: number;
  quantity?: number;
  price_per_item?: number;
  is_addon?: boolean;
  fund_method?: string;
  merchant_name?: string;
  merchant_trans_id?: string;
  revenue?: Record<string, number>;
  notes?: string;
  glcode?: string;
}

export interface RGRoomBlock {
  id: number;
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  date_type?: string;
  lodgings?: Array<{
    id: number;
    name: string;
    rooms?: Array<{ id: number; name: string }>;
  }>;
}
