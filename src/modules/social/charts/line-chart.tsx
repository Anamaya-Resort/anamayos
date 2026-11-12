import { CHART_TOKENS, GEO, mix, plotHeight, plotWidth, slotVar } from '../theme';

export interface Series {
  key: string;
  label: string;
  colorSlot: number;
  points: Array<{ x: string; y: number | null }>;
}

/**
 * A line chart that labels its last point instead of relying on a
 * legend, and prints the latest value large.
 *
 * `comparePoints` draws a recessive second line for the previous period.
 * It is deliberately unlabelled and thin: it is a reference, not a
 * series you read values off.
 */
export function LineChart({
  series, formatValue, ariaLabel, height = 260, showArea = false, xLabels,
}: {
  series: Series[];
  formatValue: (v: number | null) => string;
  ariaLabel: string;
  height?: number;
  showArea?: boolean;
  /** Indices of points whose x value should be printed on the axis. */
  xLabels?: number[];
}) {
  const g = { ...GEO, height, top: 18, bottom: 40, right: 86 };
  const pw = plotWidth(g);
  const ph = plotHeight(g);
  const len = Math.max(...series.map((s) => s.points.length), 1);

  const values = series.flatMap((s) => s.points.map((p) => p.y)).filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  const max = values.length ? Math.max(...values) : 1;
  const min = values.length ? Math.min(...values, 0) : 0;
  const span = max - min || 1;

  const px = (i: number) => g.left + (len === 1 ? pw / 2 : (i / (len - 1)) * pw);
  const py = (v: number) => g.top + ph - ((v - min) / span) * ph;

  const path = (pts: Series['points']) => {
    let d = '';
    let open = false;
    pts.forEach((p, i) => {
      if (p.y === null) { open = false; return; }
      d += `${open ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.y).toFixed(1)} `;
      open = true;
    });
    return d.trim();
  };

  const labelIdx = xLabels ?? [0, Math.floor((len - 1) / 2), len - 1];

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img" aria-label={ariaLabel}
      className="h-auto w-full" preserveAspectRatio="xMinYMin meet"
    >
      {/* Three recessive gridlines. More than that is noise. */}
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={g.left} x2={g.left + pw}
          y1={g.top + ph - t * ph} y2={g.top + ph - t * ph}
          stroke={CHART_TOKENS.grid} strokeWidth={1}
          opacity={t === 0 ? 1 : 0.4}
        />
      ))}
      {[0, 0.5, 1].map((t) => (
        <text
          key={`y${t}`} x={g.left - 10} y={g.top + ph - t * ph}
          textAnchor="end" dominantBaseline="middle"
          fontSize={12} fill={CHART_TOKENS.inkMuted}
        >
          {formatValue(min + t * span)}
        </text>
      ))}

      {series.map((s) => {
        const color = slotVar(s.colorSlot);
        const last = [...s.points].reverse().find((p) => p.y !== null);
        const lastIdx = last ? s.points.lastIndexOf(last) : -1;
        return (
          <g key={s.key}>
            {showArea && (
              <path
                d={`${path(s.points)} L${px(s.points.length - 1)} ${g.top + ph} L${px(0)} ${g.top + ph} Z`}
                fill={mix(color, 16)} stroke="none"
              />
            )}
            <path
              d={path(s.points)} fill="none" stroke={color}
              strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            />
            {last?.y !== null && last !== undefined && lastIdx >= 0 && (
              <>
                <circle cx={px(lastIdx)} cy={py(last.y)} r={4.5} fill={color}
                  stroke={CHART_TOKENS.surface} strokeWidth={2} />
                <text
                  x={px(lastIdx) + 10} y={py(last.y)}
                  dominantBaseline="middle" fontSize={15} fontWeight={700} fill={color}
                >
                  {formatValue(last.y)}
                </text>
              </>
            )}
          </g>
        );
      })}

      {labelIdx.map((i) => {
        const p = series[0]?.points[i];
        if (!p) return null;
        return (
          <text
            key={`x${i}`} x={px(i)} y={g.top + ph + 22}
            textAnchor={i === 0 ? 'start' : i === len - 1 ? 'end' : 'middle'}
            fontSize={12} fill={CHART_TOKENS.inkMuted}
          >
            {p.x}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * A tiny trend line for a KPI tile. No axes, no labels: the tile prints
 * the number, this only shows the shape.
 */
export function Sparkline({
  points, colorSlot = 1,
}: {
  points: number[];
  colorSlot?: number;
}) {
  if (points.length < 2) return <div className="h-8" />;
  const w = 180;
  const h = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * w).toFixed(1)} ${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(' ');
  const color = slotVar(colorSlot);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" aria-hidden preserveAspectRatio="none">
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={mix(color, 14)} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
