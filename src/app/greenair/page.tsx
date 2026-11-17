import Image from 'next/image';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/config/app';
import { GreenAirSearch, type SearchParams } from '@/modules/greenair';
import { GreenAirLogo } from '@/modules/greenair/components/logo';
import { crToday, getConfig, searchSchema } from '@/modules/greenair/server';

/**
 * PUBLIC page: Green Airways flight search for guests, in our own design.
 * Prefilled with San José -> Cóbano, the flight most guests take.
 * Prices come live from Green Airways (15-minute cache); booking happens on
 * their site. Public on purpose: it holds no internal data.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { lang } = await searchParams;
  return { title: getDictionary(lang === 'es' ? 'es' : 'en').greenair.pageTitle };
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Retreats run Saturday to Saturday: default to the next Saturday at least 3 days out. */
function nextSaturday(today: string) {
  let d = addDays(today, 3);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 6) d = addDays(d, 1);
  return d;
}

export default async function GreenAirPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  const locale: Locale = q.lang === 'es' ? 'es' : 'en';
  const labels = getDictionary(locale).greenair;
  const today = crToday();
  const config = await getConfig();

  const depart = nextSaturday(today);
  let initial: SearchParams = { from: 'SJO', to: 'ACO', depart, return: addDays(depart, 7), adults: 1 };
  const asked = searchSchema.safeParse({ ...initial, ...q, return: q.return || (q.from ? undefined : initial.return) });
  if (asked.success && config.routes[asked.data.from]?.includes(asked.data.to) && asked.data.depart >= today) {
    initial = asked.data;
  }

  return (
    <div className="min-h-screen bg-brand-subtle">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
        <header className="mb-8 space-y-4 text-center">
          <h1>
            <GreenAirLogo title={labels.title} className="mx-auto h-auto w-full max-w-xs text-brand-btn sm:max-w-sm" />
          </h1>
          <p className="text-sm text-muted-foreground lg:whitespace-nowrap">{labels.subtitle}</p>
          <Image src="/flower-divider.png" alt="" width={480} height={24} className="mx-auto h-auto w-full max-w-md" />
        </header>
        <GreenAirSearch config={config} initial={initial} today={today} labels={labels} locale={locale} />
      </div>
    </div>
  );
}
