import { PageHeader } from '@/components/shared';
import type { TranslationKeys } from '@/i18n/en';
import { tx, socialLabels } from './labels';
import { RangePicker, SampleBanner } from './range-picker';
import { KpiRow } from './panels/kpi-row';
import { FunnelPanel } from './panels/funnel-panel';
import { PillarCompare } from './panels/pillar-compare';
import { PillarTrend } from './panels/pillar-trend';
import { CampaignPanel } from './panels/campaign-panel';
import { FormatMatrix } from './panels/format-matrix';
import { PostTable } from './panels/post-table';
import { TopBottom } from './panels/top-bottom';
import { TimingHeatmap } from './panels/timing-heatmap';
import { AudienceGrowth } from './panels/audience-growth';
import { ChartCard } from './charts/chart-card';
import {
  campaignVMs, extremeVMs, formatMatrixVM, pillarCompareVM, pillarTrendVM,
  postRowVMs, timingVM,
} from './view-models';
import type { Post, SocialDashboardData } from './types';

/**
 * The page, in scroll order.
 *
 * The order is the argument: what you see first is what should change
 * your decisions most. Outcomes, then where the funnel leaks, then which
 * subject pulls, then what to make next, then the raw record, then the
 * slower-moving context. Panels are numbered on screen so one can be
 * referred to without describing it.
 *
 * Every panel takes data as props and renders; none of them fetches. One
 * server call assembles everything, so adding a panel costs a render,
 * not a round trip.
 */
export function SocialDashboard({
  data, campaignPosts, dict, locale, basePath,
}: {
  data: SocialDashboardData;
  /** A wider window than `data.posts`, so each campaign has a baseline. */
  campaignPosts: Post[];
  dict: TranslationKeys;
  locale: string;
  basePath: string;
}) {
  const labels = socialLabels(dict);
  const s = labels.top;

  // Every interactive panel gets a precomputed view model rather than
  // the posts. Six client components each holding a serialised copy of
  // the post array is what took the first version of this page to
  // 1.2 MB; the arithmetic is done once, here, on the server.
  const compareVM = pillarCompareVM(data.posts, data.pillars, labels.common.empty);
  const trendVM = pillarTrendVM(data.posts, data.pillars, data.range, labels.common.empty);
  const campaignsVM = campaignVMs(data.campaigns, campaignPosts, data.pillars);
  const matrixVM = formatMatrixVM(data.posts, data.pillars);
  const postRows = postRowVMs(data.posts, data.pillars);
  const bestWorst = extremeVMs(data.posts, data.pillars);
  const timing = timingVM(data.posts, data.timeZone);
  const pillarIndex = data.pillars.map(
    ({ id, slug, name }) => ({ id, slug, name }),
  );

  return (
    <div className="w-full space-y-6 pb-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={tx(s, 'title')}
          description={tx(s, 'subtitle')}
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <RangePicker
            basePath={basePath}
            active={data.range.label}
            platform={data.platform}
            labels={labels}
          />
        </div>
      </div>

      {data.isSample && <SampleBanner labels={labels} />}

      {/* 1 — Outcomes. Its own card so the tiles read as one row. */}
      <ChartCard
        rank={1}
        title={tx(labels.panels.outcome, 'title')}
        description={tx(labels.panels.outcome, 'desc')}
        footnote={tx(labels.panels.outcome, 'foot')}
      >
        <KpiRow
          days={data.accountDays}
          prevDays={data.prevAccountDays}
          posts={data.posts}
          prevPosts={data.prevPosts}
          locale={locale}
          labels={labels}
        />
      </ChartCard>

      <FunnelPanel
        rank={2} days={data.accountDays} posts={data.posts}
        locale={locale} labels={labels} attribution={null}
      />

      <PillarCompare rank={3} vm={compareVM} locale={locale} labels={labels} />

      <PillarTrend rank={4} vm={trendVM} locale={locale} labels={labels} />

      <CampaignPanel rank={5} campaigns={campaignsVM} locale={locale} labels={labels} />

      <FormatMatrix rank={6} vm={matrixVM} locale={locale} labels={labels} />

      <PostTable
        rank={7} rows={postRows} pillars={pillarIndex}
        locale={locale} labels={labels}
      />

      <TopBottom
        rank={8} top={bestWorst.top} bottom={bestWorst.bottom}
        locale={locale} labels={labels}
      />

      <TimingHeatmap
        rank={9} vm={timing} timeZone={data.timeZone}
        locale={locale} labels={labels}
      />

      <AudienceGrowth
        rank={10} days={data.accountDays} range={data.range}
        locale={locale} labels={labels}
      />
    </div>
  );
}
