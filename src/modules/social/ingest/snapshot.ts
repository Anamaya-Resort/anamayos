import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GraphError } from '@/lib/meta/graph';
import { tolerantInsights, type IgMedia } from '@/lib/meta/instagram';
import { classifyPost, extractHashtags, type CompiledRules } from './classify';
import {
  emptyCounters, priorTotals, upsertPosts, writePillarLinks, writePostDays,
  type PostDayRow,
} from './upsert';

/**
 * Turning a list of Instagram media into stored posts and one day of
 * figures. Shared by the nightly post sync and the frequent stories
 * sync, because the two differ only in what they fetch.
 *
 * The metric lists below are supersets. Instagram refuses a whole
 * insights request when one metric in it does not apply to that media
 * type, and the valid list differs per type and has changed more than
 * once. Asking for too much and dropping what comes back refused is the
 * only shape that survives those changes without a code edit.
 */

export const POST_METRICS: Record<string, string[]> = {
  reel: ['views', 'reach', 'likes', 'comments', 'saved', 'shares',
    'total_interactions', 'ig_reels_avg_watch_time'],
  story: ['views', 'reach', 'shares', 'follows', 'profile_visits', 'link_clicks',
    'replies', 'navigation'],
  default: ['views', 'reach', 'likes', 'comments', 'saved', 'shares',
    'follows', 'profile_visits', 'total_interactions'],
};

export function formatOf(media: IgMedia): string {
  const product = (media.mediaProductType ?? '').toUpperCase();
  if (product === 'REELS') return 'reel';
  if (product === 'STORY') return 'story';
  const type = (media.mediaType ?? '').toUpperCase();
  if (type === 'CAROUSEL_ALBUM') return 'carousel';
  if (type === 'VIDEO') return 'video';
  return 'image';
}

/** Runs `work` over `items` a few at a time. */
export async function pool<T, R>(
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

export interface SnapshotOutcome {
  postsWritten: number;
  pillarsWritten: number;
  metricRowsWritten: number;
  droppedMetrics: string[];
  truncated: boolean;
  errors: string[];
}

/**
 * Stores the media, classifies them, and records today's increment.
 *
 * Today's row is the platform's lifetime total minus what earlier days
 * already hold; see the note in `upsert.ts` for why that subtraction is
 * the whole game.
 */
export async function snapshotMedia(
  sb: SupabaseClient,
  opts: {
    token: string;
    accountId: string;
    media: IgMedia[];
    today: string;
    rules: CompiledRules;
    pillarIdBySlug: Map<string, string>;
    deadline: number;
    /** Stories are classified but their pillar tags are rarely useful. */
    classify?: boolean;
  },
): Promise<SnapshotOutcome> {
  const out: SnapshotOutcome = {
    postsWritten: 0, pillarsWritten: 0, metricRowsWritten: 0,
    droppedMetrics: [], truncated: false, errors: [],
  };
  if (opts.media.length === 0) return out;

  const seeds = opts.media.map((m) => ({
    externalId: m.id,
    permalink: m.permalink,
    format: formatOf(m),
    publishedAt: m.timestamp,
    caption: m.caption,
    thumbnailUrl: m.thumbnailUrl,
    hashtags: extractHashtags(m.caption),
  }));

  const idByExternal = await upsertPosts(sb, opts.accountId, 'instagram', seeds);
  out.postsWritten = idByExternal.size;

  if (opts.classify !== false) {
    for (const m of opts.media) {
      const postId = idByExternal.get(m.id);
      if (!postId) continue;
      const { slugs, confidence } = classifyPost(
        m.caption, extractHashtags(m.caption), opts.rules,
      );
      if (slugs.length === 0) continue;
      if (await writePillarLinks(sb, postId, slugs, confidence, opts.pillarIdBySlug)) {
        out.pillarsWritten += 1;
      }
    }
  }

  const prior = await priorTotals(sb, [...idByExternal.values()], opts.today);
  const dropped = new Map<string, Set<string>>();
  const rows: PostDayRow[] = [];

  await pool(opts.media, 4, async (m) => {
    if (Date.now() > opts.deadline) { out.truncated = true; return; }
    const postId = idByExternal.get(m.id);
    if (!postId) return;

    const format = formatOf(m);
    const bad = dropped.get(format) ?? new Set<string>();
    const wanted = (POST_METRICS[format] ?? POST_METRICS.default)
      .filter((metric) => !bad.has(metric));

    let values: Record<string, number> = {};
    try {
      const got = await tolerantInsights(opts.token, `${m.id}/insights`, wanted);
      values = got.values;
      if (got.rejected.length > 0) {
        for (const r of got.rejected) bad.add(r);
        dropped.set(format, bad);
      }
    } catch (e) {
      if (e instanceof GraphError && e.isAuthFailure) throw e;
      out.errors.push(`Insights for ${m.id}: ${(e as Error).message}`);
      return;
    }

    const lifetime = emptyCounters();
    lifetime.views = values.views ?? 0;
    lifetime.reach = values.reach ?? 0;
    lifetime.likes = values.likes ?? m.likeCount ?? 0;
    lifetime.comments = values.comments ?? values.replies ?? m.commentsCount ?? 0;
    lifetime.saves = values.saved ?? 0;
    lifetime.shares = values.shares ?? 0;
    lifetime.follows = values.follows ?? 0;
    lifetime.profile_visits = values.profile_visits ?? 0;
    lifetime.link_clicks = values.link_clicks ?? 0;

    const before = prior.get(postId) ?? emptyCounters();
    const row = { post_id: postId, metric_date: opts.today } as PostDayRow;
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
    for (const metric of set) out.droppedMetrics.push(`${format}:${metric}`);
  }

  try {
    out.metricRowsWritten = await writePostDays(sb, rows);
  } catch (e) {
    out.errors.push((e as Error).message);
  }

  return out;
}
