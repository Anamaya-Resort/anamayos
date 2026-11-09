/** Shared shapes for the social media marketing tracking dashboard. */

export type PlatformKey = 'instagram' | 'facebook' | 'tiktok' | 'google';

export interface MarketingPlatform {
  key: PlatformKey;
  name: string;
  sort_order: number;
  logo_slug: string | null;
  placements: string[];
  is_active: boolean;
}

/**
 * A single headline number. `value` is null when the underlying source
 * is not connected yet — the UI renders an "awaiting connection" state
 * rather than a zero, because a zero reads as failure.
 */
export interface Kpi {
  key: string;
  value: number | null;
  /** How to format it in the UI. */
  format: 'currency' | 'number' | 'percent' | 'ratio';
  /** Where the number came from, shown under the tile so nobody has to guess. */
  source: 'anamayos' | 'platform' | 'blended';
  /** ISO date of the newest underlying record, or null if none. */
  freshAt: string | null;
  /** Set when value is null, explaining what is missing. */
  blockedBy?: string;
}

export interface DashRange {
  from: string;
  to: string;
  label: string;
}

export interface PlatformSummary {
  platform: PlatformKey;
  placement: string;
  kpis: Kpi[];
  connected: boolean;
  lastSyncAt: string | null;
}

/** Business outcomes that are real today, independent of any ad platform. */
export interface OutcomeTotals {
  bookings: number;
  bookingsWithAmount: number;
  revenue: number;
  /** Cash actually collected in the window; payouts excluded. */
  collected: number;
  averageBookingValue: number | null;
  leads: number;
  leadToBookingRate: number | null;
  currency: string;
  revenueFreshAt: string | null;
  bookingsFreshAt: string | null;
}

export interface RetreatOutcome {
  retreatId: string;
  name: string;
  startDate: string | null;
  bookings: number;
  revenue: number;
}

/** A campaign goal, with optional numeric targets and a free-text brief. */
export interface MarketingGoal {
  id: string;
  title: string;
  platform_key: PlatformKey | null;
  retreat_id: string | null;
  period_start: string | null;
  period_end: string | null;
  target_spend: number | null;
  target_leads: number | null;
  target_bookings: number | null;
  target_revenue: number | null;
  target_roas: number | null;
  body: string | null;
  is_active: boolean;
}

/** One target measured against what actually happened. */
export interface GoalProgress {
  key: string;
  target: number;
  actual: number | null;
  format: Kpi['format'];
}

export interface GoalWithProgress {
  goal: MarketingGoal;
  progress: GoalProgress[];
}

/** One ad, ad set or campaign with its performance in the window. */
export interface CreativeRow {
  externalId: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
}

/** A website or subdomain whose traffic and search performance we track. */
export interface MarketingSite {
  id: string;
  domain: string;
  label: string;
  ga4_property_id: string | null;
  /** Matched against GA4's hostName dimension; null means the whole property. */
  ga4_hostname: string | null;
  gsc_property: string | null;
  /** 'page contains' filter, to slice a subdomain out of a domain property. */
  gsc_page_filter: string | null;
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}

/** GA4 and Search Console figures for one site over the open date range. */
export interface SiteMetrics {
  site: MarketingSite;
  sessions: number | null;
  users: number | null;
  conversions: number | null;
  clicks: number | null;
  impressions: number | null;
  position: number | null;
  blockedBy?: string;
}
