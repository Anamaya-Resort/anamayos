import Link from 'next/link';
import type { TranslationKeys } from '@/i18n/en';

const BOOKINGS_PATH = '/dashboard/bookings';

export type BookingsTab = 'list' | 'charts';

/**
 * Sections of the Bookings page.
 *
 * Links rather than client state, so each section is a real URL that can
 * be bookmarked, and the list tab never pays for the charts query.
 */
export function BookingsTabs({ active, dict }: { active: BookingsTab; dict: TranslationKeys }) {
  const tabs: Array<{ key: BookingsTab; label: string; href: string }> = [
    { key: 'list', label: dict.bookings.tabList, href: BOOKINGS_PATH },
    { key: 'charts', label: dict.bookings.tabCharts, href: `${BOOKINGS_PATH}?tab=charts` },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm transition-colors ${
              on
                ? 'border-primary bg-card font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
