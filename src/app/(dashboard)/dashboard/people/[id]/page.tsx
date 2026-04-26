import { notFound } from 'next/navigation';
import { PersonDetailView } from '@/modules/people';
import { getDictionary } from '@/i18n';
import { getSession, getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { PersonDetail } from '@/modules/people';
import type { Role } from '@/types';
import type { RetreatCardData } from '@/components/shared/retreat-card';
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

async function getPersonRetreats(personId: string): Promise<RetreatCardData[]> {
  try {
    const supabase = createServiceClient();
    const { data: teacherLinks } = await supabase
      .from('retreat_teachers')
      .select('retreat_id')
      .eq('person_id', personId);

    if (!teacherLinks || teacherLinks.length === 0) return [];

    const retreatIds = teacherLinks.map((t: { retreat_id: string }) => t.retreat_id);
    const { data: retreats } = await supabase
      .from('retreats')
      .select('id, name, start_date, end_date, status, categories, excerpt, description, max_capacity, available_spaces, images, feature_image_url')
      .in('id', retreatIds)
      .order('start_date', { ascending: false });

    return (retreats ?? []) as unknown as RetreatCardData[];
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
  const [locale, session] = await Promise.all([getSessionLocale(), getSession()]);
  const dict = getDictionary(locale as Locale);
  const [person, allRoles, retreats] = await Promise.all([getPerson(id), getAllRoles(), getPersonRetreats(id)]);

  if (!person) notFound();

  return <PersonDetailView person={person} allRoles={allRoles} dict={dict}
    sessionAccessLevel={session?.accessLevel ?? 1} retreats={retreats} />;
}
