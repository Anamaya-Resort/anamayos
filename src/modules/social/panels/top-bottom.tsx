import { ChartCard, ChartEmpty } from '../charts/chart-card';
import { formatById } from '../metrics';
import { slotVar } from '../theme';
import { tx, type SocialLabels } from '../labels';
import type { PostRowVM } from '../view-models';

/**
 * Panel 8: the best and worst five, side by side.
 *
 * Ranked by save rate rather than likes, and shown as a pair on purpose.
 * A list of winners on its own invites you to make more of the same; the
 * contrast is what tells you what to stop doing, and the losers are
 * usually the more useful half.
 */
export function TopBottom({
  rank, top, bottom, locale, labels,
}: {
  rank: number;
  top: PostRowVM[];
  bottom: PostRowVM[];
  locale: string;
  labels: SocialLabels;
}) {
  const p = labels.panels.extremes;

  return (
    <ChartCard
      rank={rank}
      title={tx(p, 'title')}
      description={tx(p, 'desc')}
      footnote={tx(p, 'foot')}
    >
      {top.length === 0 ? (
        <ChartEmpty message={labels.common.noData} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ExtremeList items={top} heading={tx(p, 'best')} slot={2}
            locale={locale} labels={labels} />
          <ExtremeList items={bottom} heading={tx(p, 'worst')} slot={4}
            locale={locale} labels={labels} />
        </div>
      )}
    </ChartCard>
  );
}

/**
 * One ranked column. Module level rather than defined inside the panel,
 * so React keeps the same component identity between renders instead of
 * remounting the whole list each time.
 */
function ExtremeList({
  items, heading, slot, locale, labels,
}: {
  items: PostRowVM[];
  heading: string;
  slot: number;
  locale: string;
  labels: SocialLabels;
}) {
  const reachWord = (labels.metric.reach ?? 'reach').toLowerCase();
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-lg font-bold text-foreground sm:text-xl">{heading}</h3>
      <ol className="space-y-2">
        {items.map((x, i) => (
          <li
            key={x.id}
            className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3"
          >
            <span className="mt-0.5 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-snug text-foreground">
                {x.caption || '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {labels.format[x.format] ?? x.format} · {x.pillarName} ·{' '}
                {new Intl.DateTimeFormat(locale, {
                  day: 'numeric', month: 'short', year: '2-digit',
                }).format(new Date(x.publishedAt))}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div
                className="text-lg font-bold tabular-nums sm:text-xl"
                style={{ color: slotVar(slot) }}
              >
                {formatById('saveRate', x.saveRate, locale)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatById('reach', x.reach, locale)} {reachWord}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
