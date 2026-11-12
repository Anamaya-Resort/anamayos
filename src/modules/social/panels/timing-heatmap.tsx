'use client';

import { useState } from 'react';
import { ChartCard, SegmentedControl } from '../charts/chart-card';
import { Heatmap } from '../charts/heatmap';
import { COMPARISON_METRIC_IDS, formatById } from '../metrics';
import { tx, DAY_ORDER, HOUR_BANDS, type SocialLabels } from '../labels';
import type { TimingVM } from '../view-models';

/**
 * Panel 9: when to post.
 *
 * Bucketed in the account's own timezone, never UTC. Costa Rica is six
 * hours behind UTC, so a 7am local post lands at 13:00 UTC and a UTC
 * grid would confidently tell you to post in the afternoon.
 *
 * Four-hour bands, not 24 hourly columns: a year at five posts a week is
 * about 250 posts, and 168 hourly cells would average one post each.
 * This panel needs roughly two months of posting before it says
 * anything trustworthy, which is why it sits near the bottom.
 */
export function TimingHeatmap({
  rank, vm, timeZone, locale, labels,
}: {
  rank: number;
  vm: TimingVM;
  timeZone: string;
  locale: string;
  labels: SocialLabels;
}) {
  const [metricId, setMetricId] = useState<string>('engagementRate');
  const p = labels.panels.timing;

  const rowLabels: Record<string, string> = {};
  for (const d of DAY_ORDER) rowLabels[String(d)] = labels.day[d] ?? '';
  const colLabels: Record<string, string> = {};
  for (const b of HOUR_BANDS) colLabels[b] = labels.band[`b${b}`] ?? `${b}:00`;

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={`${tx(p, 'foot')} ${timeZone}.`}
      actions={
        <SegmentedControl
          ariaLabel={tx(p, 'metricPicker')}
          value={metricId}
          onChange={setMetricId}
          options={COMPARISON_METRIC_IDS.map((id) => ({
            value: id as string, label: labels.metric[id] ?? id,
          }))}
        />
      }
    >
      <Heatmap
        rows={DAY_ORDER.map(String)}
        cols={HOUR_BANDS}
        cells={vm.byMetric[metricId] ?? []}
        rowLabels={rowLabels}
        colLabels={colLabels}
        colorSlot={2}
        minN={2}
        thinLabel={tx(p, 'thin')}
        formatValue={(v) => formatById(metricId, v, locale)}
      />
    </ChartCard>
  );
}
