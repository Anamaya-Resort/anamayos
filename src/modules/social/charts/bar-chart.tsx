import { CHART_TOKENS, GEO, plotHeight, plotWidth, slotVar } from '../theme';

export interface BarDatum {
  /** Stable identity. Colour follows this, never the sort position. */
  key: string;
  label: string;
  value: number | null;
  /** Theme slot 1..8. */
  colorSlot: number;
  /** Printed under the label, e.g. the post count behind a rate. */
  sublabel?: string;
}

/**
 * Horizontal bars with the value printed on every bar.
 *
 * Horizontal rather than vertical because the labels are words
 * ("Yoga Teacher Training", "Ecolodge & Adventure") and vertical bars
 * force those to rotate or truncate.
 *
 * Every bar carries its own name and its own number, so the chart reads
 * correctly with no legend, in greyscale, and for a colourblind viewer.
 * That is a requirement here, not a nicety: see the slot 6-8 note in
 * globals.css. It also means no number on this page is hover-only.
 */
export function BarChart({
  data, formatValue, maxValue, barHeight = 46, ariaLabel,
}: {
  data: BarDatum[];
  formatValue: (v: number | null) => string;
  /** Override the scale top, to hold it steady across metric switches. */
  maxValue?: number;
  barHeight?: number;
  ariaLabel: string;
}) {
  const gap = 10;
  const labelWidth = 190;
  const valueWidth = 86;
  const width = GEO.width;
  const height = data.length * (barHeight + gap) + gap;
  const trackLeft = labelWidth;
  const trackWidth = width - labelWidth - valueWidth;

  const top = maxValue ?? Math.max(
    ...data.map((d) => d.value ?? 0).filter(Number.isFinite), 0,
  );
  const scale = (v: number) => (top > 0 ? (v / top) * trackWidth : 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full"
      preserveAspectRatio="xMinYMin meet"
    >
      {data.map((d, i) => {
        const y = gap + i * (barHeight + gap);
        const w = d.value === null ? 0 : scale(d.value);
        const fill = slotVar(d.colorSlot);
        return (
          <g key={d.key}>
            {/* Recessive track, so an empty bar still reads as a row */}
            <rect
              x={trackLeft} y={y} width={trackWidth} height={barHeight}
              rx={4} fill={CHART_TOKENS.track} opacity={0.5}
            />
            <rect
              x={trackLeft} y={y} width={Math.max(w, d.value ? 3 : 0)} height={barHeight}
              rx={4} fill={fill}
            />
            <text
              x={labelWidth - 14} y={y + barHeight / 2 - (d.sublabel ? 5 : 0)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={17} fontWeight={600} fill={CHART_TOKENS.ink}
            >
              {d.label}
            </text>
            {d.sublabel && (
              <text
                x={labelWidth - 14} y={y + barHeight / 2 + 13}
                textAnchor="end" dominantBaseline="middle"
                fontSize={13} fill={CHART_TOKENS.inkMuted}
              >
                {d.sublabel}
              </text>
            )}
            <text
              x={width - valueWidth + 12} y={y + barHeight / 2}
              dominantBaseline="middle"
              fontSize={18} fontWeight={700} fill={CHART_TOKENS.ink}
            >
              {formatValue(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
  colorSlot: number;
}

/**
 * Vertical columns, for a short ordered sequence where the labels are
 * short (months, weeks, days). Values are printed above each column.
 */
export function ColumnChart({
  data, formatValue, ariaLabel, labelEvery = 1,
}: {
  data: ColumnDatum[];
  formatValue: (v: number) => string;
  ariaLabel: string;
  /** Print every Nth axis label, for dense series. */
  labelEvery?: number;
}) {
  const g = { ...GEO, height: 300, bottom: 44, top: 32 };
  const pw = plotWidth(g);
  const ph = plotHeight(g);
  const top = Math.max(...data.map((d) => d.value), 0) * 1.12 || 1;
  const slot = pw / Math.max(data.length, 1);
  const barW = Math.min(slot * 0.68, 64);
  const dense = data.length > 18;

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img" aria-label={ariaLabel}
      className="h-auto w-full" preserveAspectRatio="xMinYMin meet"
    >
      <line
        x1={g.left} y1={g.top + ph} x2={g.left + pw} y2={g.top + ph}
        stroke={CHART_TOKENS.axis} strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = (d.value / top) * ph;
        const x = g.left + i * slot + (slot - barW) / 2;
        const y = g.top + ph - h;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)}
              rx={3} fill={slotVar(d.colorSlot)} />
            {!dense && (
              <text
                x={x + barW / 2} y={y - 7} textAnchor="middle"
                fontSize={14} fontWeight={700} fill={CHART_TOKENS.ink}
              >
                {formatValue(d.value)}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text
                x={x + barW / 2} y={g.top + ph + 20} textAnchor="middle"
                fontSize={13} fill={CHART_TOKENS.inkMuted}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
