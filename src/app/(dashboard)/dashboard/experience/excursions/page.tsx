import { EmptyState, PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSession, getSessionLocale } from '@/lib/session';
import { SupplierDirectory } from '@/modules/suppliers';
import { listSuppliers } from '@/modules/suppliers/server';
import { ACCESS_LEVELS } from '@/types';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Excursions — AO Platform' };
export const dynamic = 'force-dynamic';

export default async function ExperienceExcursionsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const session = await getSession();
  // Net prices and supplier notes: staff only.
  const staff = (session?.accessLevel ?? 0) >= ACCESS_LEVELS.staff;

  return (
    <div className="space-y-6">
      <PageHeader title={dict.experience.excursionsTitle} description={dict.experience.excursionsSubtitle} />
      {staff ? (
        <SupplierDirectory suppliers={await listSuppliers()} labels={dict.experience.suppliers} locale={locale} />
      ) : (
        <EmptyState title={dict.experience.comingSoon} description={dict.experience.comingSoonDesc} />
      )}
    </div>
  );
}
