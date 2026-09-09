import { PageHeader } from '@/components/shared';
import { EmptyState } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Gifts — AO Platform' };

export default async function ExperienceGiftsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <PageHeader title={dict.experience.giftsTitle} description={dict.experience.giftsSubtitle} />
      <EmptyState
        title={dict.experience.comingSoon}
        description={dict.experience.comingSoonDesc}
      />
    </div>
  );
}
