import { KpiTile } from '../charts/kpi-tile';
import { onBasis } from '../aggregate';
import { METRICS, change, formatById, sumPosts } from '../metrics';
import type { SocialLabels } from '../labels';
import type { CompareBasis } from '../ranges';
import type { AccountDay, Post } from '../types';

/**
 * Panel 1: the outcome row.
 *
 * Six numbers, each against the equal-length window before it. These are
 * chosen to answer "are we winning" and nothing else, so follower count,
 * likes and impressions are all deliberately absent. Impressions no
 * longer exist as a metric at all -- Meta removed them in April 2025 and
 * `views` replaced them.
 *
 * The two rate tiles compare LIKE WITH LIKE or they do not compare at
 * all. They come from the posts rather than the account's own days,
 * because Instagram does not break engagement out per day at account
 * level, and a post keeps collecting for months. Measuring this window's
 * posts at whatever age they happen to be against last window's posts at
 * a greater age charges the newer posts for being young: the arrow then
 * reports the gap in age, not a change in the work. So on the fair basis
 * both sides are cut to each post's first seven days, and when either
 * side has nothing comparable in it the tile shows the figure and no
 * arrow at all. A missing arrow is honest; a red one that only means
 * "these posts are newer" is not.
 */

const TILES: Array<{ metricId: string; slot: number }> = [
  { metricId: 'views', slot: 1 },
  { metricId: 'reach', slot: 2 },
  { metricId: 'nonFollowerReachPct', slot: 6 },
  { metricId: 'engagementRate', slot: 3 },
  { metricId: 'saveRate', slot: 7 },
  { metricId: 'profileVisits', slot: 8 },
];

export function KpiRow({
  days, prevDays, posts, prevPosts, basis, locale, labels,
}: {
  days: AccountDay[];
  prevDays: AccountDay[];
  posts: Post[];
  prevPosts: Post[];
  basis: CompareBasis;
  locale: string;
  labels: SocialLabels;
}) {
  // Account-level days are the truth for reach and views: they
  // deduplicate people across posts, which summing posts cannot do.
  // Rates that need engagement counts come from the posts instead,
  // because the account edge does not break those out per day.
  const accountNow = sumDays(days);
  const accountPrev = sumDays(prevDays);

  // Comparable sets for the rate tiles: same basis, same exclusions,
  // both windows. `comparable` is false when either side is empty, and
  // the tile then drops its arrow rather than inventing a direction.
  const rateNow = onBasis(posts, basis);
  const ratePrev = onBasis(prevPosts, basis);
  const comparable = rateNow.length > 0 && ratePrev.length > 0;

  // The figure itself falls back to every post in the window, so it is
  // never blank just because nothing is comparable yet. Stories stay out
  // of the fallback too: they report reach but never saves, so letting
  // them in drags both rates towards zero.
  const feed = posts.filter((x) => x.format !== 'story');
  const postNow = sumPosts(rateNow.length > 0 ? rateNow : feed);
  const postPrev = sumPosts(ratePrev);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {TILES.map(({ metricId, slot }) => {
        const def = METRICS[metricId];
        const fromAccount = metricId === 'views' || metricId === 'reach'
          || metricId === 'nonFollowerReachPct' || metricId === 'profileVisits';
        const now = def.compute(fromAccount ? accountNow : postNow);
        const before = def.compute(fromAccount ? accountPrev : postPrev);
        const delta = fromAccount || comparable ? change(now, before) : null;

        const trend = fromAccount
          ? days.map((d) => def.compute(toCounts(d)) ?? 0)
          : undefined;

        return (
          <KpiTile
            key={metricId}
            label={(labels.metric[metricId] ?? String(metricId))}
            value={formatById(metricId, now, locale)}
            changePct={delta}
            higherIsBetter={def.higherIsBetter}
            trend={trend}
            colorSlot={slot}
            labels={labels.kpiDir}
          />
        );
      })}
    </div>
  );
}

const toCounts = (d: AccountDay) => ({
  views: d.views, reach: d.reach, nonFollowerReach: d.nonFollowerReach,
  likes: 0, comments: 0, saves: 0, shares: 0,
  follows: d.follows, profileVisits: d.profileVisits, linkClicks: d.linkClicks,
  videoAvgWatchSeconds: null,
});

function sumDays(days: AccountDay[]) {
  return days.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      reach: acc.reach + d.reach,
      nonFollowerReach: acc.nonFollowerReach + d.nonFollowerReach,
      likes: 0, comments: 0, saves: 0, shares: 0,
      follows: acc.follows + d.follows,
      profileVisits: acc.profileVisits + d.profileVisits,
      linkClicks: acc.linkClicks + d.linkClicks,
      videoAvgWatchSeconds: null,
    }),
    {
      views: 0, reach: 0, nonFollowerReach: 0, likes: 0, comments: 0,
      saves: 0, shares: 0, follows: 0, profileVisits: 0, linkClicks: 0,
      videoAvgWatchSeconds: null,
    },
  );
}
