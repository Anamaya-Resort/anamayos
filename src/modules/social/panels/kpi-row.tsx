import { KpiTile } from '../charts/kpi-tile';
import { METRICS, change, formatById, sumPosts } from '../metrics';
import type { SocialLabels } from '../labels';
import type { AccountDay, Post } from '../types';

/**
 * Panel 1: the outcome row.
 *
 * Six numbers, each against the equal-length window before it. These are
 * chosen to answer "are we winning" and nothing else, so follower count,
 * likes and impressions are all deliberately absent. Impressions no
 * longer exist as a metric at all -- Meta removed them in April 2025 and
 * `views` replaced them.
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
  days, prevDays, posts, prevPosts, locale, labels,
}: {
  days: AccountDay[];
  prevDays: AccountDay[];
  posts: Post[];
  prevPosts: Post[];
  locale: string;
  labels: SocialLabels;
}) {
  // Account-level days are the truth for reach and views: they
  // deduplicate people across posts, which summing posts cannot do.
  // Rates that need engagement counts come from the posts instead,
  // because the account edge does not break those out per day.
  const accountNow = sumDays(days);
  const accountPrev = sumDays(prevDays);
  const postNow = sumPosts(posts);
  const postPrev = sumPosts(prevPosts);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {TILES.map(({ metricId, slot }) => {
        const def = METRICS[metricId];
        const fromAccount = metricId === 'views' || metricId === 'reach'
          || metricId === 'nonFollowerReachPct' || metricId === 'profileVisits';
        const now = def.compute(fromAccount ? accountNow : postNow);
        const before = def.compute(fromAccount ? accountPrev : postPrev);

        const trend = fromAccount
          ? days.map((d) => def.compute(toCounts(d)) ?? 0)
          : undefined;

        return (
          <KpiTile
            key={metricId}
            label={(labels.metric[metricId] ?? String(metricId))}
            value={formatById(metricId, now, locale)}
            changePct={change(now, before)}
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
