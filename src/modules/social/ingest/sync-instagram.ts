import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { GraphError, getMetaCredentials, storeMetaCredentials } from '@/lib/meta/graph';
import {
  breakdownInsight, discoverIgUserId, getIgUser, listMedia, tolerantInsights,
  type IgMedia,
} from '@/lib/meta/instagram';
import { classifyPost, extractHashtags } from './classify';
import {
  ensureAccount, emptyCounters, priorTotals, upsertPosts, writeAccountDay,
  writePillarLinks, writePostDays, type PostDayRow,
} from './upsert';

/**
 * Pulls one day of Instagram into the social tables.
 *
 * Designed to be run daily and to be safe to run twice. Nothing here
 * assumes it is the first run, the only run, or that it will be allowed
 * to finish: it works newest-first, keeps to a time budget, and writes
 * as it goes, so a run cut short leaves correct data for what it did
 * reach rather than a half-written day.
 */

/** Anamaya posts and reads its numbers in Costa Rica. */
const DEFAULT_TIMEZONE = 'America/Costa_Rica';

/** How far back a routine run looks for posts that still move. */
const DEFAULT_WINDOW_DAYS = 45;

/** Leaves room to finish writing before the platform kills the function. */
const TIME_BUDGET_MS = 240_000;

const POST_METRICS: Record<string, string[]> = {
  reel: ['views', 'reach', 'likes', 'comments', 'saved', 'shares',
    'total_interactions', 'ig_reels_avg_watch_time'],
  story: ['views', 'reach', 'shares', 'follows', 'profile_visits', 'link_clicks'],
  default: ['views', 'reach', 'likes', 'comments', 'saved', 'shares',
    'follows', 'profile_visits', 'total_interactions'],
};

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
  /** Metrics Instagram refused, so the next run can stop asking. */
  droppedMetrics: string[];
  /** True when the time budget ended the run before every post was read. */
  truncated: boolean;
  errors: string[];
}

/** Today's date in the account's own timezone, as YYYY-MM-DD. */
export function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatOf(media: IgMedia): string {
  const product = (media.mediaProductType ?? '').toUpperCase();
  if (product === 'REELS') return 'reel';
  if (product === 'STORY') return 'story';
  const type = (media.mediaType ?? '').toUpperCase();
  if (type === 'CAROUSEL_ALBUM') return 'carousel';
  if (type === 'VIDEO') return 'video';
  return 'image';
}

/** Runs `work` over `items` a few at a time, in order of completion. */
async function pool<T, R>(
  items: T[], size: number, work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await work(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

export async function syncInstagram(
  opts: { windowDays?: number; maxPosts?: number } = {},
): Promise<SyncResult> {
  const result: SyncResult = {
    connected: false, postsSeen: 0, postsWritten: 0, pillarsWritten: 0,
    metricRowsWritten: 0, accountDayWritten: false,
    droppedMetrics: [], truncated: false, errors: [],
  };

  const creds = await getMetaCredentials();
  if (!creds) return result;
  result.connected = true;

  const deadline = Date.now() + TIME_BUDGET_MS;
  const sb = createServiceClient();
  const token = creds.accessToken;

  let igUserId = creds.igUserId;
  if (!igUserId) {
    igUserId = await discoverIgUserId(token);
    if (!igUserId) {
      result.errors.push(
        'The token works but no Instagram Business account hangs off it. '
        + 'Save the account id in the marketing connections panel.',
      );
      return result;
    }
    await storeMetaCredentials(token, igUserId, null);
  }

  const user = await getIgUser(token, igUserId);
  result.handle = user.username ?? undefined;

  const accountId = await ensureAccount(sb, {
    platform: 'instagram',
    externalId: igUserId,
    handle: user.username,
    label: user.username ? `@${user.username}` : 'Instagram',
    timezone: DEFAULT_TIMEZONE,
  });
  result.accountId = accountId;

  const { data: accountRow } = await sb
    .from('social_accounts').select('timezone').eq('id', accountId).maybeSingle();
  const timeZone = (accountRow?.timezone as string | undefined) ?? DEFAULT_TIMEZONE;
  const today = todayIn(timeZone);

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

  const seeds = media.map((m) => {
    const hashtags = extractHashtags(m.caption);
    return {
      externalId: m.id,
      permalink: m.permalink,
      format: formatOf(m),
      publishedAt: m.timestamp,
      caption: m.caption,
      thumbnailUrl: m.thumbnailUrl,
      hashtags,
    };
  });

  const idByExternal = await upsertPosts(sb, accountId, 'instagram', seeds);
  result.postsWritten = idByExternal.size;

  // ---- pillars -----------------------------------------------
  const { data: pillarRows } = await sb
    .from('content_pillars').select('id, slug').eq('is_active', true);
  const pillarIdBySlug = new Map<string, string>(
    (pillarRows ?? []).map((p) => [p.slug as string, p.id as string]),
  );

  for (const m of media) {
    const postId = idByExternal.get(m.id);
    if (!postId) continue;
    const { slugs, confidence } = classifyPost(m.caption, extractHashtags(m.caption));
    if (slugs.length === 0) continue;
    if (await writePillarLinks(sb, postId, slugs, confidence, pillarIdBySlug)) {
      result.pillarsWritten += 1;
    }
  }

  // ---- per-post metrics --------------------------------------
  const prior = await priorTotals(sb, [...idByExternal.values()], today);
  const dropped = new Map<string, Set<string>>();
  const rows: PostDayRow[] = [];

  await pool(media, 4, async (m) => {
    if (Date.now() > deadline) { result.truncated = true; return; }
    const postId = idByExternal.get(m.id);
    if (!postId) return;

    const format = formatOf(m);
    const bad = dropped.get(format) ?? new Set<string>();
    const wanted = (POST_METRICS[format] ?? POST_METRICS.default)
      .filter((metric) => !bad.has(metric));

    let values: Record<string, number> = {};
    try {
      const got = await tolerantInsights(token, `${m.id}/insights`, wanted);
      values = got.values;
      if (got.rejected.length > 0) {
        for (const r of got.rejected) bad.add(r);
        dropped.set(format, bad);
      }
    } catch (e) {
      if (e instanceof GraphError && e.isAuthFailure) throw e;
      result.errors.push(`Insights for ${m.id}: ${(e as Error).message}`);
      return;
    }

    const lifetime = emptyCounters();
    lifetime.views = values.views ?? 0;
    lifetime.reach = values.reach ?? 0;
    lifetime.likes = values.likes ?? m.likeCount ?? 0;
    lifetime.comments = values.comments ?? m.commentsCount ?? 0;
    lifetime.saves = values.saved ?? 0;
    lifetime.shares = values.shares ?? 0;
    lifetime.follows = values.follows ?? 0;
    lifetime.profile_visits = values.profile_visits ?? 0;
    lifetime.link_clicks = values.link_clicks ?? 0;

    const before = prior.get(postId) ?? emptyCounters();
    const row = { post_id: postId, metric_date: today } as PostDayRow;
    for (const key of Object.keys(lifetime) as Array<keyof typeof lifetime>) {
      row[key] = Math.max(0, lifetime[key] - before[key]);
    }

    // Instagram reports reel watch time in milliseconds, and it is an
    // average rather than a counter, so it is stored as the level on
    // every day instead of being differenced.
    const watchMs = values.ig_reels_avg_watch_time;
    row.video_avg_watch_seconds =
      typeof watchMs === 'number' ? Math.round(watchMs / 10) / 100 : null;

    rows.push(row);
  });

  for (const [format, set] of dropped) {
    for (const metric of set) result.droppedMetrics.push(`${format}:${metric}`);
  }

  try {
    result.metricRowsWritten = await writePostDays(sb, rows);
  } catch (e) {
    result.errors.push((e as Error).message);
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
      followers_total: user.followersCount,
    });
    result.accountDayWritten = true;
  } catch (e) {
    result.errors.push(`Account metrics: ${(e as Error).message}`);
  }

  return result;
}
