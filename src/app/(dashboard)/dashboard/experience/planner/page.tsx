import { PlannerView } from '@/modules/planner';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Experience Planner — AO Platform' };

export default async function ExperiencePlannerPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);

  return <PlannerView dict={dict} />;
}
