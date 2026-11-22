import type { TranslationKeys } from '@/i18n/en';
import type { SupplierItem } from '../types';

export type SupplierLabels = TranslationKeys['experience']['suppliers'];

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export function duration(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
}

export function unitLabel(l: SupplierLabels, unit: string | null) {
  const key = `per${unit ?? ''}` as keyof SupplierLabels;
  return unit && key in l ? l[key] : null;
}

/** "$55", "From $70", or "On request". */
export function priceLine(l: SupplierLabels, item: SupplierItem) {
  if (item.options.length) return `${l.from} ${money(Math.min(...item.options.map((o) => o.price)))}`;
  if (item.onRequest || item.price == null) return l.onRequest;
  return money(item.price);
}

/** wa.me wants digits only, country code first. */
export const waLink = (n: string) => `https://wa.me/${n.replace(/\D/g, '')}`;
export const telLink = (n: string) => `tel:+${n.replace(/\D/g, '')}`;
