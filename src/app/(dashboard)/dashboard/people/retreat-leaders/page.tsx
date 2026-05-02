import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { RetreatLeadersView } from '@/modules/people/retreat-leaders-view';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Retreat Leaders — AO Platform' };

interface RetreatLeaderRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  retreat_leader_profile: {
    short_bio: string;
    photo_url: string | null;
    is_featured: boolean;
    is_active: boolean;
  } | null;
  retreats: Array<{
    retreat_id: string;
    role: string;
    is_primary: boolean;
    retreat: {
      id: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      status: string;
    };
  }>;
}

async function getRetreatLeaders(): Promise<RetreatLeaderRow[]> {
  const supabase = createServiceClient();

  // Get all persons who have an active teaching/leader role
  const teachingRoleSlugs = [
    'retreat_leader', 'retreat_co_teacher', 'retreat_assistant',
    'retreat_guest_speaker', 'yoga_teacher', 'facilitator',
  ];

  const { data: roleAssignments } = await supabase
    .from('person_roles')
    .select('person_id, roles!inner(slug)')
    .eq('status', 'active')
    .in('roles.slug', teachingRoleSlugs);

  if (!roleAssignments || roleAssignments.length === 0) return [];

  const personIds = [...new Set((roleAssignments as Array<{ person_id: string }>).map((r) => r.person_id))];

  // Fetch persons
  const { data: persons } = await supabase
    .from('persons')
    .select('id, full_name, email, phone, avatar_url, is_active')
    .in('id', personIds)
    .order('full_name');

  if (!persons) return [];

  // Fetch teacher profiles
  const { data: profiles } = await supabase
    .from('retreat_leader_profiles')
    .select('person_id, short_bio, photo_url, is_featured, is_active')
    .in('person_id', personIds);

  const profileByPerson = new Map(
    (profiles ?? []).map((p: Record<string, unknown>) => [p.person_id as string, p])
  );

  // Fetch retreat assignments
  const { data: retreatTeachers } = await supabase
    .from('retreat_teachers')
    .select('person_id, retreat_id, role, is_primary, retreat:retreats!inner(id, name, start_date, end_date, status)')
    .in('person_id', personIds)
    .order('retreat_id');

  const retreatsByPerson = new Map<string, RetreatLeaderRow['retreats']>();
  if (retreatTeachers) {
    for (const rt of retreatTeachers as Array<Record<string, unknown>>) {
      const pid = rt.person_id as string;
      if (!retreatsByPerson.has(pid)) retreatsByPerson.set(pid, []);
      retreatsByPerson.get(pid)!.push({
        retreat_id: rt.retreat_id as string,
        role: rt.role as string,
        is_primary: rt.is_primary as boolean,
        retreat: rt.retreat as RetreatLeaderRow['retreats'][0]['retreat'],
      });
    }
  }

  return persons.map((p) => ({
    ...(p as unknown as Pick<RetreatLeaderRow, 'id' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'is_active'>),
    retreat_leader_profile: (profileByPerson.get(p.id) as RetreatLeaderRow['retreat_leader_profile']) ?? null,
    retreats: retreatsByPerson.get(p.id) ?? [],
  }));
}

export default async function RetreatLeadersPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const leaders = await getRetreatLeaders();

  return <RetreatLeadersView leaders={leaders} dict={dict} locale={locale} />;
}
