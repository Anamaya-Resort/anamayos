import en, { type TranslationKeys } from './en';
import es from './es';
import type { Locale } from '@/config/app';

const dictionaries: Record<Locale, TranslationKeys> = { en, es };

export function getDictionary(locale: Locale): TranslationKeys {
  return dictionaries[locale] ?? dictionaries.en;
}

type NestedKeyOf<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${NestedKeyOf<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = NestedKeyOf<TranslationKeys>;

/** Simple translation lookup with interpolation */
export function t(
  dict: TranslationKeys,
  key: string,
  params?: Record<string, string>,
): string {
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dict;
  for (const k of keys) {
    value = value?.[k];
  }
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(`{${k}}`, v),
    value,
  );
}
