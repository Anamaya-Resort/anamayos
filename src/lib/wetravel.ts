/**
 * WeTravel API client.
 * Two-step auth: refresh token → access token (1hr), then Bearer auth.
 */

const WT_BASE = 'https://api.wetravel.com/v2';
const WT_REFRESH_TOKEN = process.env.WETRAVEL_REFRESH_TOKEN ?? '';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/** Get a valid access token, refreshing if needed */
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const res = await fetch(`${WT_BASE}/auth/tokens/access`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WT_REFRESH_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`WeTravel auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000; // refresh 5min before expiry
  return cachedAccessToken!;
}

/** Authenticated GET request */
async function wtGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${WT_BASE}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WeTravel GET ${endpoint}: ${res.status}`);
  return res.json();
}

/** Authenticated POST request (some WT endpoints use POST for listing) */
async function wtPost<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${WT_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`WeTravel POST ${endpoint}: ${res.status}`);
  return res.json();
}

// ============================================================
// Typed fetchers
// ============================================================

export interface WTTrip {
  uuid: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  url: string;
  group_max: number;
  group_min: number;
  listing_status: string;
  created_at: string;
}

export interface WTTransaction {
  uuid: string;
  type: string; // "Payment", "Wire Transfer", "Payout"
  status: string;
  amount: number; // cents
  net_amount: number; // cents
  customer_facing_amount: number; // cents
  currency: string;
  description: string;
  note: string;
  payment_method: string | null;
  brand: string | null;
  last4: string | null;
  discount_code: string | null;
  wetravel_fee: number;
  organizer_card_fee: number;
  customer_card_fee: number;
  buyer: { first_name: string; last_name: string; email: string } | null;
  participants: Array<{ first_name: string; last_name: string; email: string }>;
  packages: Array<{ name: string; price: number; deposit: number; participants: number }>;
  trip: {
    uuid: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    location: string;
  } | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WTPaymentLink {
  trip: {
    uuid: string;
    title: string;
    url: string;
    start_date: string | null;
    end_date: string | null;
    currency: string;
  };
  pricing: {
    price: number; // dollars
    payment_plan: {
      deposit: number;
      installments: Array<{ price: number; days_before_departure: number }>;
    } | null;
  };
}

interface WTPaginatedResponse<T> {
  data?: T[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
}

export async function fetchWTTrips(): Promise<WTTrip[]> {
  const all: WTTrip[] = [];
  let page = 1;
  while (true) {
    const res = await wtGet<Record<string, unknown>>(
      '/draft_trips',
      { page: String(page), per_page: '100' },
    );
    const items: WTTrip[] = Array.isArray(res) ? res : ((res as { data?: WTTrip[] }).data ?? []);
    if (items.length === 0) break;
    all.push(...items);
    page++;
    if (items.length < 100) break;
  }
  return all;
}

export async function fetchWTTransactions(): Promise<WTTransaction[]> {
  const all: WTTransaction[] = [];
  let page = 1;
  while (true) {
    const res = await wtPost<Record<string, unknown>>(
      '/transactions',
      { page, per_page: 100 },
    );
    const items: WTTransaction[] = Array.isArray(res) ? res : ((res as { data?: WTTransaction[]; transactions?: WTTransaction[] }).data ?? (res as { transactions?: WTTransaction[] }).transactions ?? []);
    if (items.length === 0) break;
    all.push(...items);
    page++;
    if (items.length < 100) break;
  }
  return all;
}

export async function fetchWTPaymentLinks(): Promise<WTPaymentLink[]> {
  const res = await wtGet<Record<string, unknown>>('/payment_links');
  return Array.isArray(res) ? res as WTPaymentLink[] : ((res as { data?: WTPaymentLink[] }).data ?? []);
}
