import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { RetreatHeader, RetreatRoster, type RosterRow } from '@/modules/retreats';
import { PageHeader } from '@/components/shared';

export const metadata = { title: 'Retreat Detail — AO Platform' };

const decodeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RetreatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = createServiceClient();

  // 1. Retreat header
  const { data: retreat } = await supabase
    .from('retreats')
    .select('*, persons!retreats_leader_person_id_fkey(full_name)')
    .eq('id', id)
    .single();

  if (!retreat) notFound();
  const r = retreat as Record<string, unknown>;
  const leader = r.persons as Record<string, unknown> | null;
  const currency = (r.currency as string) ?? 'USD';

  // 2. All bookings for this retreat with guest + room + lodging data
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select(`
      id, reference_code, status, booking_type, num_guests, total_amount, notes,
      check_in, check_out,
      rooms(name),
      lodging_types(name, occupancy_type),
      persons(full_name, email, gender)
    `)
    .eq('retreat_id', id)
    .not('status', 'in', '("cancelled","no_show")')
    .order('check_in');

  const bookings = (bookingsRaw ?? []) as Array<Record<string, unknown>>;

  // 3. Get booking IDs for transaction + participant lookups
  const bookingIds = bookings.map((b) => b.id as string);

  // 4. Transactions — compute deposits per booking
  const depositMap = new Map<string, { amount: number; date: string | null }>();
  if (bookingIds.length > 0) {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('booking_id, credit_amount, trans_date, class')
      .in('booking_id', bookingIds)
      .in('class', ['card_payment', 'non_cc_payment']);

    for (const tx of (transactions ?? []) as Array<{ booking_id: string; credit_amount: number; trans_date: string | null }>) {
      const existing = depositMap.get(tx.booking_id);
      const newAmount = (existing?.amount ?? 0) + tx.credit_amount;
      const newDate = existing?.date ?? tx.trans_date;
      depositMap.set(tx.booking_id, { amount: newAmount, date: newDate });
    }
  }

  // 5. Primary participants — transport info
  const participantMap = new Map<string, Record<string, unknown>>();
  if (bookingIds.length > 0) {
    const { data: participants } = await supabase
      .from('booking_participants')
      .select('booking_id, transport_arrival, arrival_notes, arrival_time')
      .in('booking_id', bookingIds)
      .eq('is_primary', true);

    for (const p of (participants ?? []) as Array<Record<string, unknown>>) {
      participantMap.set(p.booking_id as string, p);
    }
  }

  // 6. Guest details (dietary) — person_roles → guest_details chain
  const dietaryMap = new Map<string, string>();
  if (bookingIds.length > 0) {
    const { data: bookingPersons } = await supabase
      .from('bookings')
      .select('id, person_id')
      .in('id', bookingIds);

    const pIds = (bookingPersons ?? []).map((b: Record<string, unknown>) => b.person_id as string).filter(Boolean);
    const bookingToPersonId = new Map((bookingPersons ?? []).map((b: Record<string, unknown>) => [b.id as string, b.person_id as string]));

    if (pIds.length > 0) {
      const { data: guestRoleDef } = await supabase.from('roles').select('id').eq('slug', 'guest').single();
      if (guestRoleDef) {
        const { data: personRoles } = await supabase
          .from('person_roles')
          .select('id, person_id')
          .in('person_id', pIds)
          .eq('role_id', guestRoleDef.id)
          .eq('status', 'active');

        const prIds = (personRoles ?? []).map((pr: Record<string, unknown>) => pr.id as string);
        const personToRole = new Map((personRoles ?? []).map((pr: Record<string, unknown>) => [pr.person_id as string, pr.id as string]));

        if (prIds.length > 0) {
          const { data: guestDetails } = await supabase
            .from('guest_details')
            .select('person_role_id, dietary_restrictions')
            .in('person_role_id', prIds);

          const roleTodietary = new Map((guestDetails ?? []).map((gd: Record<string, unknown>) => [gd.person_role_id as string, gd.dietary_restrictions as string]));

          // Map booking_id → dietary
          for (const [bookingId, personId] of bookingToPersonId) {
            const roleId = personToRole.get(personId);
            if (roleId) {
              const dietary = roleTodietary.get(roleId);
              if (dietary) dietaryMap.set(bookingId, dietary);
            }
          }
        }
      }
    }
  }

  // 7. Build roster rows
  const rows: RosterRow[] = bookings.map((b) => {
    const room = b.rooms as Record<string, unknown> | null;
    const person = b.persons as Record<string, unknown> | null;
    const deposit = depositMap.get(b.id as string);
    const participant = participantMap.get(b.id as string);
    const totalAmount = Number(b.total_amount) || 0;
    const depositAmount = deposit?.amount ?? 0;

    return {
      bookingId: b.id as string,
      roomName: (room?.name as string) ?? '—',
      bookingType: (b.booking_type as string) ?? null,
      guestName: (person?.full_name as string) ?? null,
      notes: (b.notes as string) ?? null,
      email: (person?.email as string) ?? null,
      gender: (person?.gender as string) ?? null,
      totalAmount,
      depositAmount,
      depositDate: deposit?.date ?? null,
      balance: Math.max(0, totalAmount - depositAmount),
      pickupLocation: (participant?.transport_arrival as string) ?? null,
      operator: (participant?.arrival_notes as string) ?? null,
      arrivalTime: (participant?.arrival_time as string) ?? null,
      dietary: dietaryMap.get(b.id as string) ?? null,
    };
  });

  // Sort by room name
  rows.sort((a, b) => a.roomName.localeCompare(b.roomName));

  // Compute totals for header
  const totalRevenue = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalDeposits = rows.reduce((s, r) => s + r.depositAmount, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={decodeHtml(r.name as string)} />

      <RetreatHeader
        name={decodeHtml(r.name as string)}
        teacher={(leader?.full_name as string) ?? null}
        startDate={r.start_date as string | null}
        endDate={r.end_date as string | null}
        status={r.status as string}
        maxCapacity={r.max_capacity as number | null}
        bookedCount={rows.filter((r) => r.guestName).length}
        totalRevenue={totalRevenue}
        totalDeposits={totalDeposits}
        totalBalance={totalBalance}
        currency={currency}
        categories={(r.categories as string[]) ?? []}
      />

      <RetreatRoster rows={rows} currency={currency} />
    </div>
  );
}
