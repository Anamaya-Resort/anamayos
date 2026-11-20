import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { decodeHtml } from '@/lib/decode-html';
import { DESK_CONFIG } from '../config';
import { addDays, todayIn } from '../time';
import type { DeskGuest } from '../types';

const SELECT = `id, check_in, check_out, person_id,
  persons:person_id ( id, full_name, email, avatar_url ),
  rooms:room_id ( name ),
  retreats:retreat_id ( name )`;

interface Row {
  id: string;
  check_in: string;
  check_out: string;
  person_id: string | null;
  persons: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;
  rooms: { name: string } | null;
  retreats: { name: string } | null;
}

function toGuest(r: Row, today: string): DeskGuest | null {
  if (!r.persons) return null;
  return {
    bookingId: r.id,
    personId: r.persons.id,
    name: r.persons.full_name?.trim() || r.persons.email || '',
    email: r.persons.email,
    avatarUrl: r.persons.avatar_url,
    room: r.rooms?.name ?? null,
    retreat: r.retreats?.name ? decodeHtml(r.retreats.name) : null,
    checkIn: r.check_in,
    checkOut: r.check_out,
    inHouse: r.check_in <= today && r.check_out >= today,
  };
}

/**
 * No query: everyone staying today. With a query: matching guests whose
 * stay is current or starts within 60 days (so reception can pre-book).
 */
export async function listDeskGuests(query: string): Promise<DeskGuest[]> {
  const supabase = createServiceClient();
  const today = todayIn(DESK_CONFIG.timezone);
  const q = query.trim();

  let req = supabase
    .from('bookings')
    .select(SELECT)
    .in('status', [...DESK_CONFIG.inHouseStatuses])
    .not('person_id', 'is', null)
    .order('check_out', { ascending: true })
    .limit(q ? 40 : 200);

  if (!q) {
    req = req.lte('check_in', today).gte('check_out', today);
  } else {
    const safe = q.replace(/[%,()]/g, ' ').slice(0, 80);
    const { data: people } = await supabase
      .from('persons')
      .select('id')
      .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
      .limit(100);
    const ids = (people ?? []).map((p) => p.id);
    if (!ids.length) return [];
    req = req.in('person_id', ids).gte('check_out', today).lte('check_in', addDays(today, 60));
  }

  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const guests = ((data ?? []) as unknown as Row[]).map((r) => toGuest(r, today)).filter(Boolean) as DeskGuest[];
  return guests.sort((a, b) => Number(b.inHouse) - Number(a.inHouse) || a.name.localeCompare(b.name));
}
