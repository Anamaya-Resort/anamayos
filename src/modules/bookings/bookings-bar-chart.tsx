'use client';

import { useState } from 'react';
import type { ChartSeries, ChartSeriesSet } from './types';
import type { TranslationKeys } from '@/i18n/en';

/** Plot geometry. Fixed viewBox, scaled by CSS, so it stays readable small. */
const W = 1080;
const H = 340;
const L = 48;
const R = 16;
const T = 16;
const B = 44;

type View = 'monthly' | 'weekly' | 'ytt';

/** The wording for one chart. Both chart blocks in the dictionary share it. */
export type ChartCopy = TranslationKeys['bookings']['occupancy'];

function niceMax(v: number): number {
  if (v <= 10) return 10;
  if (v <= 100) return Math.ceil(v / 5) * 5;
  return Math.ceil(v / 20) * 20;
}

/**
 * Grouped bar chart: one bar per year, side by side, per period.
 *
 * One renderer serves every bookings chart so they read identically. The
 * three views arrive together from a single server pass, so switching is
 * client state with nothing to refetch.
 *
 * Every number drawn is also printed in the table underneath, so nothing
 * here depends on hovering to be readable.
 */
export function BookingsBarChart({
  data, copy, locale,
}: {
  data: ChartSeriesSet; copy: ChartCopy; locale: string;
}) {
  const [view, setView] = useState<View>('monthly');
  const years = data.years;

  // Month names come from the locale rather than the dictionary, so they
  // stay correct in any language without a hand-kept list.
  const shortFmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const longFmt = new Intl.DateTimeFormat(locale, { month: 'long' });

  const TABS: Array<{ key: View; label: string }> = [
    { key: 'monthly', label: copy.tabMonthly },
    { key: 'weekly', label: copy.tabWeekly },
    { key: 'ytt', label: copy.tabYtt },
  ];

  const series: ChartSeries =
    view === 'weekly' ? data.weekly : view === 'ytt' ? data.ytt : data.monthly;

  const label = (n: number, long = false) =>
    series.kind === 'week'
      ? `${copy.weekAbbr} ${n}`
      : (long ? longFmt : shortFmt).format(new Date(Date.UTC(2024, n - 1, 1)));

  /** Fills every `{name}` in a footnote from the figures the query returned. */
  const fill = (text: string) =>
    Object.entries(data.stats).reduce(
      (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
      text,
    );

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
      <h2 className="font-heading text-sm font-semibold">{copy.title}</h2>
      <p className="text-xs text-muted-foreground">
        {view === 'weekly' ? copy.subtitleWeekly : view === 'ytt' ? copy.subtitleYtt : copy.subtitle}
      </p>
    </div>
  );

  if (years.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card">
        {header}
        <p className="px-4 py-6 text-sm text-muted-foreground">{copy.empty}</p>
      </section>
    );
  }

  const buckets = series.buckets;
  const dense = buckets.length > 20;
  const max = niceMax(Math.max(1, ...years.map((y) => series.peak[y] ?? 0)));
  const plotW = W - L - R;
  const plotH = H - T - B;
  const base = H - B;
  const groupW = plotW / buckets.length;
  const inner = groupW * (dense ? 0.9 : 0.76);
  const barW = inner / years.length;
  const gap = dense ? 0.3 : 2;
  const py = (v: number) => T + (1 - v / max) * plotH;

  /**
   * Colour follows the year itself, counted from the oldest year present,
   * so a year keeps its colour across both charts and across tabs rather
   * than being repainted by its rank in whatever is on screen.
   */
  const colourOf = (y: string) =>
    `var(--chart-${(Number(y) - Number(years[0])) % 5 + 1})`;

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i));
  /** Weekly cannot label 53 slots, so it labels every fourth. */
  const labelled = (n: number) => !dense || n % 4 === 1;

  return (
    <section className="rounded-lg border border-border bg-card">
      {header}

      <div className="flex flex-wrap gap-1 border-b border-border px-4">
        {TABS.map((t) => {
          const on = t.key === view;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors ${
                on
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 pt-4">
        {years.map((y) => (
          <span key={y} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="inline-block h-5 w-5 shrink-0 rounded border border-border/50"
              style={{ backgroundColor: colourOf(y) }}
            />
            <span className="text-sm font-semibold">{y}</span>
            <span className="text-muted-foreground">
              {copy.legend
                .replace('{total}', String(series.totals[y] ?? 0))
                .replace('{peak}', String(series.peak[y] ?? 0))}
            </span>
          </span>
        ))}
      </div>

      <div className="px-2 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={copy.title}>
          {buckets.map((b, i) => (
            i % 2 === 1 ? (
              <rect
                key={`band-${b.n}`}
                x={L + i * groupW} y={T} width={groupW} height={plotH}
                fill="var(--muted)" opacity="0.35"
              />
            ) : null
          ))}

          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="var(--border)" strokeWidth="1" />
              <text
                x={L - 8} y={py(t) + 4} textAnchor="end"
                fill="var(--muted-foreground)" fontSize="11"
              >
                {t}
              </text>
            </g>
          ))}

          {buckets.map((b, i) => {
            const x0 = L + i * groupW + (groupW - inner) / 2;
            return (
              <g key={b.n}>
                {years.map((y, j) => {
                  const v = b.counts[y] ?? 0;
                  if (v <= 0) return null;
                  const h = Math.max(1, base - py(v));
                  return (
                    <rect
                      key={y}
                      x={x0 + j * barW} y={base - h}
                      width={Math.max(1.2, barW - gap)} height={h}
                      rx={dense ? 0.5 : 2} fill={colourOf(y)}
                    />
                  );
                })}
                {labelled(b.n) && (
                  <text
                    x={L + i * groupW + groupW / 2} y={H - B + 20}
                    textAnchor="middle" fill="var(--muted-foreground)" fontSize="12"
                  >
                    {series.kind === 'week' ? b.n : label(b.n)}
                  </text>
                )}
              </g>
            );
          })}

          <line x1={L} x2={W - R} y1={base} y2={base} stroke="var(--border)" strokeWidth="1.5" />
        </svg>
      </div>

      <div className={`overflow-auto border-t border-border ${dense ? 'max-h-96' : ''}`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">
                {series.kind === 'week' ? copy.week : copy.month}
              </th>
              {years.map((y) => (
                <th key={y} className="px-4 py-2 text-right font-medium">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.n} className="border-b border-border/60">
                <td className="px-4 py-1.5 text-muted-foreground">{label(b.n, true)}</td>
                {years.map((y) => (
                  <td key={y} className="px-4 py-1.5 text-right tabular-nums">
                    {b.counts[y] ? b.counts[y] : <span className="text-muted-foreground">0</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-2">{copy.total}</td>
              {years.map((y) => (
                <td key={y} className="px-4 py-2 text-right tabular-nums">
                  {series.totals[y] ?? 0}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {fill(view === 'ytt' ? copy.footnoteYtt : copy.footnote)}
      </p>
    </section>
  );
}
