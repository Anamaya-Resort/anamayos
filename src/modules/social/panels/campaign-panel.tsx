'use client';

import { useState } from 'react';
import { ChartCard, ChartEmpty, SegmentedControl } from '../charts/chart-card';
import { DataTable } from '../charts/data-table';
import { formatById } from '../metrics';
import { slotVar } from '../theme';
import { tx, type SocialLabels } from '../labels';
import type { CampaignVM } from '../view-models';

/**
 * Panel 5: did the push work.
 *
 * A campaign is a named window plus the pillars it was about. Each one
 * is compared against the equivalent stretch of time immediately before
 * it -- same length, same pillars -- so the answer is a number instead
 * of a feeling.
 *
 * Same-pillar baseline on purpose: comparing a biohacking push against
 * all content before it would mostly measure the difference between
 * subjects, not the difference the push made.
 */
export function CampaignPanel({
  rank, campaigns, locale, labels,
}: {
  rank: number;
  campaigns: CampaignVM[];
  locale: string;
  labels: SocialLabels;
}) {
  const p = labels.panels.campaign;
  const [slug, setSlug] = useState<string>(campaigns[0]?.slug ?? '');
  const c = campaigns.find((x) => x.slug === slug) ?? campaigns[0];

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${d}T12:00:00Z`));

  if (!c) {
    return (
      <ChartCard rank={rank} title={tx(p, 'title')} description={tx(p, 'desc')}>
        <ChartEmpty message={tx(p, 'none')} />
      </ChartCard>
    );
  }

  const postsWord = tx(p, 'posts');

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={tx(p, 'foot')}
      actions={
        campaigns.length > 1 ? (
          <SegmentedControl
            ariaLabel={tx(p, 'picker')}
            value={c.slug}
            onChange={setSlug}
            options={campaigns.map((x) => ({ value: x.slug, label: x.name }))}
          />
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div
          className="rounded-md border-l-4 bg-muted/40 px-4 py-3"
          style={{ borderLeftColor: slotVar(c.accentSlot) }}
        >
          <div className="text-xl font-bold text-foreground sm:text-2xl">{c.name}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {fmtDate(c.startsOn)} – {fmtDate(c.endsOn)}
            {c.pillarNames.length > 0 && ` · ${c.pillarNames.join(', ')}`}
            {` · ${c.duringPosts} ${postsWord}`}
          </div>
          {c.notes && (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{c.notes}</p>
          )}
        </div>

        {c.thinBaseline && (
          <p
            role="status"
            className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-foreground"
          >
            {tx(p, 'thinBaseline').replace('{n}', String(c.baselinePosts))}
          </p>
        )}

        <DataTable
          rows={c.rows}
          rowKey={(r) => r.metricId}
          emptyMessage={labels.common.noData}
          caption={`${tx(p, 'baselineCaption')} ${fmtDate(c.baselineFrom)} – ${fmtDate(c.baselineTo)} · ${c.baselinePosts} ${postsWord}`}
          columns={[
            {
              key: 'metric', header: tx(p, 'colMetric'),
              render: (r) => (
                <span className="font-medium">
                  {labels.metric[r.metricId] ?? r.metricId}
                </span>
              ),
            },
            {
              key: 'during', header: tx(p, 'during'), numeric: true,
              render: (r) => (
                <span className="font-semibold">
                  {formatById(r.metricId, r.now, locale)}
                </span>
              ),
            },
            {
              key: 'baseline', header: tx(p, 'baseline'), numeric: true,
              render: (r) => formatById(r.metricId, r.before, locale),
            },
            {
              key: 'lift', header: tx(p, 'lift'), numeric: true,
              render: (r) =>
                r.lift === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span
                    className={
                      r.lift > 0 ? 'font-bold text-success'
                        : r.lift < 0 ? 'font-bold text-destructive'
                          : 'text-muted-foreground'
                    }
                  >
                    {r.lift > 0 ? '▲ +' : r.lift < 0 ? '▼ ' : '■ '}
                    {(r.lift * 100).toFixed(1)}%
                  </span>
                ),
            },
          ]}
        />
      </div>
    </ChartCard>
  );
}
