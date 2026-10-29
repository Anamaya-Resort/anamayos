import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSession, getSessionLocale } from '@/lib/session';
import { ACCESS_LEVELS } from '@/types';
import type { Locale } from '@/config/app';
import {
  getPlatforms, getOutcomes, getPlatformSummary, getRetreatOutcomes,
  getGoals, getCreatives,
  PlatformTabs, RangePicker, KpiGrid, RetreatTable, GoalsCard, GoalsButton,
  CreativeTable, ConnectionsButton, OnixLauncher,
} from '@/modules/marketing';
import type { DashRange, PlatformKey } from '@/modules/marketing';

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

  const platforms = await getPlatforms();
  const platformKey = one(sp.platform, platforms[0]?.key ?? 'instagram') as PlatformKey;
  const placement = one(sp.placement, 'all');
  const rangeKey = one(sp.range, '30d');
  const range = rangeFrom(rangeKey);

  const outcomes = await getOutcomes(range);
  const summary = await getPlatformSummary(platformKey, placement, range, outcomes);
  const [retreats, goals, creatives] = await Promise.all([
    getRetreatOutcomes(range),
    getGoals(platformKey, range, outcomes, summary),
    getCreatives(platformKey, placement, range),
  ]);
  const platformName = platforms.find((p) => p.key === platformKey)?.name ?? platformKey;

  return (
    <div className="space-y-6 pb-24">
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
