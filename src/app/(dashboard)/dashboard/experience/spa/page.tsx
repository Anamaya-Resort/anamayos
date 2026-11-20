import { DaySheet } from '@/modules/desk';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Spa — AO Platform' };

export default async function ExperienceSpaPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  return <DaySheet labels={dict.experience.desk} locale={locale} />;
}
