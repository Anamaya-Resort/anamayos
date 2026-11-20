import { DeskView } from '@/modules/desk';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Reception Desk — AO Platform' };

export default async function ReceptionDeskPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  return <DeskView labels={dict.experience.desk} locale={locale} />;
}
