import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { EMPTY_COUNTS, sumCounts } from './metrics';
import type { MetricCounts, Platform, PostDay, PostDetail, PostFormat } from './types';

/**
 * One post, day by day.
 *
 * The rest of the dashboard sums the daily snapshots away; this is the
 * only place that shows them as they are stored. It answers the
 * question a ranked table cannot: did this post do its work in two days
 * and stop, or is it still being found months later. Those two posts
 * look identical on any lifetime total and mean completely different
 * things for what to make next.
 */

export async function getPostDetail(postId: string): Promise<PostDetail | null> {
  const sb = createServiceClient();

  const { data: post } = await sb
    .from('social_posts')
    .select('id, platform, external_id, permalink, thumbnail_url, format, published_at, caption, hashtags')
    .eq('id', postId)
    .maybeSingle();
  if (!post) return null;

  const [{ data: metricRows }, { data: links }] = await Promise.all([
    sb.from('social_post_metrics_daily')
      .select('metric_date, views, reach, non_follower_reach, likes, comments, saves, shares, follows, profile_visits, link_clicks, video_avg_watch_seconds')
      .eq('post_id', postId)
      .order('metric_date', { ascending: true }),
    sb.from('post_pillars')
      .select('is_primary, content_pillars(name)')
      .eq('post_id', postId),
  ]);

  const publishedAt = post.published_at as string;

  const days: PostDay[] = (metricRows ?? []).map((r) => ({
    date: r.metric_date as string,
    dayOffset: Math.floor(
      (Date.parse(`${r.metric_date}T00:00:00Z`) - Date.parse(publishedAt)) / 86400000,
    ),
    views: r.views, reach: r.reach, nonFollowerReach: r.non_follower_reach,
    likes: r.likes, comments: r.comments, saves: r.saves, shares: r.shares,
    follows: r.follows, profileVisits: r.profile_visits, linkClicks: r.link_clicks,
    videoAvgWatchSeconds: r.video_avg_watch_seconds,
  }));

  // Primary pillar first, so the heading reads the way the table does.
  const pillarNames = (links ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((l) => {
      const joined = l.content_pillars as { name?: string } | { name?: string }[] | null;
      return (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? null;
    })
    .filter((n): n is string => !!n);

  return {
    id: post.id as string,
    platform: post.platform as Platform,
    externalId: post.external_id as string,
    permalink: post.permalink as string | null,
    thumbnailUrl: post.thumbnail_url as string | null,
    format: post.format as PostFormat,
    publishedAt,
    caption: post.caption as string | null,
    hashtags: (post.hashtags as string[] | null) ?? [],
    pillarNames,
    ageDays: Math.floor((Date.now() - Date.parse(publishedAt)) / 86400000),
    totals: days.length
      ? sumCounts(days.map((d) => d as MetricCounts))
      : { ...EMPTY_COUNTS },
    days,
  };
}
