import type { SiteMetrics } from './types';
import type { TranslationKeys } from '@/i18n/en';

/**
 * Website traffic and search performance per tracked site. Independent of the
 * platform tabs: these are properties, not ad accounts, so they do not change
 * when you switch between Instagram and Google.
 */
export function SiteTable({
  rows, locale, dict,
}: {
  rows: SiteMetrics[]; locale: string; dict: TranslationKeys;
}) {
  const d = dict.dash.sites;
  const int = (n: number | null) =>
    n === null ? '—' : new Intl.NumberFormat(locale).format(n);

  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 font-heading text-sm font-semibold">
        {d.tableTitle}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{d.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{d.site}</th>
                <th className="px-4 py-2 text-right font-medium">{d.sessions}</th>
                <th className="px-4 py-2 text-right font-medium">{d.users}</th>
                <th className="px-4 py-2 text-right font-medium">{d.conversions}</th>
                <th className="px-4 py-2 text-right font-medium">{d.clicks}</th>
                <th className="px-4 py-2 text-right font-medium">{d.impressions}</th>
                <th className="px-4 py-2 text-right font-medium">{d.position}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.site.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">
                    {r.site.domain}
                    {r.blockedBy && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {(d.blocked as Record<string, string>)[r.blockedBy] ?? ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.sessions)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.users)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.conversions)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.clicks)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{int(r.impressions)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.position === null ? '—' : r.position.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            {d.footnote}
          </p>
        </div>
      )}
    </section>
  );
}
