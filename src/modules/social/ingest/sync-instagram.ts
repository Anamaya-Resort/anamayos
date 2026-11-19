import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import {
  DEMOGRAPHIC_DIMENSIONS, breakdownInsight, followerDemographics, listMedia,
  tolerantInsights, type IgMedia,
} from '@/lib/meta/instagram';
import { resolveAccount } from './account';
import { loadPillarRules } from './rules';
import { snapshotMedia } from './snapshot';
import { cacheThumbnails } from './thumbnails';
import { writeAccountDay, writeDemographics } from './upsert';

/**
 * The nightly Instagram pull: recent posts, their figures as of today,
 * the account's own day, and who is following.
 *
 * Safe to run twice. Nothing here assumes it is the first run, the only
 * run, or that it will be allowed to finish: it works newest-first,
 * keeps to a time budget, and writes as it goes, so a run cut short
 * leaves correct data for what it did reach.
 */

/** How far back a routine run looks for posts that still move. */
const DEFAULT_WINDOW_DAYS = 45;

/** Leaves room to finish writing before the platform kills the function. */
const TIME_BUDGET_MS = 240_000;

const ACCOUNT_METRICS = [
  'reach', 'views', 'accounts_engaged', 'total_interactions',
  'profile_views', 'profile_links_taps',
];

export interface SyncResult {
  connected: boolean;
  handle?: string;
  accountId?: string;
  postsSeen: number;
  postsWritten: number;
  pillarsWritten: number;
  metricRowsWritten: number;
  accountDayWritten: boolean;
  demographicRowsWritten: number;
  thumbnailsCached: number;
  /** Metrics Instagram refused, so the next run can stop asking. */
  droppedMetrics: string[];
  /** True when the time budget ended the run before every post was read. */
  truncated: boolean;
  errors: string[];
}

export async function syncInstagram(
  opts: { windowDays?: number; maxPosts?: number } = {},
): Promise<SyncResult> {
  const result: SyncResult = {
    connected: false, postsSeen: 0, postsWritten: 0, pillarsWritten: 0,
    metricRowsWritten: 0, accountDayWritten: false, demographicRowsWritten: 0,
    thumbnailsCached: 0, droppedMetrics: [], truncated: false, errors: [],
  };

  const sb = createServiceClient();
  const account = await resolveAccount(sb);
  if (!account) return result;

  result.connected = true;
  result.handle = account.user.username ?? undefined;
  result.accountId = account.accountId;

  const deadline = Date.now() + TIME_BUDGET_MS;
  const { token, igUserId, accountId, today } = account;

  // ---- posts -------------------------------------------------
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString();

  let media: IgMedia[] = [];
  try {
    media = await listMedia(token, igUserId, since, opts.maxPosts ?? 600);
  } catch (e) {
    result.errors.push(`Could not list posts: ${(e as Error).message}`);
    return result;
  }
  result.postsSeen = media.length;

  const rules = await loadPillarRules(sb);
  const snap = await snapshotMedia(sb, {
    token, accountId, media, today, rules,
    pillarIdBySlug: account.pillarIdBySlug, deadline,
  });

  result.postsWritten = snap.postsWritten;
  result.pillarsWritten = snap.pillarsWritten;
  result.metricRowsWritten = snap.metricRowsWritten;
  result.droppedMetrics = snap.droppedMetrics;
  result.truncated = snap.truncated;
  result.errors.push(...snap.errors);

  // ---- thumbnails ---------------------------------------------
  // Instagram's image URLs expire within days, so a copy is kept. Done
  // after the figures: numbers are the point of the page and pictures
  // are not worth spending the time budget before them.
  try {
    const thumbs = await cacheThumbnails(sb, accountId, { deadline });
    result.thumbnailsCached = thumbs.cached;
  } catch (e) {
    result.errors.push(`Thumbnails: ${(e as Error).message}`);
  }

  // ---- account day -------------------------------------------
  try {
    const { values } = await tolerantInsights(
      token, `${igUserId}/insights`, ACCOUNT_METRICS,
      { period: 'day', metric_type: 'total_value' },
    );

    const byFollowType = await breakdownInsight(
      token, `${igUserId}/insights`, 'reach', 'follow_type', { period: 'day' },
    );

    // Meta splits follows and unfollows inside one metric. The exact
    // dimension labels have changed before, so anything that reads as
    // an unfollow is treated as one and the rest count as follows.
    const followSplit = await breakdownInsight(
      token, `${igUserId}/insights`, 'follows_and_unfollows', 'follow_type',
      { period: 'day' },
    );
    let follows = 0;
    let unfollows = 0;
    for (const [key, value] of Object.entries(followSplit)) {
      if (key.includes('UNFOLLOW')) unfollows += value;
      else follows += value;
    }

    await writeAccountDay(sb, {
      account_id: accountId,
      metric_date: today,
      views: values.views ?? 0,
      reach: values.reach ?? 0,
      non_follower_reach: byFollowType.NON_FOLLOWER ?? 0,
      accounts_engaged: values.accounts_engaged ?? 0,
      profile_visits: values.profile_views ?? 0,
      link_clicks: values.profile_links_taps ?? 0,
      follows,
      unfollows,
      followers_total: account.user.followersCount,
    });
    result.accountDayWritten = true;
  } catch (e) {
    result.errors.push(`Account metrics: ${(e as Error).message}`);
  }

  // ---- audience ----------------------------------------------
  // A lifetime picture of who follows, snapshotted rather than
  // differenced. Instagram withholds it below roughly a hundred
  // followers and caps each dimension at its top entries, so an empty
  // dimension is normal and is recorded as empty rather than retried.
  for (const dimension of DEMOGRAPHIC_DIMENSIONS) {
    if (Date.now() > deadline) { result.truncated = true; break; }
    try {
      const buckets = await followerDemographics(token, igUserId, dimension);
      result.demographicRowsWritten +=
        await writeDemographics(sb, accountId, today, dimension, buckets);
    } catch (e) {
      result.errors.push(`Audience ${dimension}: ${(e as Error).message}`);
    }
  }

  return result;
}
