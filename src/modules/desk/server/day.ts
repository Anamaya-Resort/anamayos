import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { SpaDay, SpaProvider, SpaRoom, SpaSession, TherapistShift } from '../types';

const t5 = (t: string | null) => (t ? t.slice(0, 5) : '');

export async function listRooms(): Promise<SpaRoom[]> {
  const { data } = await createServiceClient()
    .from('facilities').select('id, name')
    .eq('facility_type', 'spa_room').eq('is_active', true).eq('is_bookable', true)
    .order('sort_order');
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

/** Everyone with an active practitioner role. */
export async function listTherapists(): Promise<SpaProvider[]> {
  const { data } = await createServiceClient()
    .from('person_roles')
    .select('person_id, status, roles!inner ( slug ), persons:person_id ( full_name, is_active )')
    .eq('roles.slug', 'practitioner')
    .eq('status', 'active');
  const out = new Map<string, SpaProvider>();
  for (const r of data ?? []) {
    const p = r.persons as unknown as { full_name: string | null; is_active: boolean } | null;
    if (p?.is_active !== false) out.set(r.person_id, { personId: r.person_id, name: p?.full_name ?? '' });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** All spa sessions booked on a day, with their add-ons folded in. */
export async function daySessions(date: string): Promise<SpaSession[]> {
  const { data, error } = await createServiceClient()
    .from('booking_line_items')
    .select(`id, booking_id, person_id, provider_id, facility_id, scheduled_start, scheduled_end, parent_line_item_id,
      products:product_id ( name, duration_minutes, service_catalog_id ),
      guest:person_id ( full_name ), provider:provider_id ( full_name )`)
    .eq('scheduled_date', date)
    .neq('status', 'cancelled');
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const name = (r: (typeof rows)[number]) => (r.products as unknown as { name: string } | null)?.name ?? '';
  return rows
    .filter((r) => !r.parent_line_item_id && r.scheduled_start && r.scheduled_end)
    .filter((r) => (r.products as unknown as { service_catalog_id: string | null } | null)?.service_catalog_id)
    .map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      personId: r.person_id,
      guestName: (r.guest as unknown as { full_name: string | null } | null)?.full_name ?? '',
      treatment: name(r),
      minutes: (r.products as unknown as { duration_minutes: number | null } | null)?.duration_minutes ?? 0,
      addons: rows.filter((k) => k.parent_line_item_id === r.id).map(name),
      start: t5(r.scheduled_start),
      end: t5(r.scheduled_end),
      roomId: r.facility_id,
      therapistId: r.provider_id,
      therapistName: (r.provider as unknown as { full_name: string | null } | null)?.full_name ?? null,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function getSpaDay(date: string): Promise<SpaDay> {
  const supabase = createServiceClient();
  const [sessions, { data: note }, { data: shifts }] = await Promise.all([
    daySessions(date),
    supabase.from('spa_day_notes').select('note').eq('date', date).maybeSingle(),
    supabase.from('staff_availability').select('id, person_id, start_time, end_time')
      .eq('date', date).eq('is_available', true).not('start_time', 'is', null).order('start_time'),
  ]);
  return {
    date,
    note: note?.note ?? '',
    sessions,
    shifts: (shifts ?? []).map((s): TherapistShift => ({ id: s.id, personId: s.person_id, start: t5(s.start_time), end: t5(s.end_time) })),
  };
}

export async function setDayNote(date: string, note: string, by: string | null) {
  const supabase = createServiceClient();
  const clean = note.trim();
  const { error } = clean
    ? await supabase.from('spa_day_notes').upsert({ date, note: clean, updated_by: by, updated_at: new Date().toISOString() })
    : await supabase.from('spa_day_notes').delete().eq('date', date);
  if (error) throw new Error(error.message);
}

export async function addShift(personId: string, date: string, start: string, end: string): Promise<string> {
  const { data, error } = await createServiceClient().from('staff_availability')
    .insert({ person_id: personId, date, is_available: true, start_time: start, end_time: end })
    .select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'insert failed');
  return data.id;
}

export async function updateShift(id: string, start: string, end: string) {
  const { error } = await createServiceClient().from('staff_availability').update({ start_time: start, end_time: end }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteShift(id: string) {
  const { error } = await createServiceClient().from('staff_availability').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
