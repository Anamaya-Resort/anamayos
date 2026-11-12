import { ChartCard, ChartEmpty } from '../charts/chart-card';
import { ColumnChart } from '../charts/bar-chart';
import { LineChart } from '../charts/line-chart';
import { bucketKeys, monthKey, weekKey } from '../aggregate';
import { tx, type SocialLabels } from '../labels';
import type { AccountDay, DateRange } from '../types';

/**
 * Panel 10: audience growth.
 *
 * NET follows -- follows minus unfollows -- not follower count. A
 * follower total only ever goes up and so measures nothing; net follows
 * per week shows the weeks that actually earned an audience, and goes
 * negative when something turned people off, which is the signal worth
 * having.
 *
 * Follower total is still drawn, beneath, as context. Two separate
 * charts rather than one with two y-axes: a dual-axis chart can be made
 * to show any relationship you like by choosing the scales, which is
 * why it is the single most misleading chart type there is.
 */
export function AudienceGrowth({
  rank, days, range, locale, labels,
}: {
  rank: number;
  days: AccountDay[];
  range: DateRange;
  locale: string;
  labels: SocialLabels;
}) {
  const p = labels.panels.audience;
  if (days.length === 0) {
    return (
      <ChartCard rank={rank} title={tx(p, 'title')} description={tx(p, 'desc')}>
        <ChartEmpty message={labels.common.noData} />
      </ChartCard>
    );
  }

  const monthly = range.days > 120;
  const bucket = monthly ? monthKey : weekKey;
  const keys = bucketKeys(range.from, range.to, bucket);
  const shortKey = (k: string) => (monthly ? k.slice(2) : k.replace(/^\d{4}-/, ''));

  const net = new Map<string, number>();
  for (const d of days) {
    const k = bucket(d.date);
    net.set(k, (net.get(k) ?? 0) + d.follows - d.unfollows);
  }

  const nf = (v: number) => new Intl.NumberFormat(locale, {
    signDisplay: 'exceptZero',
  }).format(Math.round(v));

  const followerPoints = keys.map((k) => {
    const last = [...days].reverse().find((d) => bucket(d.date) === k);
    return { x: shortKey(k), y: last ? last.followersTotal : null };
  });

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={tx(p, 'foot')}
    >
      <div className="space-y-7">
        <div>
          <h3 className="mb-2 text-lg font-bold text-foreground sm:text-xl">
            {tx(p, 'netHeading')}
          </h3>
          <ColumnChart
            ariaLabel={tx(p, 'netHeading')}
            labelEvery={keys.length > 16 ? 3 : 1}
            formatValue={nf}
            data={keys.map((k) => ({
              key: k, label: shortKey(k),
              value: net.get(k) ?? 0,
              colorSlot: (net.get(k) ?? 0) < 0 ? 4 : 2,
            }))}
          />
        </div>
        <div>
          <h3 className="mb-2 text-lg font-bold text-foreground sm:text-xl">
            {tx(p, 'totalHeading')}
          </h3>
          <LineChart
            ariaLabel={tx(p, 'totalHeading')}
            height={200}
            series={[{
              key: 'followers', label: tx(p, 'totalHeading'),
              colorSlot: 6, points: followerPoints,
            }]}
            formatValue={(v) =>
              v === null ? '—' : new Intl.NumberFormat(locale, { notation: 'compact' }).format(v)
            }
          />
        </div>
      </div>
    </ChartCard>
  );
}
