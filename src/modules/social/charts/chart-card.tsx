import { HelpButton } from '@/components/shared';
import { cn } from '@/lib/utils';

/**
 * The shell every panel on the dashboard sits in.
 *
 * One shell means one place to change padding, heading size, border or
 * elevation for the whole page, and a white-label tenant inherits it all
 * through the brand tokens. Headings are deliberately large: this page
 * is scanned by scrolling, and the heading is the thing you scroll to.
 *
 * There is deliberately no slot for descriptive prose. Explaining a panel
 * is the job of the circled "?" beside its heading, which opens the
 * explanation in a modal; twelve panels each carrying a description line
 * and a footnote is how a page of numbers turns into a page of grey text.
 * `note` is the one exception and is for FACTS, not explanation: a count
 * of what was excluded, the date a reading was taken, the timezone a grid
 * is drawn in. Those have to stay on screen, because a number nobody can
 * see without hovering is a number nobody has.
 */
export function ChartCard({
  rank, title, help, note, actions, children, className,
}: {
  /** Position in the scroll order. Shown so a panel can be referred to. */
  rank?: number;
  title: string;
  /** Explanation shown in the "?" modal. Paragraphs split on blank lines. */
  help?: string;
  /** One short line of live fact, never explanation. */
  note?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'w-full rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6',
        className,
      )}
    >
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {rank !== undefined && (
              <span className="shrink-0 text-base font-semibold text-muted-foreground sm:text-lg">
                {rank}.
              </span>
            )}
            <span className="min-w-0">{title}</span>
            {help && (
              <HelpButton
                title={title}
                body={help}
                className="translate-y-[-0.1em] self-center"
              />
            )}
          </h2>
          {note && (
            <p className="mt-1.5 max-w-3xl text-xs tabular-nums text-muted-foreground">
              {note}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>

      {children}
    </section>
  );
}

/** Shown instead of a chart when a panel has nothing to draw. */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/**
 * A segmented switcher. Used for metric and view pickers.
 *
 * Not a native <select>: the browser draws that in OS grey whatever the
 * CSS says, which breaks the theme and the dark mode.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/50 p-1"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm',
              on
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
