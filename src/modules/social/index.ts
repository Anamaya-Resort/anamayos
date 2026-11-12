export { SocialDashboard } from './social-dashboard';
export { RangePicker, SampleBanner, RANGE_DAYS, RANGE_KEYS } from './range-picker';
export { SectionTabs } from './section-tabs';
export { getSocialDashboard, getPostsBetween, buildRange, MATURITY_DAYS } from './queries';
export { socialLabels, tx, type SocialLabels } from './labels';
export { METRICS, COMPARISON_METRIC_IDS, formatMetric, formatById, sumPosts, sumCounts, change } from './metrics';
export * as socialTheme from './theme';
export type {
  AccountDay, Campaign, ColorSlot, DateRange, MetricCounts, Pillar, Platform,
  Post, PostFormat, SocialDashboardData,
} from './types';

/** Reusable chart primitives — platform-agnostic, no social knowledge. */
export { ChartCard, ChartEmpty, SegmentedControl } from './charts/chart-card';
export { BarChart, ColumnChart } from './charts/bar-chart';
export { LineChart, Sparkline } from './charts/line-chart';
export { Funnel } from './charts/funnel';
export { Heatmap } from './charts/heatmap';
export { KpiTile } from './charts/kpi-tile';
export { DataTable } from './charts/data-table';

/** Server-computed view models, one per interactive panel. */
export {
  pillarCompareVM, pillarTrendVM, formatMatrixVM, timingVM, campaignVMs,
  postRowVMs, extremeVMs,
} from './view-models';
export type {
  PillarCompareVM, PillarTrendVM, MatrixVM, TimingVM, CampaignVM, PostRowVM,
} from './view-models';
