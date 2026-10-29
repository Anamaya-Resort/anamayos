import type { RetreatOutcome } from './types';
import type { TranslationKeys } from '@/i18n/en';

/** Revenue grouped by retreat, which is the unit Anamaya actually sells. */
export function RetreatTable({
  rows, currency, locale, dict,
}: {
  rows: RetreatOutcome[]; currency: string; locale: string; dict: TranslationKeys;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 font-heading text-sm font-semibold">
        {dict.dash.byRetreat}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{dict.dash.noRetreatRevenue}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{dict.dash.retreat}</th>
                <th className="px-4 py-2 font-medium">{dict.dash.starts}</th>
                <th className="px-4 py-2 text-right font-medium">{dict.dash.kpi.bookings}</th>
                <th className="px-4 py-2 text-right font-medium">{dict.dash.kpi.revenue}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.retreatId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.startDate ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.bookings}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{money(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
