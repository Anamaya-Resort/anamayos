'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ChartCard, ChartEmpty, SegmentedControl } from '../charts/chart-card';
import { LineChart } from '../charts/line-chart';
import { DataTable } from '../charts/data-table';
import { METRICS, formatById } from '../metrics';
import { tx, type SocialLabels } from '../labels';
import type { PostDetail } from '../types';

/**
 * One post, with the daily snapshots drawn rather than summed.
 *
 * Deliberately a page and not a modal: it is a thing you send someone,
 * and a modal has no address. Nothing here is hover-only; the chart is
 * repeated as a table underneath.
 */
const CURVE_METRICS = ['views', 'reach', 'saves', 'shares', 'profileVisits', 'linkClicks'];
const KPI_METRICS = ['views', 'reach', 'saves', 'shares', 'engagementRate', 'saveRate'];

export function PostDetailView({
  post, labels, locale, backHref,
}: {
  post: PostDetail;
  labels: SocialLabels;
  locale: string;
  backHref: string;
}) {
  const d = labels.detail;
  const [metricId, setMetricId] = useState<string>('views');

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(iso));

  const points = post.days.map((day) => ({
    x: day.date,
    y: METRICS[metricId]?.compute(day) ?? null,
  }));

  return (
    <div className="w-full space-y-6 pb-24">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tx(d, 'back')}
      </Link>

      <section className="w-full rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {post.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnailUrl}
              alt=""
              className="h-40 w-40 shrink-0 rounded-md border border-border object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="font-heading text-xl font-bold leading-snug text-foreground sm:text-2xl">
              {post.caption || tx(labels.panels.posts, 'colPost')}
            </p>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {tx(d, 'published')}
                </dt>
                <dd className="font-medium text-foreground">
                  {fmtDate(post.publishedAt)}
                  <span className="ml-2 text-muted-foreground">
                    {tx(d, 'ageDays').replace('{n}', String(post.ageDays))}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {tx(d, 'format')}
                </dt>
                <dd className="font-medium text-foreground">
                  {labels.format[post.format] ?? post.format}
                </dd>
              </div>
              {post.pillarNames.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {tx(d, 'pillars')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {post.pillarNames.join(', ')}
                  </dd>
                </div>
              )}
            </dl>

            {post.hashtags.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {post.hashtags.map((t) => `#${t}`).join(' ')}
              </p>
            )}

            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {tx(d, 'openOnPlatform')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-3 lg:grid-cols-6">
          {KPI_METRICS.map((id) => (
            <div key={id} className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.metric[id] ?? id}
              </p>
              <p className="font-heading text-xl font-bold tabular-nums text-foreground">
                {formatById(id, METRICS[id]?.compute(post.totals) ?? null, locale)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ChartCard
        title={tx(d, 'curveTitle')}
        help={tx(d, 'curveHelp')}
        actions={
          <SegmentedControl
            ariaLabel={tx(d, 'metricPicker')}
            value={metricId}
            onChange={setMetricId}
            options={CURVE_METRICS.map((id) => ({
              value: id, label: labels.metric[id] ?? id,
            }))}
          />
        }
      >
        {post.days.length === 0 ? (
          <ChartEmpty message={tx(d, 'noDays')} />
        ) : (
          <div className="space-y-5">
            <LineChart
              ariaLabel={`${tx(d, 'curveTitle')} — ${labels.metric[metricId] ?? metricId}`}
              showArea
              series={[{
                key: metricId,
                label: labels.metric[metricId] ?? metricId,
                colorSlot: 2,
                points,
              }]}
              formatValue={(v) => formatById(metricId, v, locale)}
            />

            <DataTable
              rows={post.days}
              rowKey={(row) => row.date}
              emptyMessage={tx(d, 'noDays')}
              columns={[
                {
                  key: 'day', header: tx(d, 'colDay'),
                  render: (row) => (
                    <span className="font-medium">
                      {row.dayOffset === 0 ? tx(d, 'dayZero') : `+${row.dayOffset}`}
                    </span>
                  ),
                },
                {
                  key: 'date', header: tx(d, 'colDate'),
                  render: (row) => fmtDate(`${row.date}T00:00:00Z`),
                },
                ...CURVE_METRICS.map((id) => ({
                  key: id, header: labels.metric[id] ?? id, numeric: true,
                  secondary: id !== metricId,
                  render: (row: typeof post.days[number]) =>
                    formatById(id, METRICS[id]?.compute(row) ?? null, locale),
                })),
              ]}
            />
          </div>
        )}
      </ChartCard>
    </div>
  );
}
