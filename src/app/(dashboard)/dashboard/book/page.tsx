import { BookingWizard } from '@/modules/booking-flow';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Book — AO Platform' };

export default async function BookPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: retreatsData } = await supabase
    .from('retreats')
    .select('id, name, excerpt, description, start_date, end_date, categories, max_capacity, available_spaces, currency, deposit_percentage, images, status, leader_person_id, persons!retreats_leader_person_id_fkey(full_name)')
    .eq('is_active', true)
    .in('status', ['confirmed', 'draft'])
    .gte('start_date', today)
    .order('start_date');

  // Decode HTML entities (RG imports &amp; as literal text)
  const decodeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

  const retreats = (retreatsData ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: decodeHtml(r.name as string),
    excerpt: r.excerpt ? decodeHtml(r.excerpt as string) : null,
    description: r.description ? decodeHtml(r.description as string) : null,
    startDate: r.start_date as string | null,
    endDate: r.end_date as string | null,
    teacher: ((r.persons as Record<string, unknown>)?.full_name as string) ?? null,
    categories: (r.categories as string[]) ?? [],
    maxCapacity: r.max_capacity as number | null,
    availableSpaces: r.available_spaces as number | null,
    currency: (r.currency as string) ?? 'USD',
    depositPercentage: (r.deposit_percentage as number) ?? 50,
    images: (r.images as unknown[]) ?? [],
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="New Booking" />
      <BookingWizard retreats={retreats} />
    </div>
  );
}
