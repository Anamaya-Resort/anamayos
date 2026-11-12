'use client';

import { useState } from 'react';
import { ChartCard, ChartEmpty, SegmentedControl } from '../charts/chart-card';
import { LineChart } from '../charts/line-chart';
import { COMPARISON_METRIC_IDS, formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import type { PillarTrendVM } from '../view-models';

/**
 * Panel 4: is a pillar heating up or going stale.
 *
 * Small multiples, one mini chart per pillar, each with its own heading
 * and its own last-value label. Not one chart with five overlaid lines:
 * five lines at this density is spaghetti, and it would make colour the
 * only way to tell the series apart, which this module does not allow
 * (see the slot 6-8 note in globals.css).
 *
 * Each panel keeps its own y-scale, so you read the shape of that
 * pillar's trend. Comparing heights between panels is what panel 3 is
 * for.
 */
export function PillarTrend({
  rank, vm, locale, labels,
}: {
  rank: number;
  vm: PillarTrendVM;
  locale: string;
  labels: SocialLabels;
}) {
  const [metricId, setMetricId] = useState<string>('saveRate');
  const p = labels.panels.pillarTrend;
  const groups = vm.byMetric[metricId] ?? [];

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
      {groups.length === 0 ? (
        <ChartEmpty message={labels.common.noData} />
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g.key} className="min-w-0">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="truncate text-lg font-bold text-foreground">{g.label}</h3>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {g.posts} {tx(p, 'posts')}
                </span>
              </div>
              <LineChart
                ariaLabel={`${g.label} — ${labels.metric[metricId] ?? metricId}`}
                height={190}
                showArea
                series={[{
                  key: g.key, label: g.label, colorSlot: g.colorSlot, points: g.points,
                }]}
                formatValue={(v) => formatById(metricId, v, locale)}
              />
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
