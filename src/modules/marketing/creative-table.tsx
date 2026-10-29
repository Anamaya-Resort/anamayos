import type { CreativeRow } from './types';
import type { TranslationKeys } from '@/i18n/en';

/**
 * Per-ad breakdown for the open tab. Rendered even when empty so the page
 * keeps its shape, and so it is obvious this view exists and is waiting on
 * an ad account rather than missing.
 */
export function CreativeTable({
  rows, platformName, currency, locale, dict,
}: {
  rows: CreativeRow[]; platformName: string; currency: string; locale: string; dict: TranslationKeys;
}) {
  const d = dict.dash;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  const int = (n: number) => new Intl.NumberFormat(locale).format(n);

  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 font-heading text-sm font-semibold">
        {d.creatives.title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {d.creatives.empty.replace('{platform}', platformName)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{d.creatives.ad}</th>
                <th className="px-4 py-2 text-right font-medium">{d.kpi.spend}</th>
                <th className="px-4 py-2 text-right font-medium">{d.creatives.impressions}</th>
                <th className="px-4 py-2 text-right font-medium">{d.creatives.clicks}</th>
                <th className="px-4 py-2 text-right font-medium">{d.creatives.ctr}</th>
                <th className="px-4 py-2 text-right font-medium">{d.kpi.leads}</th>
                <th className="px-4 py-2 text-right font-medium">{d.kpi.cpl}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.externalId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">
                    {r.name}
                    {r.status && (
                      <span className="ml-2 text-[11px] uppercase text-muted-foreground">{r.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(r.spend)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.impressions)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.clicks)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.impressions ? `${((r.clicks / r.impressions) * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.leads)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.leads ? money(r.spend / r.leads) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
