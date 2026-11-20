export { SocialDashboard } from './social-dashboard';
export { BasisPicker, RangePicker, SampleBanner } from './range-picker';
export {
  RANGE_DAYS, RANGE_KEYS, CUSTOM_RANGE, DEFAULT_RANGE,
  REPORT_TIME_ZONE, COMPARE_BASES, DEFAULT_BASIS,
} from './ranges';
export type { CompareBasis } from './ranges';
export { SectionTabs } from './section-tabs';
export { getSocialDashboard, getPostsBetween, buildRange, buildCustomRange, todayIn, MATURITY_DAYS } from './queries';
export { getAudience } from './audience';
export { getPostDetail } from './post-detail';
export { hashtagVM, MIN_POSTS as HASHTAG_MIN_POSTS } from './hashtags';
export type { HashtagVM, HashtagRow } from './hashtags';
export { PostDetailView } from './panels/post-detail-view';
export { socialLabels, tx, type SocialLabels } from './labels';
export { METRICS, COMPARISON_METRIC_IDS, formatMetric, formatById, sumPosts, sumCounts, change } from './metrics';
export * as socialTheme from './theme';
export { AUDIENCE_DIMENSIONS } from './types';
export type {
  AccountDay, AudienceBucket, AudienceDimension, AudienceVM, Campaign, ColorSlot,
  DateRange, MetricCounts, Pillar, Platform, Post, PostDay, PostDetail,
  PostFormat, SocialDashboardData,
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
