'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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

/**
 * Posts and stories are listed apart, defaulting to posts.
 *
 * A story expires after a day and the account publishes several a week,
 * so within a month or two they outnumber everything else. Mixed into
 * one list they push real posts past the row cap and pull every rate
 * down, because a story is seen by a fraction of the audience and is
 * never saved. Separate lists, one control, no lost data.
 */
const FORMAT_VIEWS = ['feed', 'stories', 'all'] as const;
type FormatView = typeof FORMAT_VIEWS[number];

const FORMAT_LABEL_KEYS: Record<FormatView, string> = {
  feed: 'feedOnly', stories: 'storiesOnly', all: 'all',
};

export function PostTable({
  rank, rows, pillars, locale, labels, detailPath,
}: {
  rank: number;
  rows: PostRowVM[];
  pillars: Array<{ id: string; slug: string; name: string }>;
  locale: string;
  labels: SocialLabels;
  /** Where a row's own page lives, without the trailing id. */
  detailPath: string;
}) {
  const p = labels.panels.posts;
  const [sort, setSort] = useState<Sort>('recent');
  const [pillarId, setPillarId] = useState<string>('all');
  const [formatView, setFormatView] = useState<FormatView>('feed');

  const hasStories = useMemo(() => rows.some((r) => r.format === 'story'), [rows]);

  const sorted = useMemo(() => {
    const byFormat = formatView === 'all'
      ? rows
      : formatView === 'stories'
        ? rows.filter((r) => r.format === 'story')
        : rows.filter((r) => r.format !== 'story');
    const filtered = pillarId === 'all'
      ? byFormat
      : byFormat.filter((r) => r.pillarIds.includes(pillarId));
    if (sort === 'recent') {
      return [...filtered].sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      );
    }
    return [...filtered].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  }, [rows, pillarId, sort, formatView]);

  const fmtDate = (isoStr: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'short', year: '2-digit',
    }).format(new Date(isoStr));

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      help={tx(p, 'help')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {hasStories && (
            <SegmentedControl
              ariaLabel={tx(p, 'formatPicker')}
              value={formatView}
              onChange={setFormatView}
              options={FORMAT_VIEWS.map((v) => ({
                value: v,
                label: tx(p, FORMAT_LABEL_KEYS[v]),
              }))}
            />
          )}
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
            key: 'image', header: tx(p, 'colImage'),
            render: (x) => (
              // Instagram is a visual medium and a row of captions
              // hides which post is which. The image is cached in our
              // own bucket during the sync, because Instagram's own URLs
              // expire within days and would leave this full of broken
              // frames. A post without one still reads fine.
              x.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={x.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 rounded border border-border object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-12 w-12 rounded border border-dashed border-border bg-muted/40"
                />
              )
            ),
          },
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
          // Reels only. Every other format stores null and the cell is
          // blank rather than a misleading zero.
          {
            key: 'avgWatchSeconds',
            header: tx(p, 'colWatch'), numeric: true, secondary: true,
            render: (x) => x.avgWatchSeconds === null
              ? ''
              : formatById('avgWatchSeconds', x.avgWatchSeconds, locale),
          },
          {
            key: 'link', header: '', numeric: true, secondary: true,
            render: (x) => (
              <span className="flex items-center justify-end gap-3 whitespace-nowrap">
                {/* Internal, so it stays in this tab. */}
                <Link
                  href={`${detailPath}/${x.id}`}
                  className="text-xs font-medium text-primary underline"
                >
                  {tx(p, 'detail')}
                </Link>
                {x.permalink && (
                  // Outbound link, so it opens in a new tab.
                  <a
                    href={x.permalink} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline"
                  >
                    {tx(p, 'open')}
                  </a>
                )}
              </span>
            ),
          },
        ]}
      />
    </ChartCard>
  );
}
