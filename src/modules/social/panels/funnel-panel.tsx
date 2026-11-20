import { ChartCard } from '../charts/chart-card';
import { Funnel, type FunnelStep } from '../charts/funnel';
import { sumPosts } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import type { AccountDay, Post } from '../types';

/**
 * Panel 2: the funnel.
 *
 * Views at the top, revenue at the bottom. The top half is measurable
 * from the platform alone. The bottom half -- leads, bookings, revenue
 * -- needs UTM capture on the website and lead-to-booking matching,
 * which do not exist yet, so those steps render a dash and say what is
 * missing rather than a zero. A zero would read as "social produced no
 * bookings", which is a claim we cannot currently make either way.
 */
export function FunnelPanel({
  rank, days, posts, locale, labels, attribution,
}: {
  rank: number;
  days: AccountDay[];
  posts: Post[];
  locale: string;
  labels: SocialLabels;
  /** Supplied once attribution exists. Null means "not wired yet". */
  attribution?: { leads: number; bookings: number; revenue: number } | null;
}) {
  const p = labels.panels.funnel;
  const steps = labels.panels.funnelSteps;
  const blocked = labels.panels.funnelBlocked;

  const account = days.reduce(
    (a, d) => ({
      views: a.views + d.views,
      reach: a.reach + d.reach,
      engaged: a.engaged + d.accountsEngaged,
      profileVisits: a.profileVisits + d.profileVisits,
      linkClicks: a.linkClicks + d.linkClicks,
    }),
    { views: 0, reach: 0, engaged: 0, profileVisits: 0, linkClicks: 0 },
  );
  const fromPosts = sumPosts(posts);

  const nf = (n: number) => new Intl.NumberFormat(locale).format(Math.round(n));

  const list: FunnelStep[] = [
    {
      key: 'views', label: tx(steps, 'views'),
      value: account.views || null,
    },
    {
      key: 'reach', label: tx(steps, 'reach'),
      value: account.reach || null,
    },
    {
      key: 'engaged', label: tx(steps, 'engaged'),
      value: account.engaged || null,
    },
    {
      key: 'profileVisits', label: tx(steps, 'profileVisits'),
      value: account.profileVisits || null,
    },
    {
      key: 'linkClicks', label: tx(steps, 'linkClicks'),
      value: (account.linkClicks || fromPosts.linkClicks) || null,
    },
    {
      key: 'leads', label: tx(steps, 'leads'),
      value: attribution ? attribution.leads : null,
      blockedBy: attribution ? undefined : 'utm',
    },
    {
      key: 'bookings', label: tx(steps, 'bookings'),
      value: attribution ? attribution.bookings : null,
      blockedBy: attribution ? undefined : 'matching',
    },
    {
      key: 'revenue', label: tx(steps, 'revenue'),
      value: attribution ? attribution.revenue : null,
      blockedBy: attribution ? undefined : 'matching',
    },
  ];

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      help={tx(p, 'help')}
    >
      <Funnel steps={list} formatValue={nf} colorSlot={1} blockedLabels={blocked} />
    </ChartCard>
  );
}
