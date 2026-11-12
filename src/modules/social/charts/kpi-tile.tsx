import { cn } from '@/lib/utils';
import { Sparkline } from './line-chart';

/**
 * A single headline number.
 *
 * Three things, always in the same place: the number, how it moved
 * against the comparable previous window, and the shape of how it got
 * there. The direction arrow is paired with a sign and a word, never
 * colour alone, so it survives greyscale and colourblindness.
 *
 * `higherIsBetter` exists because some metrics are better going down
 * (cost per lead, unfollows) and a green-up / red-down rule applied
 * blindly would congratulate you for the wrong thing.
 */
export function KpiTile({
  label, value, changePct, higherIsBetter = true, trend, colorSlot = 1,
  note, labels,
}: {
  label: string;
  value: string;
  changePct: number | null;
  higherIsBetter?: boolean;
  trend?: number[];
  colorSlot?: number;
  note?: string;
  labels: { up: string; down: string; flat: string; vsPrev: string };
}) {
  const dir = changePct === null || Math.abs(changePct) < 0.005
    ? 'flat'
    : changePct > 0 ? 'up' : 'down';
  const good = dir === 'flat' ? null : (dir === 'up') === higherIsBetter;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="text-sm font-medium leading-snug text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-heading text-3xl font-bold tabular-nums leading-none text-foreground sm:text-4xl">
        {value}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5 text-sm">
        {changePct === null ? (
          <span className="text-muted-foreground">{labels.flat}</span>
        ) : (
          <>
            <span
              aria-hidden
              className={cn(
                'font-bold',
                good === null ? 'text-muted-foreground'
                  : good ? 'text-success' : 'text-destructive',
              )}
            >
              {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}
            </span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                good === null ? 'text-muted-foreground'
                  : good ? 'text-success' : 'text-destructive',
              )}
            >
              {changePct > 0 ? '+' : ''}{(changePct * 100).toFixed(1)}%
            </span>
            <span className="sr-only">
              {dir === 'up' ? labels.up : dir === 'down' ? labels.down : labels.flat}
            </span>
            <span className="text-xs text-muted-foreground">{labels.vsPrev}</span>
          </>
        )}
      </div>

      {trend && trend.length > 1 && (
        <div className="mt-3">
          <Sparkline points={trend} colorSlot={colorSlot} />
        </div>
      )}
      {note && (
        <div className="mt-2 text-xs leading-snug text-muted-foreground">{note}</div>
      )}
    </div>
  );
}
