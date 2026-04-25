import { PageHeader } from '@/components/shared';

export const metadata = { title: 'Guests — AO Platform' };

export default function GuestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Guests" description="Retreat participants and hotel guests." />
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
