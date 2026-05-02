import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { RetreatsListClient } from '@/modules/retreats/retreats-list-client';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Retreats — AO Platform' };

export default async function RetreatsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  // Fetch all retreats including deleted (for trash bin)
  const { data: retreats } = await supabase
    .from('retreats')
    .select('*, persons!retreats_leader_person_id_fkey(full_name)')
    .order('start_date', { ascending: false })
    .limit(300);

  return <RetreatsListClient retreats={(retreats ?? []) as Array<Record<string, unknown>>} dict={dict} locale={locale} />;
}
