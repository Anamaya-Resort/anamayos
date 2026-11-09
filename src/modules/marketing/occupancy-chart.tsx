import type { OccupancyData } from './types';
import type { TranslationKeys } from '@/i18n/en';

/** Plot geometry. Fixed viewBox, scaled by CSS, so it stays readable small. */
const W = 1080;
const H = 320;
const L = 46;
const R = 16;
const T = 14;
const B = 56;
const WEEKS = 53;

/** Approximate ISO week each month starts on, for the x axis. */
const MONTH_WEEK = [1, 5.3, 9.6, 14, 18.3, 22.6, 27, 31.3, 35.6, 40, 44.3, 48.6];

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const step = v > 60 ? 10 : 5;
  return Math.ceil(v / step) * step;
}

/**
 * Bookings in house each week, one line per year.
 *
 * Every number is printed in the table underneath as well as drawn, so
 * nothing here depends on hovering to be readable.
 */
export function OccupancyChart({
  data, locale, dict,
}: {
  data: OccupancyData; locale: string; dict: TranslationKeys;
}) {
  const d = dict.dash.occupancy;
  const years = data.years;
  // Month names come from the locale rather than the dictionary, so they
  // stay correct in any language without a hand-kept list.
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const months = MONTH_WEEK.map((_, i) => monthFmt.format(new Date(Date.UTC(2024, i, 1))));

  if (years.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 font-heading text-sm font-semibold">
          {d.title}
        </h2>
        <p className="px-4 py-6 text-sm text-muted-foreground">{d.empty}</p>
      </section>
    );
  }

  const max = niceMax(Math.max(...years.map((y) => data.peak[y] ?? 0)));
  const px = (week: number) => L + ((week - 1) / (WEEKS - 1)) * (W - L - R);
  const py = (v: number) => T + (1 - v / max) * (H - T - B);

  /** Newest year first, so it takes the strongest brand colour. */
  const colourOf = (y: string) =>
    `var(--chart-${(years.length - 1 - years.indexOf(y)) % 5 + 1})`;

  /** Stops at the last week that has a booking, so a year still filling
   *  up does not draw a long false run of zeroes. */
  const lineFor = (y: string) => {
    const vals = data.weeks.map((w) => ({ week: w.week, v: w.counts[y] ?? 0 }));
    let last = -1;
    vals.forEach((p, i) => { if (p.v > 0) last = i; });
    if (last < 0) return '';
    return vals.slice(0, last + 1).map((p) => `${px(p.week)},${py(p.v)}`).join(' ');
  };

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i));

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold">{d.title}</h2>
        <p className="text-xs text-muted-foreground">{d.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 pt-3">
        {years.map((y) => (
          <span key={y} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ backgroundColor: colourOf(y) }}
            />
            <span className="font-medium">{y}</span>
            <span className="text-muted-foreground">
              {d.legend
                .replace('{total}', String(data.totals[y] ?? 0))
                .replace('{weeks}', String(data.activeWeeks[y] ?? 0))
                .replace('{peak}', String(data.peak[y] ?? 0))}
            </span>
          </span>
        ))}
      </div>

      <div className="px-2 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={d.title}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={L} x2={W - R} y1={py(t)} y2={py(t)}
                stroke="var(--border)" strokeWidth="1"
              />
              <text
                x={L - 8} y={py(t) + 4} textAnchor="end"
                fill="var(--muted-foreground)" fontSize="11"
              >
                {t}
              </text>
            </g>
          ))}

          {MONTH_WEEK.map((w, i) => (
            <text
              key={i} x={px(w)} y={H - B + 20}
              fill="var(--muted-foreground)" fontSize="11"
            >
              {months[i]}
            </text>
          ))}

          {years.map((y) => {
            const pts = lineFor(y);
            if (!pts) return null;
            return (
              <polyline
                key={y} points={pts} fill="none"
                stroke={colourOf(y)} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>

      <div className="max-h-96 overflow-auto border-t border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{d.week}</th>
              {years.map((y) => (
                <th key={y} className="px-4 py-2 text-right font-medium">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.week} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-1.5 text-muted-foreground">{w.week}</td>
                {years.map((y) => (
                  <td key={y} className="px-4 py-1.5 text-right tabular-nums">
                    {w.counts[y] ? w.counts[y] : <span className="text-muted-foreground">0</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {d.footnote
          .replace('{guestWeeks}', String(data.guestWeeks))
          .replace('{bookings}', String(data.bookingsCounted))
          .replace('{multi}', String(data.multiWeekBookings))}
      </p>
    </section>
  );
}
