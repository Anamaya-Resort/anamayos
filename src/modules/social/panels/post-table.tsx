'use client';

import { useMemo, useState } from 'react';
import { ChartCard, SegmentedControl } from '../charts/chart-card';
import { DataTable } from '../charts/data-table';
import { formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import type { PostRowVM } from '../view-models';

/**
 * Panel 7: every post.
 *
 * The workhorse. Everything above this is a summary of this table, so it
 * is the place to come when a chart looks wrong.
 *
 * Newest first by default. Lifetime figures here, not the fair
 * comparison window, because this is a record of what each post did --
 * and the age column is shown so a two-day-old post is never mistaken
 * for an underperformer.
 *
 * Rows arrive precomputed and caption-truncated from the server. The
 * posts themselves never cross the wire: six client panels each holding
 * a copy of them is what took the first version of this page to 1.2 MB.
 */

const SORTS = ['recent', 'saveRate', 'shareRate', 'engagementRate', 'reach'] as const;
type Sort = typeof SORTS[number];

const VISIBLE_LIMIT = 150;

export function PostTable({
  rank, rows, pillars, locale, labels,
}: {
  rank: number;
  rows: PostRowVM[];
  pillars: Array<{ id: string; slug: string; name: string }>;
  locale: string;
  labels: SocialLabels;
}) {
  const p = labels.panels.posts;
  const [sort, setSort] = useState<Sort>('recent');
  const [pillarId, setPillarId] = useState<string>('all');

  const sorted = useMemo(() => {
    const filtered = pillarId === 'all'
      ? rows
      : rows.filter((r) => r.pillarIds.includes(pillarId));
    if (sort === 'recent') {
      return [...filtered].sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      );
    }
    return [...filtered].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  }, [rows, pillarId, sort]);

  const fmtDate = (isoStr: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'short', year: '2-digit',
    }).format(new Date(isoStr));

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={tx(p, 'foot')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel={tx(p, 'filterPicker')}
            value={pillarId}
            onChange={setPillarId}
            options={[
              { value: 'all', label: tx(p, 'all') },
              ...pillars
                .filter((x) => x.slug !== 'unclassified')
                .map((x) => ({ value: x.id, label: x.name })),
            ]}
          />
          <SegmentedControl
            ariaLabel={tx(p, 'sortPicker')}
            value={sort}
            onChange={setSort}
            options={SORTS.map((s) => ({
              value: s,
              label: s === 'recent' ? tx(p, 'newest') : labels.metric[s] ?? s,
            }))}
          />
        </div>
      }
    >
      <DataTable
        rows={sorted.slice(0, VISIBLE_LIMIT)}
        rowKey={(x) => x.id}
        emptyMessage={labels.common.noData}
        caption={`${sorted.length} ${tx(p, 'posts')}${sorted.length > VISIBLE_LIMIT ? ` · ${tx(p, 'capped')}` : ''}`}
        columns={[
          {
            key: 'date', header: tx(p, 'colDate'),
            render: (x) => (
              <div className="whitespace-nowrap">
                <div className="font-medium">{fmtDate(x.publishedAt)}</div>
                <div className="text-xs text-muted-foreground">
                  {x.ageDays}{tx(p, 'daysShort')}
                </div>
              </div>
            ),
          },
          {
            key: 'caption', header: tx(p, 'colPost'),
            render: (x) => (
              <div className="max-w-xs">
                <div className="truncate text-sm">{x.caption || '—'}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {labels.format[x.format] ?? x.format}
                  </span>
                  <span>{x.pillarName}</span>
                  {x.needsReview && (
                    <span className="text-warning">{tx(p, 'lowConfidence')}</span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'views', header: labels.metric.views ?? 'Views', numeric: true,
            render: (x) => formatById('views', x.views, locale),
          },
          {
            key: 'reach', header: labels.metric.reach ?? 'Reach', numeric: true,
            render: (x) => formatById('reach', x.reach, locale),
          },
          {
            key: 'nonFollowerReachPct',
            header: labels.metric.nonFollowerReachPct ?? 'Non-follower reach',
            numeric: true, secondary: true,
            render: (x) => formatById('nonFollowerReachPct', x.nonFollowerReachPct, locale),
          },
          {
            key: 'saves', header: labels.metric.saves ?? 'Saves',
            numeric: true, secondary: true,
            render: (x) => formatById('saves', x.saves, locale),
          },
          {
            key: 'saveRate', header: labels.metric.saveRate ?? 'Save rate', numeric: true,
            render: (x) => (
              <span className="font-semibold">
                {formatById('saveRate', x.saveRate, locale)}
              </span>
            ),
          },
          {
            key: 'shareRate', header: labels.metric.shareRate ?? 'Share rate',
            numeric: true, secondary: true,
            render: (x) => formatById('shareRate', x.shareRate, locale),
          },
          {
            key: 'engagementRate',
            header: labels.metric.engagementRate ?? 'Engagement rate', numeric: true,
            render: (x) => formatById('engagementRate', x.engagementRate, locale),
          },
          {
            key: 'link', header: '', numeric: true, secondary: true,
            render: (x) =>
              x.permalink ? (
                // Outbound link, so it opens in a new tab.
                <a
                  href={x.permalink} target="_blank" rel="noopener noreferrer"
                  className="whitespace-nowrap text-xs font-medium text-primary underline"
                >
                  {tx(p, 'open')}
                </a>
              ) : null,
          },
        ]}
      />
    </ChartCard>
  );
}
