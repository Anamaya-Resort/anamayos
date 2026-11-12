import { createServiceClient } from '@/lib/supabase/server';
import { EMPTY_COUNTS, sumCounts } from './metrics';
import type {
  AccountDay, Campaign, ColorSlot, DateRange, MetricCounts, Pillar, Platform,
  Post, PostFormat, SocialDashboardData,
} from './types';

/**
 * Every read for the social dashboard.
 *
 * Two things in here are load-bearing and easy to break:
 *
 * 1. EVERY query paginates explicitly. PostgREST silently caps a result
 *    at 1,000 rows and returns no error, so an unpaginated read of a
 *    daily-snapshot table looks like it works and quietly truncates once
 *    the data grows. `allRows` below is the only way these tables are
 *    read. A year of posts snapshotted daily is already past that cap.
 *
 * 2. COMPARISONS USE THE MATURITY WINDOW, not lifetime totals. See the
 *    note on `Post.maturedTotals`.
 */

/** Days of a post's life that count toward a fair comparison. */
export const MATURITY_DAYS = 7;

const PAGE = 1000;

async function allRows<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** A window plus the equal-length window immediately before it. */
export function buildRange(days: number, label: string, today = new Date()): DateRange {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return {
    from: iso(from), to: iso(to),
    prevFrom: iso(prevFrom), prevTo: iso(prevTo),
    days, label,
  };
}

interface PostRow {
  id: string; platform: string; external_id: string; permalink: string | null;
  format: string; published_at: string; caption: string | null;
  thumbnail_url: string | null; hashtags: string[] | null;
}
interface PillarLinkRow {
  post_id: string; pillar_id: string; is_primary: boolean;
  confidence: number | null; source: string;
}
interface MetricRow {
  post_id: string; metric_date: string;
  views: number; reach: number; non_follower_reach: number; likes: number;
  comments: number; saves: number; shares: number; follows: number;
  profile_visits: number; link_clicks: number;
  video_avg_watch_seconds: number | null;
}

const toCounts = (r: MetricRow): MetricCounts => ({
  views: r.views, reach: r.reach, nonFollowerReach: r.non_follower_reach,
  likes: r.likes, comments: r.comments, saves: r.saves, shares: r.shares,
  follows: r.follows, profileVisits: r.profile_visits, linkClicks: r.link_clicks,
  videoAvgWatchSeconds: r.video_avg_watch_seconds,
});

const dayOffset = (publishedAt: string, metricDate: string): number =>
  Math.floor(
    (Date.parse(`${metricDate}T00:00:00Z`) - Date.parse(publishedAt)) / 86400000,
  );

/**
 * Posts published in [from, to], with pillars attached and both the
 * lifetime and maturity-window totals computed.
 */
async function loadPosts(
  accountId: string, from: string, to: string, now: Date,
): Promise<Post[]> {
  const supabase = createServiceClient();

  const postRows = await allRows<PostRow>((a, b) =>
    supabase
      .from('social_posts')
      .select('id, platform, external_id, permalink, format, published_at, caption, thumbnail_url, hashtags')
      .eq('account_id', accountId)
      .gte('published_at', `${from}T00:00:00Z`)
      .lte('published_at', `${to}T23:59:59Z`)
      .order('published_at', { ascending: false })
      .range(a, b),
  );
  if (postRows.length === 0) return [];

  const ids = postRows.map((p) => p.id);

  const [links, metrics] = await Promise.all([
    allRows<PillarLinkRow>((a, b) =>
      supabase
        .from('post_pillars')
        .select('post_id, pillar_id, is_primary, confidence, source')
        .in('post_id', ids)
        .range(a, b),
    ),
    allRows<MetricRow>((a, b) =>
      supabase
        .from('social_post_metrics_daily')
        .select('post_id, metric_date, views, reach, non_follower_reach, likes, comments, saves, shares, follows, profile_visits, link_clicks, video_avg_watch_seconds')
        .in('post_id', ids)
        .range(a, b),
    ),
  ]);

  const byPost = new Map<string, MetricRow[]>();
  for (const m of metrics) {
    const list = byPost.get(m.post_id);
    if (list) list.push(m);
    else byPost.set(m.post_id, [m]);
  }

  const linksByPost = new Map<string, PillarLinkRow[]>();
  for (const l of links) {
    const list = linksByPost.get(l.post_id);
    if (list) list.push(l);
    else linksByPost.set(l.post_id, [l]);
  }

  return postRows.map((p) => {
    const rows = byPost.get(p.id) ?? [];
    const mine = linksByPost.get(p.id) ?? [];
    const primary = mine.find((l) => l.is_primary) ?? null;
    const ageDays = Math.floor((now.getTime() - Date.parse(p.published_at)) / 86400000);
    const matured = rows.filter((r) => {
      const off = dayOffset(p.published_at, r.metric_date);
      return off >= 0 && off < MATURITY_DAYS;
    });
    return {
      id: p.id,
      platform: p.platform as Platform,
      externalId: p.external_id,
      permalink: p.permalink,
      format: p.format as PostFormat,
      publishedAt: p.published_at,
      caption: p.caption,
      thumbnailUrl: p.thumbnail_url,
      hashtags: p.hashtags ?? [],
      pillarId: primary?.pillar_id ?? null,
      pillarIds: mine.map((l) => l.pillar_id),
      confidence: primary?.confidence ?? null,
      classifiedBy: (primary?.source as 'auto' | 'manual' | undefined) ?? null,
      totals: rows.length ? sumCounts(rows.map(toCounts)) : { ...EMPTY_COUNTS },
      maturedTotals:
        ageDays >= MATURITY_DAYS && matured.length
          ? sumCounts(matured.map(toCounts))
          : null,
      ageDays,
    };
  });
}

interface AccountDayRow {
  metric_date: string; views: number; reach: number; non_follower_reach: number;
  accounts_engaged: number; profile_visits: number; link_clicks: number;
  follows: number; unfollows: number; followers_total: number;
}

async function loadAccountDays(
  accountId: string, from: string, to: string,
): Promise<AccountDay[]> {
  const supabase = createServiceClient();
  const rows = await allRows<AccountDayRow>((a, b) =>
    supabase
      .from('social_account_metrics_daily')
      .select('metric_date, views, reach, non_follower_reach, accounts_engaged, profile_visits, link_clicks, follows, unfollows, followers_total')
      .eq('account_id', accountId)
      .gte('metric_date', from)
      .lte('metric_date', to)
      .order('metric_date', { ascending: true })
      .range(a, b),
  );
  return rows.map((r) => ({
    date: r.metric_date,
    views: r.views, reach: r.reach, nonFollowerReach: r.non_follower_reach,
    likes: 0, comments: 0, saves: 0, shares: 0,
    follows: r.follows, profileVisits: r.profile_visits, linkClicks: r.link_clicks,
    videoAvgWatchSeconds: null,
    accountsEngaged: r.accounts_engaged,
    unfollows: r.unfollows,
    followersTotal: r.followers_total,
  }));
}

/** Everything one render needs, in one call. */
export async function getSocialDashboard(
  platform: Platform, range: DateRange,
): Promise<SocialDashboardData | null> {
  const supabase = createServiceClient();
  const now = new Date();

  const { data: account } = await supabase
    .from('social_accounts')
    .select('id, is_sample, timezone')
    .eq('platform', platform)
    .eq('is_active', true)
    .order('is_sample', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) return null;

  const [pillarRows, campaignRows, campaignLinks, posts, prevPosts, days, prevDays] =
    await Promise.all([
      supabase.from('content_pillars')
        .select('id, slug, name, color_slot, sort_order')
        .eq('is_active', true).order('sort_order'),
      supabase.from('social_campaigns')
        .select('id, name, slug, starts_on, ends_on, goal_metric, goal_value, accent_slot, notes')
        .order('starts_on', { ascending: false }),
      supabase.from('social_campaign_pillars').select('campaign_id, pillar_id'),
      loadPosts(account.id, range.from, range.to, now),
      loadPosts(account.id, range.prevFrom, range.prevTo, now),
      loadAccountDays(account.id, range.from, range.to),
      loadAccountDays(account.id, range.prevFrom, range.prevTo),
    ]);

  const links = (campaignLinks.data ?? []) as Array<{ campaign_id: string; pillar_id: string }>;

  const pillars: Pillar[] = ((pillarRows.data ?? []) as Array<{
    id: string; slug: string; name: string; color_slot: number; sort_order: number;
  }>).map((p) => ({
    id: p.id, slug: p.slug, name: p.name,
    colorSlot: p.color_slot as ColorSlot, sortOrder: p.sort_order,
  }));

  const campaigns: Campaign[] = ((campaignRows.data ?? []) as Array<{
    id: string; name: string; slug: string; starts_on: string; ends_on: string;
    goal_metric: string | null; goal_value: number | null; accent_slot: number;
    notes: string | null;
  }>).map((c) => ({
    id: c.id, name: c.name, slug: c.slug,
    startsOn: c.starts_on, endsOn: c.ends_on,
    goalMetric: c.goal_metric, goalValue: c.goal_value,
    accentSlot: c.accent_slot as ColorSlot, notes: c.notes,
    pillarIds: links.filter((l) => l.campaign_id === c.id).map((l) => l.pillar_id),
  }));

  return {
    platform,
    range,
    isSample: Boolean(account.is_sample),
    timeZone: account.timezone ?? 'UTC',
    posts, prevPosts, pillars, campaigns,
    accountDays: days, prevAccountDays: prevDays,
  };
}

/** Posts inside an arbitrary window, for the campaign comparison. */
export async function getPostsBetween(
  platform: Platform, from: string, to: string,
): Promise<Post[]> {
  const supabase = createServiceClient();
  const { data: account } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('platform', platform).eq('is_active', true)
    .order('is_sample', { ascending: true })
    .limit(1).maybeSingle();
  if (!account) return [];
  return loadPosts(account.id, from, to, new Date());
}
