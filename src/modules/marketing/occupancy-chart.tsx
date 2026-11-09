import type { OccupancyData } from './types';
import type { TranslationKeys } from '@/i18n/en';

/** Plot geometry. Fixed viewBox, scaled by CSS, so it stays readable small. */
const W = 1080;
const H = 340;
const L = 48;
const R = 16;
const T = 16;
const B = 44;
const MONTHS = 12;
/** Share of a month's slot the bars fill, leaving a gutter between months. */
const FILL = 0.76;

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const step = v > 60 ? 10 : 5;
  return Math.ceil(v / step) * step;
}

/**
 * Bookings in house each month, one bar per year side by side.
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
  const shortFmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const longFmt = new Intl.DateTimeFormat(locale, { month: 'long' });
  const nameOf = (m: number, long = false) =>
    (long ? longFmt : shortFmt).format(new Date(Date.UTC(2024, m - 1, 1)));

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
  const plotW = W - L - R;
  const plotH = H - T - B;
  const base = H - B;
  const groupW = plotW / MONTHS;
  const inner = groupW * FILL;
  const barW = inner / years.length;
  const py = (v: number) => T + (1 - v / max) * plotH;

  /** Newest year first, so it takes the strongest brand colour. */
  const colourOf = (y: string) =>
    `var(--chart-${(years.length - 1 - years.indexOf(y)) % 5 + 1})`;

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i));

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold">{d.title}</h2>
        <p className="text-xs text-muted-foreground">{d.subtitle}</p>
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
              {d.legend
                .replace('{total}', String(data.totals[y] ?? 0))
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
          {data.months.map((m, i) => (
            i % 2 === 1 ? (
              <rect
                key={`band-${m.month}`}
                x={L + i * groupW} y={T}
                width={groupW} height={plotH}
                fill="var(--muted)" opacity="0.35"
              />
            ) : null
          ))}

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

          {data.months.map((m, i) => {
            const x0 = L + i * groupW + (groupW - inner) / 2;
            return (
              <g key={m.month}>
                {years.map((y, j) => {
                  const v = m.counts[y] ?? 0;
                  if (v <= 0) return null;
                  const h = Math.max(1, base - py(v));
                  return (
                    <rect
                      key={y}
                      x={x0 + j * barW} y={base - h}
                      width={Math.max(2, barW - 1.5)} height={h}
                      rx="1.5" fill={colourOf(y)}
                    />
                  );
                })}
                <text
                  x={L + i * groupW + groupW / 2} y={H - B + 20}
                  textAnchor="middle"
                  fill="var(--muted-foreground)" fontSize="12"
                >
                  {nameOf(m.month)}
                </text>
              </g>
            );
          })}

          <line
            x1={L} x2={W - R} y1={base} y2={base}
            stroke="var(--border)" strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{d.month}</th>
              {years.map((y) => (
                <th key={y} className="px-4 py-2 text-right font-medium">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month} className="border-b border-border/60">
                <td className="px-4 py-1.5 text-muted-foreground">{nameOf(m.month, true)}</td>
                {years.map((y) => (
                  <td key={y} className="px-4 py-1.5 text-right tabular-nums">
                    {m.counts[y] ? m.counts[y] : <span className="text-muted-foreground">0</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-2">{d.total}</td>
              {years.map((y) => (
                <td key={y} className="px-4 py-2 text-right tabular-nums">
                  {data.totals[y] ?? 0}
                </td>
              ))}
            </tr>
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
