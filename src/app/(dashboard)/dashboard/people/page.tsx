import { PeopleListView } from '@/modules/people';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { PersonListItem } from '@/modules/people';
import type { Role } from '@/types';
import type { Locale } from '@/config/app';

export const metadata = { title: 'People — AO Platform' };

async function getPeople(): Promise<PersonListItem[]> {
  try {
    const supabase = createServiceClient();

    const { data: persons, error } = await supabase
      .from('persons')
      .select('*')
      .order('full_name', { ascending: true });

    if (error || !persons) return [];

    // Get all active role assignments with role info
    const { data: roleAssignments } = await supabase
      .from('person_roles')
      .select('person_id, status, starts_at, ends_at, roles(slug, name, category)')
      .eq('status', 'active');

    // Group roles by person_id
    const rolesByPerson = new Map<string, Array<{ slug: string; name: string; category: string }>>();
    if (roleAssignments) {
      for (const ra of roleAssignments) {
        const row = ra as Record<string, unknown>;
        const personId = row.person_id as string;
        const role = row.roles as { slug: string; name: string; category: string } | null;
        if (!role) continue;

        const now = new Date().toISOString().split('T')[0];
        const starts = row.starts_at as string;
        const ends = row.ends_at as string | null;
        if (starts > now) continue;
        if (ends && ends < now) continue;

        if (!rolesByPerson.has(personId)) rolesByPerson.set(personId, []);
        rolesByPerson.get(personId)!.push(role);
      }
    }

    return (persons as unknown as PersonListItem[]).map((p) => ({
      ...p,
      roles: (rolesByPerson.get(p.id) ?? []) as PersonListItem['roles'],
    }));
  } catch {
    return [];
  }
}

async function getRoles(): Promise<Role[]> {
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

export default async function PeoplePage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const [people, roles] = await Promise.all([getPeople(), getRoles()]);

  return <PeopleListView initialPeople={people} roles={roles} dict={dict} />;
}
