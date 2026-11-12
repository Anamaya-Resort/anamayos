'use client';

import { useState } from 'react';
import { ChartCard, ChartEmpty, SegmentedControl } from '../charts/chart-card';
import { BarChart } from '../charts/bar-chart';
import { DataTable } from '../charts/data-table';
import { COMPARISON_METRIC_IDS, formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import type { PillarCompareVM } from '../view-models';

/**
 * Panel 3: which content pillar actually works.
 *
 * Two rules make it honest:
 *
 * 1. IT COMPARES RATES, NEVER TOTALS. Forty yoga posts will always beat
 *    four biohacking posts on any total. Rate per person reached is the
 *    only comparison that answers "which subject pulls harder".
 * 2. THE POST COUNT SITS NEXT TO EVERY BAR. A pillar with three posts
 *    behind it is a hint, not a finding, and the chart has to say so
 *    rather than let a short bar look like a verdict.
 *
 * Every metric is precomputed on the server, so the switcher is an index
 * lookup rather than a recomputation and no posts cross the wire.
 */
const TABLE_METRICS = ['saveRate', 'shareRate', 'engagementRate', 'nonFollowerReachPct'];

export function PillarCompare({
  rank, vm, locale, labels,
}: {
  rank: number;
  vm: PillarCompareVM;
  locale: string;
  labels: SocialLabels;
}) {
  const [metricId, setMetricId] = useState<string>('saveRate');
  const p = labels.panels.pillars;
  const rows = vm.byMetric[metricId] ?? [];
  const postsWord = tx(p, 'posts');

  const foot = vm.immature > 0
    ? `${tx(p, 'foot')} ${tx(p, 'maturityNote').replace('{n}', String(vm.immature))}`
    : tx(p, 'foot');

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={foot}
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
      {rows.length === 0 ? (
        <ChartEmpty message={labels.common.noData} />
      ) : (
        <div className="space-y-5">
          <BarChart
            ariaLabel={`${tx(p, 'title')} — ${labels.metric[metricId] ?? metricId}`}
            data={rows.map((r) => ({
              key: r.key, label: r.label, value: r.value, colorSlot: r.colorSlot,
              sublabel: `${r.posts} ${postsWord}`,
            }))}
            formatValue={(v) => formatById(metricId, v, locale)}
          />

          {/* Always visible, never a hover state. */}
          <DataTable
            rows={rows}
            rowKey={(r) => r.key}
            emptyMessage={labels.common.noData}
            columns={[
              {
                key: 'pillar', header: tx(p, 'colPillar'),
                render: (r) => <span className="font-medium">{r.label}</span>,
              },
              {
                key: 'posts', header: postsWord, numeric: true,
                render: (r) => r.posts,
              },
              ...TABLE_METRICS.map((id) => ({
                key: id, header: labels.metric[id] ?? id, numeric: true,
                secondary: id !== metricId,
                render: (r: typeof rows[number]) =>
                  formatById(id, r.table[id] ?? null, locale),
              })),
              {
                key: 'reach', header: labels.metric.reach ?? 'Reach',
                numeric: true, secondary: true,
                render: (r) => formatById('reach', r.reach, locale),
              },
            ]}
          />
        </div>
      )}
    </ChartCard>
  );
}
