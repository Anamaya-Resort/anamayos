import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSession, getSessionLocale } from '@/lib/session';
import { ACCESS_LEVELS } from '@/types';
import type { Locale } from '@/config/app';
import {
  getPlatforms, getOutcomes, getPlatformSummary, getRetreatOutcomes,
  getGoals, getCreatives, getSiteMetrics,
  PlatformTabs, RangePicker, KpiGrid, RetreatTable, GoalsCard, GoalsButton,
  CreativeTable, SiteTable, ConnectionsButton, OnixLauncher, DASH_PATH,
} from '@/modules/marketing';
import type { DashRange, PlatformKey } from '@/modules/marketing';
import {
  SectionTabs, SocialDashboard, getSocialDashboard, getPostsBetween,
  buildRange, RANGE_DAYS as SOCIAL_RANGE_DAYS, socialLabels, tx,
} from '@/modules/social';
import type { Platform } from '@/modules/social';

export const metadata = { title: 'Social Media Marketing Tracking — AO Platform' };
export const dynamic = 'force-dynamic';

const DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12mo': 365 };

function rangeFrom(key: string): DashRange {
  const days = DAYS[key] ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), label: key };
}

export default async function DashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Guarded here as well as in middleware. Everything below reads through
  // the service-role client, so this page must never render without a
  // session even if the matcher is ever loosened.
  const session = await getSession();
  if (!session) redirect('/login?next=/smm_tracking');
  if ((session.accessLevel ?? 0) < ACCESS_LEVELS.manager) redirect('/dashboard');

  const sp = await searchParams;
  const one = (v: string | string[] | undefined, fallback: string) =>
    (Array.isArray(v) ? v[0] : v) ?? fallback;

  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const labels = socialLabels(dict);
  const tabLabels = {
    ads: tx(labels.top, 'tabAds'),
    content: tx(labels.top, 'tabContent'),
  };

  // The content view is a separate section with its own queries. Split
  // here rather than fetching both, so neither tab pays for the other.
  if (one(sp.view, 'ads') === 'content') {
    return (
      <SocialContentSection
        platform={one(sp.platform, 'instagram') as Platform}
        rangeKey={one(sp.range, '12mo')}
        dict={dict}
        locale={locale}
        tabLabels={tabLabels}
      />
    );
  }

  const platforms = await getPlatforms();
  const platformKey = one(sp.platform, platforms[0]?.key ?? 'instagram') as PlatformKey;
  const placement = one(sp.placement, 'all');
  const rangeKey = one(sp.range, '30d');
  const range = rangeFrom(rangeKey);

  const outcomes = await getOutcomes(range);
  const summary = await getPlatformSummary(platformKey, placement, range, outcomes);
  const [retreats, goals, creatives, siteMetrics] = await Promise.all([
    getRetreatOutcomes(range),
    getGoals(platformKey, range, outcomes, summary),
    getCreatives(platformKey, placement, range),
    getSiteMetrics(range),
  ]);
  const platformName = platforms.find((p) => p.key === platformKey)?.name ?? platformKey;

  return (
    <div className="space-y-6 pb-24">
      <SectionTabs basePath={DASH_PATH} active="ads" labels={tabLabels} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={dict.dash.title} description={dict.dash.subtitle} />
        <div className="flex items-center gap-2">
          <RangePicker
            active={rangeKey}
            platform={platformKey}
            placement={placement}
            dict={dict}
          />
          <GoalsButton platforms={platforms} dict={dict} />
          <ConnectionsButton platforms={platforms} dict={dict} />
        </div>
      </div>

      <PlatformTabs
        platforms={platforms}
        active={platformKey}
        placement={placement}
        range={rangeKey}
        dict={dict}
      />

      <KpiGrid
        kpis={summary.kpis}
        currency={outcomes.currency}
        locale={locale}
        dict={dict}
      />


      <SiteTable rows={siteMetrics} locale={locale} dict={dict} />

      <CreativeTable
        rows={creatives}
        platformName={platformName}
        currency={outcomes.currency}
        locale={locale}
        dict={dict}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RetreatTable
          rows={retreats}
          currency={outcomes.currency}
          locale={locale}
          dict={dict}
        />
        <GoalsCard
          goals={goals}
          currency={outcomes.currency}
          locale={locale}
          dict={dict}
        />
      </div>

      <OnixLauncher dict={dict} />
    </div>
  );
}

/**
 * The content-performance section.
 *
 * Everything it renders comes from one server call. `campaignPosts` is a
 * deliberately wider window than the selected range: a campaign needs
 * the stretch of time before it to compare against, and that baseline
 * usually sits outside whatever window the viewer has picked.
 */
async function SocialContentSection({
  platform, rangeKey, dict, locale, tabLabels,
}: {
  platform: Platform;
  rangeKey: string;
  dict: ReturnType<typeof getDictionary>;
  locale: Locale;
  tabLabels: { ads: string; content: string };
}) {
  const range = buildRange(SOCIAL_RANGE_DAYS[rangeKey] ?? 365, rangeKey);
  const data = await getSocialDashboard(platform, range);

  if (!data) {
    const labels = socialLabels(dict);
    return (
      <div className="space-y-6 pb-24">
        <SectionTabs basePath={DASH_PATH} active="content" labels={tabLabels} />
        <PageHeader
          title={tx(labels.top, 'title')}
          description={tx(labels.top, 'subtitle')}
        />
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {labels.common.noData}
        </div>
      </div>
    );
  }

  const earliestBaseline = data.campaigns.reduce((acc, c) => {
    const len = Date.parse(c.endsOn) - Date.parse(c.startsOn);
    const start = new Date(Date.parse(c.startsOn) - len - 86400000)
      .toISOString().slice(0, 10);
    return start < acc ? start : acc;
  }, range.from);

  const campaignPosts = await getPostsBetween(platform, earliestBaseline, range.to);

  return (
    <div className="space-y-6 pb-24">
      <SectionTabs basePath={DASH_PATH} active="content" labels={tabLabels} />
      <SocialDashboard
        data={data}
        campaignPosts={campaignPosts}
        dict={dict}
        locale={locale}
        basePath={`${DASH_PATH}?view=content`}
      />
    </div>
  );
}
