import type { Kpi } from './types';
import type { TranslationKeys } from '@/i18n/en';

function format(kpi: Kpi, currency: string, locale: string): string {
  if (kpi.value === null) return '—';
  switch (kpi.format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(kpi.value);
    case 'percent':
      return `${(kpi.value * 100).toFixed(1)}%`;
    case 'ratio':
      return `${kpi.value.toFixed(2)}x`;
    default:
      return new Intl.NumberFormat(locale).format(kpi.value);
  }
}

/**
 * The headline row Sandra asked for. A tile with no data shows a dash and
 * says what is missing, never a zero — a zero reads as "we failed", which
 * is a different and much worse message than "not connected yet".
 */
export function KpiGrid({
  kpis, currency, locale, dict,
}: {
  kpis: Kpi[]; currency: string; locale: string; dict: TranslationKeys;
}) {
  const d = dict.dash;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {kpis.map((kpi) => {
        const label = (d.kpi as Record<string, string>)[kpi.key] ?? kpi.key;
        const missing = kpi.value === null;
        return (
          <div
            key={kpi.key}
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div
              className={`mt-1 font-heading text-xl font-semibold tabular-nums ${
                missing ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {format(kpi, currency, locale)}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
              {missing && kpi.blockedBy
                ? (d.blocked as Record<string, string>)[kpi.blockedBy] ?? d.blocked.generic
                : (d.source as Record<string, string>)[kpi.source]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
