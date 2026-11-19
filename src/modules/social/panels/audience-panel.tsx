'use client';

import { useState } from 'react';
import { ChartCard, ChartEmpty, SegmentedControl } from '../charts/chart-card';
import { BarChart } from '../charts/bar-chart';
import { DataTable } from '../charts/data-table';
import { formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import { AUDIENCE_DIMENSIONS } from '../types';
import type { AudienceVM } from '../types';

/**
 * Who is actually following.
 *
 * The only panel here that is a standing picture rather than a flow:
 * everything else measures a window, this measures the audience as it
 * stands on the day it was last read. Shown as a share of the audience
 * rather than a headcount, because the headcount is capped at the top
 * entries and would not sum to the follower total.
 *
 * Instagram withholds all of this below roughly a hundred followers and
 * can drop a dimension without warning, so an absent dimension is a
 * normal state and says so rather than drawing an empty chart.
 */
export function AudiencePanel({
  rank, vm, locale, labels,
}: {
  rank: number;
  vm: AudienceVM;
  locale: string;
  labels: SocialLabels;
}) {
  const p = labels.panels.demographics;
  const available = AUDIENCE_DIMENSIONS.filter((d) => (vm.byDimension[d] ?? []).length > 0);
  const [dimension, setDimension] = useState<string>(available[0] ?? 'age');
  const rows = vm.byDimension[dimension] ?? [];

  const asOf = vm.asOf
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(`${vm.asOf}T00:00:00Z`))
    : null;

  const foot = asOf
    ? tx(p, 'foot').replace('{date}', asOf)
    : tx(p, 'footEmpty');

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={foot}
      actions={available.length > 1 ? (
        <SegmentedControl
          ariaLabel={tx(p, 'dimensionPicker')}
          value={dimension}
          onChange={setDimension}
          options={available.map((d) => ({ value: d as string, label: tx(p, d, d) }))}
        />
      ) : undefined}
    >
      {rows.length === 0 ? (
        <ChartEmpty message={tx(p, 'none')} />
      ) : (
        <div className="space-y-5">
          <BarChart
            ariaLabel={`${tx(p, 'title')} — ${tx(p, dimension, dimension)}`}
            data={rows.slice(0, 12).map((r) => ({
              key: r.bucket,
              label: r.bucket,
              value: r.share,
              colorSlot: 3,
            }))}
            maxValue={Math.max(...rows.map((r) => r.share), 0.01)}
            formatValue={(v) => formatById('saveRate', v, locale)}
          />

          <DataTable
            rows={rows}
            rowKey={(r) => r.bucket}
            emptyMessage={labels.common.noData}
            columns={[
              {
                key: 'bucket', header: tx(p, dimension, dimension),
                render: (r) => <span className="font-medium">{r.bucket}</span>,
              },
              {
                key: 'share', header: tx(p, 'colShare'), numeric: true,
                render: (r) => formatById('saveRate', r.share, locale),
              },
              {
                key: 'value', header: tx(p, 'colFollowers'), numeric: true,
                render: (r) => formatById('reach', r.value, locale),
              },
            ]}
          />
        </div>
      )}
    </ChartCard>
  );
}
