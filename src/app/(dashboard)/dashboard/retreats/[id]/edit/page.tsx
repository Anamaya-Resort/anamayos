import { getSession } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { RetreatEditor } from '@/modules/retreats/retreat-editor';

export const metadata = { title: 'Edit Retreat — AO Platform' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditRetreatPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) redirect('/dashboard');

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <RetreatEditor retreatId={id} sessionAccessLevel={session.accessLevel} sessionPersonId={session.personId} />
    </div>
  );
}
