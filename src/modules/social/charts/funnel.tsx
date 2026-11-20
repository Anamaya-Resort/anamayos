import { CHART_TOKENS, mix, slotVar } from '../theme';

export interface FunnelStep {
  key: string;
  label: string;
  value: number | null;
  /** Shown when the value cannot be measured yet, instead of a zero. */
  blockedBy?: string;
}

/**
 * The funnel: views down to revenue.
 *
 * Built as stacked rows rather than a tapering polygon. A true funnel
 * shape has to compress the bottom steps to a sliver, which is exactly
 * where the interesting numbers are -- a drop from 200 link clicks to 3
 * bookings is invisible as a taper and obvious as a row.
 *
 * Bar length is on a square-root scale. A linear scale against the top
 * step would make every step below reach a hairline; sqrt keeps the
 * ordering honest while leaving the small steps readable. The step-to-
 * step conversion percentage is printed, which is the number anyone
 * actually wants, so the scale never has to be read as a quantity.
 *
 * A step with no data shows a dash and the reason. Never a zero: a zero
 * reads as "we failed", which is a completely different and much worse
 * message than "not connected yet".
 *
 * The steps are NOT nested sets. Instagram measures reach, accounts
 * engaged and profile visits on separate edges rather than carving each
 * out of the one above, so a step-to-step conversion above 100% is a
 * real and expected result. It is marked with an asterisk and the bar is
 * held at full width instead of overflowing, because an unexplained
 * 115% makes a correct panel look broken. What a step means is in the
 * panel's own help, not printed under every row.
 */
export function Funnel({
  steps, formatValue, colorSlot = 1, blockedLabels,
}: {
  steps: FunnelStep[];
  formatValue: (v: number) => string;
  colorSlot?: number;
  /** Maps a `blockedBy` code to readable text. */
  blockedLabels: Record<string, string>;
}) {
  const measured = steps.filter((s) => s.value !== null);
  const top = measured.length ? Math.max(...measured.map((s) => s.value ?? 0)) : 0;
  const color = slotVar(colorSlot);

  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const prev = steps[i - 1];
        const conv =
          prev && prev.value !== null && step.value !== null && prev.value > 0
            ? step.value / prev.value
            : null;
        const over = conv !== null && conv > 1.001;
        const width =
          step.value !== null && top > 0
            ? Math.min(Math.max(Math.sqrt(step.value / top) * 100, 2), 100)
            : 0;

        return (
          <li key={step.key} className="relative">
            <div className="relative overflow-hidden rounded-md border border-border bg-muted/30">
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${width}%`, backgroundColor: mix(color, 26) }}
                aria-hidden
              />
              <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground sm:text-lg">
                    {step.label}
                  </div>
                </div>
                <div className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  {conv !== null && (
                    <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                      {(conv * 100).toFixed(conv < 0.01 ? 2 : 1)}%
                      {over && <span aria-hidden>*</span>}
                    </span>
                  )}
                  <span
                    className={
                      step.value === null
                        ? 'text-base font-semibold text-muted-foreground sm:text-lg'
                        : 'text-xl font-bold text-foreground sm:text-2xl'
                    }
                  >
                    {step.value === null ? '—' : formatValue(step.value)}
                  </span>
                </div>
              </div>
            </div>
            {step.value === null && step.blockedBy && (
              <p className="mt-1 px-3 text-xs text-muted-foreground sm:px-4">
                {blockedLabels[step.blockedBy] ?? step.blockedBy}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Keeps the funnel's typography on a panel that has no funnel. */
export const funnelInk = CHART_TOKENS.ink;
