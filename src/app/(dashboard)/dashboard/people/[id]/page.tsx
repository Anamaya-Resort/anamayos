import { notFound } from 'next/navigation';
import { PersonDetailView } from '@/modules/people';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { PersonDetail } from '@/modules/people';
import type { Role } from '@/types';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Person Detail — AO Platform' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPerson(id: string): Promise<PersonDetail | null> {
  if (!UUID_RE.test(id)) return null;

  try {
    const supabase = createServiceClient();

    const { data: person, error } = await supabase
      .from('persons')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !person) return null;

    const { data: roleAssignments } = await supabase
      .from('person_roles')
      .select('*, roles(*)')
      .eq('person_id', id)
      .order('status', { ascending: true })
      .order('starts_at', { ascending: false });

    const assignments = (roleAssignments ?? []).map((ra: Record<string, unknown>) => ({
      ...(ra as unknown as PersonDetail['role_assignments'][0]),
      role: ra.roles as PersonDetail['role_assignments'][0]['role'],
    }));

    return {
      ...(person as unknown as PersonDetail),
      role_assignments: assignments,
    };
  } catch {
    return null;
  }
}

async function getAllRoles(): Promise<Role[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('roles')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as unknown as Role[];
  } catch {
    return [];
  }
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const [person, allRoles] = await Promise.all([getPerson(id), getAllRoles()]);

  if (!person) notFound();

  return <PersonDetailView person={person} allRoles={allRoles} dict={dict} />;
}
