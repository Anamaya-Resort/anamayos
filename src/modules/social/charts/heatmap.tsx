import { CHART_TOKENS, rampInk, rampStep } from '../theme';

export interface HeatCell {
  row: string;
  col: string;
  value: number | null;
  /** Sample size behind the value. A cell from one post is not evidence. */
  n?: number;
}

/**
 * A heatmap with the number printed in every cell.
 *
 * Sequential single hue, light to dark, which is the only correct
 * encoding for magnitude. The printed value matters more than usual
 * here: shade alone is hard to compare non-adjacent cells, and nothing
 * on this page is allowed to be hover-only.
 *
 * `minN` greys out a cell computed from too few posts rather than
 * letting one lucky post look like a pattern.
 */
export function Heatmap({
  rows, cols, cells, formatValue, colorSlot = 1, rowLabels, colLabels,
  minN = 2, thinLabel,
}: {
  rows: string[];
  cols: string[];
  cells: HeatCell[];
  formatValue: (v: number | null) => string;
  colorSlot?: number;
  rowLabels: Record<string, string>;
  colLabels: Record<string, string>;
  minN?: number;
  /** Text for a cell below `minN`, e.g. "too few posts". */
  thinLabel: string;
}) {
  const index = new Map(cells.map((c) => [`${c.row}|${c.col}`, c]));
  const usable = cells.filter(
    (c) => c.value !== null && (c.n ?? minN) >= minN,
  );
  const max = usable.length ? Math.max(...usable.map((c) => c.value ?? 0)) : 0;
  const min = usable.length ? Math.min(...usable.map((c) => c.value ?? 0)) : 0;
  const span = max - min || 1;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[34rem] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-32 text-left text-xs font-medium text-muted-foreground" />
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-1 pb-1 text-center text-xs font-semibold text-muted-foreground"
              >
                {colLabels[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th
                scope="row"
                className="pr-2 text-left text-sm font-semibold text-foreground"
              >
                {rowLabels[r] ?? r}
              </th>
              {cols.map((c) => {
                const cell = index.get(`${r}|${c}`);
                const thin = !cell || cell.value === null || (cell.n ?? minN) < minN;
                const t = thin || cell?.value == null
                  ? 0
                  : (cell.value - min) / span;
                return (
                  <td key={c} className="p-0">
                    <div
                      className="flex h-14 flex-col items-center justify-center rounded-md border border-border/60 px-1"
                      style={{
                        backgroundColor: thin ? CHART_TOKENS.track : rampStep(colorSlot, t),
                      }}
                    >
                      <span
                        className="text-sm font-bold tabular-nums sm:text-base"
                        style={{ color: thin ? CHART_TOKENS.inkMuted : rampInk(t) }}
                      >
                        {thin ? '—' : formatValue(cell?.value ?? null)}
                      </span>
                      <span
                        className="text-[10px] leading-none"
                        style={{ color: thin ? CHART_TOKENS.inkMuted : rampInk(t), opacity: 0.8 }}
                      >
                        {thin ? thinLabel : `n=${cell?.n ?? 0}`}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
