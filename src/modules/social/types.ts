/**
 * Social content analytics — domain types.
 *
 * Deliberately platform-agnostic. `platform` is data, never a type, so
 * adding TikTok or YouTube means seeding a row and writing a connector,
 * not touching anything in this file or in charts/.
 *
 * Metric names are the generic ones every network reports. Where a
 * network uses a different word for the same thing, the connector
 * translates on the way in and nothing downstream knows the difference.
 */

export type Platform =
  | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'pinterest';

export type PostFormat = 'reel' | 'carousel' | 'image' | 'story' | 'video' | 'text';

/** 1..8, resolved to var(--chart-N) at render. Never a hex value. */
export type ColorSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Pillar {
  id: string;
  slug: string;
  name: string;
  colorSlot: ColorSlot;
  sortOrder: number;
}

/** Raw counters, as every platform reports them. Rates are derived. */
export interface MetricCounts {
  views: number;
  reach: number;
  nonFollowerReach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  follows: number;
  profileVisits: number;
  linkClicks: number;
  videoAvgWatchSeconds: number | null;
}

export interface Post {
  id: string;
  platform: Platform;
  externalId: string;
  permalink: string | null;
  format: PostFormat;
  publishedAt: string;
  caption: string | null;
  thumbnailUrl: string | null;
  hashtags: string[];
  /** Primary pillar. Null when unclassified. */
  pillarId: string | null;
  /** Every pillar on the post, primary included. */
  pillarIds: string[];
  /** Classifier confidence for the primary pillar, 0..1. */
  confidence: number | null;
  classifiedBy: 'auto' | 'manual' | null;
  /** Lifetime totals, summed from the daily snapshots. */
  totals: MetricCounts;
  /**
   * Totals over the post's first `MATURITY_DAYS` days only.
   *
   * This is what every comparison chart uses, and it is the whole reason
   * the daily snapshots exist. Comparing a post published last year
   * against one published on Tuesday by lifetime totals rewards age, not
   * quality. Null while the post is still younger than that window, and
   * those posts are excluded from comparisons and counted out loud.
   */
  maturedTotals: MetricCounts | null;
  /**
   * Whole days since publication, fixed at request time on the server.
   *
   * Not derived in a component: `Date.now()` during render is impure and
   * gives a different answer on the server than in the browser, which
   * shows up as a hydration mismatch at a date boundary.
   */
  ageDays: number;
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  startsOn: string;
  endsOn: string;
  goalMetric: string | null;
  goalValue: number | null;
  accentSlot: ColorSlot;
  notes: string | null;
  pillarIds: string[];
}

/** One day of account-level figures. */
export interface AccountDay extends MetricCounts {
  date: string;
  accountsEngaged: number;
  unfollows: number;
  followersTotal: number;
}

export interface DateRange {
  from: string;
  to: string;
  /** Equal-length window immediately before `from`, for % change. */
  prevFrom: string;
  prevTo: string;
  days: number;
  label: string;
}

/**
 * Everything one render of the dashboard needs. Assembled once on the
 * server so no panel fetches on its own.
 */
export interface SocialDashboardData {
  platform: Platform;
  range: DateRange;
  /** True when the figures are seeded test data, not a live account. */
  isSample: boolean;
  /** The account's own posting timezone. Drives the "when to post" grid. */
  timeZone: string;
  posts: Post[];
  prevPosts: Post[];
  pillars: Pillar[];
  campaigns: Campaign[];
  accountDays: AccountDay[];
  prevAccountDays: AccountDay[];
}
