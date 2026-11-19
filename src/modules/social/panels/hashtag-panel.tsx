'use client';

import { useState } from 'react';
import { ChartCard, ChartEmpty, SegmentedControl } from '../charts/chart-card';
import { BarChart } from '../charts/bar-chart';
import { DataTable } from '../charts/data-table';
import { COMPARISON_METRIC_IDS, formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import { TOP_N, type HashtagVM } from '../hashtags';

/**
 * Which hashtags are worth keeping.
 *
 * Same discipline as the pillar panel: rates, never totals, and the
 * post count beside every row. A tag you put on every post will top any
 * total while telling you nothing, and the first version of this
 * read exactly that way until the measure changed.
 *
 * One colour, not eight. These are a ranked list of one thing, not a
 * set of categories, and giving each bar its own hue would imply an
 * identity the tags do not have.
 */
const TABLE_METRICS = ['saveRate', 'shareRate', 'engagementRate', 'nonFollowerReachPct'];

export function HashtagPanel({
  rank, vm, locale, labels,
}: {
  rank: number;
  vm: HashtagVM;
  locale: string;
  labels: SocialLabels;
}) {
  const [metricId, setMetricId] = useState<string>('saveRate');
  const p = labels.panels.hashtags;
  const all = vm.byMetric[metricId] ?? [];
  const charted = all.slice(0, TOP_N);
  const postsWord = tx(p, 'posts', labels.common.posts);

  const foot = tx(p, 'foot')
    .replace('{min}', String(vm.minPosts))
    .replace('{distinct}', String(vm.distinct))
    .replace('{untagged}', String(vm.untagged));

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
      {charted.length === 0 ? (
        <ChartEmpty message={tx(p, 'none', labels.common.noData)} />
      ) : (
        <div className="space-y-5">
          <BarChart
            ariaLabel={`${tx(p, 'title')} — ${labels.metric[metricId] ?? metricId}`}
            data={charted.map((r) => ({
              key: r.tag,
              label: `#${r.tag}`,
              value: r.value,
              colorSlot: 2,
              sublabel: `${r.posts} ${postsWord}`,
            }))}
            formatValue={(v) => formatById(metricId, v, locale)}
          />

          <DataTable
            rows={all}
            rowKey={(r) => r.tag}
            emptyMessage={labels.common.noData}
            caption={`${all.length} ${tx(p, 'tagsCompared')}`}
            columns={[
              {
                key: 'tag', header: tx(p, 'colTag'),
                render: (r) => <span className="font-medium">#{r.tag}</span>,
              },
              {
                key: 'posts', header: postsWord, numeric: true,
                render: (r) => r.posts,
              },
              ...TABLE_METRICS.map((id) => ({
                key: id, header: labels.metric[id] ?? id, numeric: true,
                secondary: id !== metricId,
                render: (r: typeof all[number]) =>
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
