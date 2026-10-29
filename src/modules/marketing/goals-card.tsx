import type { GoalWithProgress } from './types';
import type { TranslationKeys } from '@/i18n/en';

function fmt(value: number, format: string, currency: string, locale: string): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(value);
    case 'ratio':
      return `${value.toFixed(2)}x`;
    default:
      return new Intl.NumberFormat(locale).format(value);
  }
}

/**
 * Goals with a bar per target. The bar caps at 100% width but the written
 * percentage does not, so beating a target reads as beating it rather
 * than as merely finished.
 */
export function GoalsCard({
  goals, currency, locale, dict,
}: {
  goals: GoalWithProgress[]; currency: string; locale: string; dict: TranslationKeys;
}) {
  const d = dict.dash;
  if (goals.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 font-heading text-sm font-semibold">
          {d.goals.title}
        </h2>
        <p className="px-4 py-6 text-sm text-muted-foreground">{d.goals.empty}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 font-heading text-sm font-semibold">
        {d.goals.title}
      </h2>
      <div className="divide-y divide-border/60">
        {goals.map(({ goal, progress }) => (
          <div key={goal.id} className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{goal.title}</span>
              {(goal.period_start || goal.period_end) && (
                <span className="text-xs text-muted-foreground">
                  {goal.period_start ?? '…'} → {goal.period_end ?? '…'}
                </span>
              )}
            </div>

            {progress.length === 0 ? (
              <p className="text-xs text-muted-foreground">{d.goals.noTargets}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {progress.map((p) => {
                  const label = (d.kpi as Record<string, string>)[p.key] ?? p.key;
                  const pct = p.actual === null ? null : (p.actual / p.target) * 100;
                  return (
                    <div key={p.key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="tabular-nums">
                          {p.actual === null ? '—' : fmt(p.actual, p.format, currency, locale)}
                          <span className="text-muted-foreground">
                            {' / '}{fmt(p.target, p.format, currency, locale)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-highlight"
                          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {pct === null ? d.blocked.spendNotConnected : `${pct.toFixed(0)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {goal.body && (
              <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {goal.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
