import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { RetreatEditor } from '@/modules/retreats/retreat-editor';

export const metadata = { title: 'Create Retreat — AO Platform' };

export default async function CreateRetreatPage() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) redirect('/dashboard');

  return (
    <div className="max-w-4xl mx-auto">
      <RetreatEditor sessionAccessLevel={session.accessLevel} sessionPersonId={session.personId} />
    </div>
  );
}
