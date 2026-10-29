import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';
import {
  getPlatforms, getOutcomes, getPlatformSummary, getRetreatOutcomes,
  PlatformTabs, RangePicker, KpiGrid, RetreatTable, ConnectionsButton, OnixLauncher,
} from '@/modules/marketing';
import type { DashRange, PlatformKey } from '@/modules/marketing';

export const metadata = { title: 'Marketing — AO Platform' };
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
  const [summary, retreats] = await Promise.all([
    getPlatformSummary(platformKey, placement, range, outcomes),
    getRetreatOutcomes(range),
  ]);

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

      <RetreatTable
        rows={retreats}
        currency={outcomes.currency}
        locale={locale}
        dict={dict}
      />

      <OnixLauncher dict={dict} />
    </div>
  );
}
