import { COMPARISON_METRIC_IDS, METRICS, sumPosts } from './metrics';
import type { Post } from './types';

/**
 * What the hashtags are actually worth.
 *
 * The tags were being collected from day one and shown nowhere, which
 * is the worst of both worlds: the cost of storing them with none of
 * the answer they contain.
 *
 * Measured the same way as pillars and for the same reason: per post
 * reached, never by totals. A tag used on forty posts will beat one
 * used on four on any total, which tells you about habit and nothing
 * about the tag. The post count sits beside every row so a tag with
 * three posts behind it reads as the hint it is.
 *
 * Takes posts that have ALREADY been put on the chosen comparison basis
 * by the caller. It used to apply the maturity filter again itself,
 * which silently emptied the panel whenever the caller had handed it
 * lifetime figures: nothing on that basis carries a maturity total, so
 * the second filter threw every post away and the panel reported zero
 * tags on an account full of them.
 */

/** Below this a tag is noise, not a finding. */
export const MIN_POSTS = 3;

/** Keeps the panel readable; the table shows the rest in order. */
export const TOP_N = 15;

export interface HashtagRow {
  tag: string;
  posts: number;
  reach: number;
  value: number | null;
  table: Record<string, number | null>;
}

export interface HashtagVM {
  /** metric id -> rows, best first. */
  byMetric: Record<string, HashtagRow[]>;
  /** Distinct tags seen, including the ones below the threshold. */
  distinct: number;
  /** Posts in the window carrying no tag at all. */
  untagged: number;
  minPosts: number;
}

const TABLE_METRICS = ['saveRate', 'shareRate', 'engagementRate', 'profileVisitRate'];

export function hashtagVM(posts: Post[], minPosts = MIN_POSTS): HashtagVM {
  const ready = posts;

  const byTag = new Map<string, Post[]>();
  let untagged = 0;

  for (const post of ready) {
    // Normalised here, not at the point of storage: the connector
    // strips the hash while the seeded sample data keeps it, and a
    // panel that renders "##yoga" for one of them is a bug waiting on
    // whichever source is loaded.
    const tags = [...new Set(
      post.hashtags
        .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
        .filter(Boolean),
    )];
    if (tags.length === 0) { untagged += 1; continue; }
    for (const tag of tags) {
      const list = byTag.get(tag);
      if (list) list.push(post);
      else byTag.set(tag, [post]);
    }
  }

  const eligible = [...byTag.entries()].filter(([, list]) => list.length >= minPosts);
  const byMetric: HashtagVM['byMetric'] = {};

  for (const metricId of COMPARISON_METRIC_IDS) {
    byMetric[metricId] = eligible
      .map(([tag, list]) => {
        const counts = sumPosts(list);
        const table: Record<string, number | null> = {};
        for (const id of TABLE_METRICS) table[id] = METRICS[id].compute(counts);
        return {
          tag,
          posts: list.length,
          reach: counts.reach,
          value: METRICS[metricId].compute(counts),
          table,
        };
      })
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }

  return { byMetric, distinct: byTag.size, untagged, minPosts };
}
