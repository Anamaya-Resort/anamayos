import { PageHeader, EmptyState } from '@/components/shared';
import { getDictionary } from '@/i18n';

export const metadata = { title: 'Leads — AO Platform' };

export default function LeadsPage() {
  const dict = getDictionary('en');

  return (
    <div className="space-y-6">
      <PageHeader title={dict.nav.leads} />
      <EmptyState
        title={dict.common.noResults}
        description={dict.settings.comingSoon}
      />
    </div>
  );
}
