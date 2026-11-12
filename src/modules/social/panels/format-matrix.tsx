'use client';

import { useState } from 'react';
import { ChartCard, SegmentedControl } from '../charts/chart-card';
import { Heatmap } from '../charts/heatmap';
import { COMPARISON_METRIC_IDS, formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import type { MatrixVM } from '../view-models';

/**
 * Panel 6: format by pillar.
 *
 * The most directly actionable panel here: it says what to make next
 * week, not how last week went. A cell reads "biohacking carousels save
 * at 2.4%", so the decision falls out of the grid.
 */
export function FormatMatrix({
  rank, vm, locale, labels,
}: {
  rank: number;
  vm: MatrixVM;
  locale: string;
  labels: SocialLabels;
}) {
  const [metricId, setMetricId] = useState<string>('saveRate');
  const p = labels.panels.formatMatrix;

  const rowLabels: Record<string, string> = {};
  for (const f of vm.rows) rowLabels[f] = labels.format[f] ?? f;
  const colLabels: Record<string, string> = {};
  for (const c of vm.cols) colLabels[c.id] = c.name;

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={tx(p, 'foot')}
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
        rows={vm.rows}
        cols={vm.cols.map((c) => c.id)}
        cells={vm.byMetric[metricId] ?? []}
        rowLabels={rowLabels}
        colLabels={colLabels}
        colorSlot={1}
        minN={3}
        thinLabel={tx(p, 'thin')}
        formatValue={(v) => formatById(metricId, v, locale)}
      />
    </ChartCard>
  );
}
