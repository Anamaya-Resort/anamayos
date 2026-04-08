import { redirect } from 'next/navigation';
import { MyProfileView } from '@/modules/people/my-profile-view';
import { getDictionary } from '@/i18n';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { Person, GuestDetails, PersonRelationship, Booking } from '@/types';
import type { Locale } from '@/config/app';

export const metadata = { title: 'My Profile — AO Platform' };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const locale = (session.locale ?? 'en') as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  // Fetch person
  const { data: person, error: personError } = await supabase
    .from('persons')
    .select('*')
    .eq('id', session.personId)
    .single();

  if (personError || !person) redirect('/dashboard');

  // Fetch guest_details (if they have a guest role)
  let guestDetails: GuestDetails | null = null;

  const { data: guestRoleDef } = await supabase
    .from('roles')
    .select('id')
    .eq('slug', 'guest')
    .single();

  if (guestRoleDef) {
    const { data: personGuestRole } = await supabase
      .from('person_roles')
      .select('id')
      .eq('person_id', session.personId)
      .eq('role_id', guestRoleDef.id)
      .eq('status', 'active')
      .single();

    if (personGuestRole) {
      const { data: gd } = await supabase
        .from('guest_details')
        .select('*')
        .eq('person_role_id', personGuestRole.id)
        .single();
      guestDetails = (gd as unknown as GuestDetails) ?? null;
    }
  }

  // Fetch relationships
  const { data: rels } = await supabase
    .from('person_relationships')
    .select('*, related:related_person_id(full_name)')
    .eq('person_id', session.personId);

  const relationships = (rels ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as PersonRelationship),
    related_person_name: ((r.related as Record<string, unknown>)?.full_name as string) ?? '',
  }));

  // Fetch bookings for stay history (use person_id, fall back to checking profile_id too)
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('person_id', session.personId)
    .order('check_in', { ascending: false });

  return (
    <MyProfileView
      person={person as unknown as Person}
      guestDetails={guestDetails}
      relationships={relationships}
      bookings={(bookings ?? []) as unknown as Booking[]}
      dict={dict}
    />
  );
}
