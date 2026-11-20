import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Every database write the connectors make. Kept apart from the
 * Instagram-specific fetching so a second network is a new fetcher and
 * not a second copy of this.
 *
 * The important rule lives in `priorTotals` and its callers: the daily
 * metric tables hold PER-DAY INCREMENTS that sum to a lifetime total,
 * while every platform API hands back the lifetime total as of now. A
 * connector that writes the API's number straight into today's row
 * makes the dashboard count the same view once per day forever. Today's
 * row is therefore always lifetime-minus-what-earlier-days-already-hold,
 * which also makes a re-run inside the same day idempotent.
 */

export interface AccountSeed {
  platform: string;
  externalId: string;
  handle: string | null;
  label: string | null;
  timezone: string;
}

/**
 * The real account row, created on first sync.
 *
 * Only ever touches the row for this exact external id, so the seeded
 * sample account beside it is left intact. The dashboard prefers a
 * non-sample account on its own, so real data displaces the sample the
 * moment this row exists and the sample stays available as a fallback.
 */
export async function ensureAccount(
  sb: SupabaseClient, seed: AccountSeed,
): Promise<string> {
  const { data: existing } = await sb
    .from('social_accounts')
    .select('id')
    .eq('platform', seed.platform)
    .eq('external_id', seed.externalId)
    .maybeSingle();

  if (existing?.id) {
    // Handle and label can change on Instagram; timezone is left alone
    // because an admin may have corrected it by hand.
    await sb.from('social_accounts')
      .update({ handle: seed.handle, label: seed.label, is_active: true })
      .eq('id', existing.id);
    return existing.id as string;
  }

  const { data, error } = await sb
    .from('social_accounts')
    .insert({
      platform: seed.platform,
      external_id: seed.externalId,
      handle: seed.handle,
      label: seed.label,
      timezone: seed.timezone,
      is_active: true,
      is_sample: false,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Could not create the account row: ${error.message}`);
  return data.id as string;
}

export interface PostSeed {
  externalId: string;
  permalink: string | null;
  format: string;
  publishedAt: string;
  caption: string | null;
  thumbnailUrl: string | null;
  hashtags: string[];
}

/** Upserts posts and returns external id -> internal id for all of them. */
/**
 * Marks a thumbnail that already lives in our own bucket.
 *
 * Kept as a plain string rather than imported from the thumbnail module
 * so this file stays free of anything that touches storage.
 */
const CACHED_THUMB = '/storage/v1/object/public/social-thumbs/';

/**
 * The thumbnails we have already copied, keyed by the post's id on the
 * platform.
 *
 * Instagram hands back a freshly signed CDN URL on every sync. Writing
 * that over a cached one undoes the copy, so each run would re-cache the
 * same newest batch for ever and older posts would never converge.
 */
async function cachedThumbs(
  sb: SupabaseClient, platform: string, externalIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const CHUNK = 200;

  for (let i = 0; i < externalIds.length; i += CHUNK) {
    const { data } = await sb
      .from('social_posts')
      .select('external_id, thumbnail_url')
      .eq('platform', platform)
      .in('external_id', externalIds.slice(i, i + CHUNK));

    for (const row of data ?? []) {
      const url = row.thumbnail_url as string | null;
      if (url && url.includes(CACHED_THUMB)) out.set(row.external_id as string, url);
    }
  }

  return out;
}

export async function upsertPosts(
  sb: SupabaseClient, accountId: string, platform: string, seeds: PostSeed[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (seeds.length === 0) return ids;

  const kept = await cachedThumbs(sb, platform, seeds.map((p) => p.externalId));

  const CHUNK = 200;
  for (let i = 0; i < seeds.length; i += CHUNK) {
    const batch = seeds.slice(i, i + CHUNK).map((p) => ({
      account_id: accountId,
      platform,
      external_id: p.externalId,
      permalink: p.permalink,
      format: p.format,
      published_at: p.publishedAt,
      caption: p.caption,
      thumbnail_url: kept.get(p.externalId) ?? p.thumbnailUrl,
      hashtags: p.hashtags,
      is_sample: false,
    }));

    const { data, error } = await sb
      .from('social_posts')
      .upsert(batch, { onConflict: 'platform,external_id' })
      .select('id, external_id');

    if (error) throw new Error(`Could not save posts: ${error.message}`);
    for (const row of data ?? []) ids.set(row.external_id as string, row.id as string);
  }

  return ids;
}

/**
 * Writes the classifier's pillars for a post.
 *
 * A post anyone has touched by hand is left exactly as it is: `source`
 * is 'manual' on those rows, and a human decision outranks a keyword
 * match permanently. Everything else is replaced rather than merged, so
 * improving the classifier actually re-tags the back catalogue.
 */
export async function writePillarLinks(
  sb: SupabaseClient,
  postId: string,
  slugs: string[],
  confidence: number | null,
  pillarIdBySlug: Map<string, string>,
): Promise<boolean> {
  const { data: existing } = await sb
    .from('post_pillars')
    .select('pillar_id, source, is_primary')
    .eq('post_id', postId);

  const rowsNow = existing ?? [];
  if (rowsNow.some((r) => r.source === 'manual')) return false;

  const ids = slugs.map((s) => pillarIdBySlug.get(s)).filter((v): v is string => !!v);
  if (ids.length === 0) return false;

  // Nothing to do when the classifier reached the same answer as last
  // night, which is the usual case. Without this every post in the
  // window is deleted and re-inserted on every run.
  const before = new Set(rowsNow.map((r) => String(r.pillar_id)));
  const primaryNow = rowsNow.find((r) => r.is_primary)?.pillar_id;
  const unchanged = before.size === ids.length
    && ids.every((id) => before.has(id))
    && primaryNow === ids[0];
  if (unchanged) return false;

  // Cleared first: the one-primary-per-post index rejects a second
  // primary row, so an in-place upsert would fail whenever the winning
  // pillar changed.
  await sb.from('post_pillars').delete().eq('post_id', postId);

  const rows = ids.map((pillarId, i) => ({
    post_id: postId,
    pillar_id: pillarId,
    is_primary: i === 0,
    confidence: i === 0 ? confidence : null,
    source: 'auto',
  }));

  const { error } = await sb.from('post_pillars').insert(rows);
  return !error;
}

/** The ten counters the daily post table holds, by column name. */
export const POST_COUNTERS = [
  'views', 'reach', 'non_follower_reach', 'likes', 'comments',
  'saves', 'shares', 'follows', 'profile_visits', 'link_clicks',
] as const;

export type PostCounters = Record<(typeof POST_COUNTERS)[number], number>;

export const emptyCounters = (): PostCounters =>
  Object.fromEntries(POST_COUNTERS.map((k) => [k, 0])) as PostCounters;

/**
 * What every day BEFORE `today` already holds, per post.
 *
 * Subtracting this from the platform's lifetime total is what turns a
 * running total back into today's increment. Rows dated today are
 * excluded on purpose so a second run in the same day overwrites its
 * own earlier row instead of stacking on it.
 */
export async function priorTotals(
  sb: SupabaseClient, postIds: string[], today: string,
): Promise<Map<string, PostCounters>> {
  const out = new Map<string, PostCounters>();
  if (postIds.length === 0) return out;

  const CHUNK = 300;
  const PAGE = 1000;

  for (let i = 0; i < postIds.length; i += CHUNK) {
    const slice = postIds.slice(i, i + CHUNK);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('social_post_metrics_daily')
        .select(`post_id, ${POST_COUNTERS.join(', ')}`)
        .in('post_id', slice)
        .lt('metric_date', today)
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`Could not read earlier metrics: ${error.message}`);
      const rows = (data ?? []) as unknown as Array<Record<string, number | string>>;

      for (const row of rows) {
        const key = String(row.post_id);
        const acc = out.get(key) ?? emptyCounters();
        for (const c of POST_COUNTERS) acc[c] += Number(row[c] ?? 0);
        out.set(key, acc);
      }

      if (rows.length < PAGE) break;
    }
  }

  return out;
}

export interface PostDayRow extends PostCounters {
  post_id: string;
  metric_date: string;
  video_avg_watch_seconds: number | null;
}

/** Writes today's increment rows. */
export async function writePostDays(
  sb: SupabaseClient, rows: PostDayRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const CHUNK = 300;
  let written = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb
      .from('social_post_metrics_daily')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'post_id,metric_date' });
    if (error) throw new Error(`Could not save post metrics: ${error.message}`);
    written += Math.min(CHUNK, rows.length - i);
  }

  return written;
}

/**
 * Writes the account's own day.
 *
 * Unlike post metrics these arrive from the platform already scoped to
 * a single day, so they are stored as given. `followers_total` is the
 * exception and is a running total by nature; the dashboard reads it as
 * a level, never summing it.
 */
export async function writeAccountDay(
  sb: SupabaseClient, row: Record<string, string | number>,
): Promise<void> {
  const { error } = await sb
    .from('social_account_metrics_daily')
    .upsert(row, { onConflict: 'account_id,metric_date' });
  if (error) throw new Error(`Could not save account metrics: ${error.message}`);
}

/**
 * Replaces one day's audience breakdown for one dimension.
 *
 * Deleted then inserted rather than upserted: a bucket that has emptied
 * out (a city that fell off the top list) must disappear, and an upsert
 * would leave yesterday's row behind to be read as today's answer.
 */
export async function writeDemographics(
  sb: SupabaseClient,
  accountId: string,
  metricDate: string,
  dimension: string,
  buckets: Record<string, number>,
): Promise<number> {
  const rows = Object.entries(buckets)
    .filter(([bucket, value]) => bucket && Number.isFinite(value))
    .map(([bucket, value]) => ({
      account_id: accountId,
      metric_date: metricDate,
      dimension,
      bucket,
      value,
      is_sample: false,
    }));

  await sb.from('social_audience_demographics')
    .delete()
    .eq('account_id', accountId)
    .eq('metric_date', metricDate)
    .eq('dimension', dimension);

  if (rows.length === 0) return 0;

  const { error } = await sb.from('social_audience_demographics').insert(rows);
  if (error) throw new Error(`Could not save audience demographics: ${error.message}`);
  return rows.length;
}
