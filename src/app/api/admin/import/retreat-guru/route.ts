import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import {
  fetchRGRooms,
  fetchRGLodgings,
  fetchRGTeachers,
  fetchRGPeople,
  fetchRGPrograms,
  fetchRGRegistrations,
  fetchRGLeads,
  fetchRGTransactions,
  fetchRGRoomBlocks,
} from '@/lib/retreat-guru';

// Use negative IDs for teachers to avoid collision with people IDs
const TEACHER_RG_ID_OFFSET = -100000;

const BOOKING_STATUS_MAP: Record<string, string> = {
  reserved: 'confirmed',
  pending: 'inquiry',
  cancelled: 'cancelled',
  'checked-in': 'checked_in',
  'checked-out': 'checked_out',
  completed: 'checked_out',
  'waiting-list': 'inquiry',
  hold: 'inquiry',
  'no-show': 'no_show',
};

const TX_CLASS_MAP: Record<string, string> = {
  item: 'item',
  'card-payment': 'card_payment',
  'non-cc-payment': 'non_cc_payment',
  discount: 'discount',
  'card-refund': 'card_refund',
};

const TX_CAT_MAP: Record<string, string> = {
  lodging: 'lodging',
  payment: 'payment',
  'other-payment': 'other_payment',
  discount: 'discount',
  'program-addon': 'program_addon',
  program: 'program',
  retreatpackage: 'retreat_package',
  'cash-payment': 'cash_payment',
  'other-charge': 'other_charge',
  refund: 'refund',
};

/**
 * POST /api/admin/import/retreat-guru
 * Full import from Retreat Guru. Admin only (access_level >= 5).
 */
export async function POST() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const log: string[] = [];
  const errors: string[] = [];

  function logError(context: string, msg: string) {
    errors.push(`${context}: ${msg}`);
  }

  try {
    // ============================================================
    // 1. ROOMS — match by name
    // ============================================================
    log.push('Importing rooms...');
    const rgRooms = await fetchRGRooms();
    let roomsMapped = 0;

    for (const rgRoom of rgRooms) {
      // Try exact match first, then case-insensitive exact match
      const { data } = await supabase
        .from('rooms')
        .update({ rg_id: rgRoom.id })
        .ilike('name', rgRoom.name)
        .select('id');
      if (data && data.length === 1) {
        roomsMapped++;
      } else if (data && data.length > 1) {
        logError(`Room ${rgRoom.id}`, `Multiple matches for "${rgRoom.name}" — skipping`);
      } else {
        logError(`Room ${rgRoom.id}`, `No match for "${rgRoom.name}"`);
      }
    }
    log.push(`Rooms: ${roomsMapped}/${rgRooms.length} matched`);

    // Build room lookup
    const { data: ourRooms } = await supabase.from('rooms').select('id, rg_id, name');
    const roomByRgId = new Map<number, string>();
    const roomByName = new Map<string, string>();
    for (const r of (ourRooms ?? []) as Array<{ id: string; rg_id: number | null; name: string }>) {
      if (r.rg_id) roomByRgId.set(r.rg_id, r.id);
      roomByName.set(r.name.toLowerCase(), r.id);
    }

    // ============================================================
    // 2. LODGINGS
    // ============================================================
    log.push('Importing lodgings...');
    const rgLodgings = await fetchRGLodgings();
    let lodgingsImported = 0;

    for (const lg of rgLodgings) {
      // Match lodging to room: check if lodging name starts with a known room name
      let matchedRoomId: string | null = null;
      const lgNameLower = lg.name.toLowerCase();
      let bestMatchLen = 0;
      for (const [roomName, roomId] of roomByName) {
        // Lodging "Bali Cabina" should match room "Bali" — longest prefix wins
        if (lgNameLower.startsWith(roomName) && roomName.length > bestMatchLen) {
          matchedRoomId = roomId;
          bestMatchLen = roomName.length;
        }
      }

      const { error } = await supabase.from('lodging_types').upsert(
        {
          rg_id: lg.id,
          name: lg.name,
          description: lg.description ?? null,
          occupancy_type: lg.occupancy_type ?? null,
          max_occupancy: lg.max_occupancy ?? null,
          base_price: lg.base_price ?? null,
          room_id: matchedRoomId,
          images: lg.images ?? [],
        },
        { onConflict: 'rg_id' },
      );
      if (error) logError(`Lodging ${lg.id}`, error.message);
      else lodgingsImported++;
    }
    log.push(`Lodgings: ${lodgingsImported}/${rgLodgings.length} imported`);

    // Build lodging lookup
    const { data: ourLodgings } = await supabase.from('lodging_types').select('id, rg_id');
    const lodgingByRgId = new Map<number, string>();
    for (const l of (ourLodgings ?? []) as Array<{ id: string; rg_id: number | null }>) {
      if (l.rg_id) lodgingByRgId.set(l.rg_id, l.id);
    }

    // ============================================================
    // 3. TEACHERS → persons + person_roles (retreat_leader)
    // ============================================================
    log.push('Importing teachers...');
    const rgTeachers = await fetchRGTeachers();
    let teachersImported = 0;

    const { data: retreatLeaderRole } = await supabase
      .from('roles')
      .select('id')
      .eq('slug', 'retreat_leader')
      .single();

    for (const t of rgTeachers) {
      const email = t.email || `teacher-rg-${t.id}@placeholder.local`;
      const teacherRgId = t.id + TEACHER_RG_ID_OFFSET; // Negative to never collide with people

      // Check if person already exists by email
      const { data: existing } = await supabase
        .from('persons')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      let personId: string;
      if (existing) {
        // Update rg_id on existing person
        await supabase.from('persons').update({ rg_id: teacherRgId }).eq('id', existing.id);
        personId = existing.id;
      } else {
        const { data: person, error } = await supabase
          .from('persons')
          .upsert(
            {
              email: email.toLowerCase().trim(),
              full_name: t.name,
              phone: t.phone ?? null,
              rg_id: teacherRgId,
              notes: t.content ?? null,
            },
            { onConflict: 'rg_id' },
          )
          .select('id')
          .single();
        if (error || !person) {
          logError(`Teacher ${t.id}`, error?.message ?? 'upsert failed');
          continue;
        }
        personId = person.id;
      }

      if (retreatLeaderRole) {
        await supabase.from('person_roles').upsert(
          {
            person_id: personId,
            role_id: retreatLeaderRole.id,
            status: 'active',
            starts_at: new Date().toISOString().split('T')[0],
          },
          { onConflict: 'person_id,role_id' },
        );
      }
      teachersImported++;
    }
    log.push(`Teachers: ${teachersImported}/${rgTeachers.length} imported`);

    // ============================================================
    // 4. PEOPLE → persons + guest_details
    // ============================================================
    log.push('Importing people...');
    const rgPeople = await fetchRGPeople();
    let peopleImported = 0;
    let peopleSkipped = 0;

    const { data: guestRole } = await supabase
      .from('roles')
      .select('id')
      .eq('slug', 'guest')
      .single();

    for (const p of rgPeople) {
      if (!p.email) { peopleSkipped++; continue; }

      const email = p.email.toLowerCase().trim();
      const q = (p.questions ?? {}) as Record<string, unknown>;

      // Check if person exists by email already (e.g., from SSO login)
      const { data: existingByEmail } = await supabase
        .from('persons')
        .select('id, rg_id')
        .eq('email', email)
        .single();

      let personId: string;
      if (existingByEmail) {
        // Update existing person with RG data if rg_id not set
        if (!existingByEmail.rg_id) {
          await supabase.from('persons').update({
            rg_id: p.id,
            full_name: p.full_name || undefined,
            phone: (q.phone as string) ?? undefined,
            gender: (q.gender as string) ?? undefined,
            country: (q.country as string) ?? undefined,
            city: (q.city as string) ?? undefined,
          }).eq('id', existingByEmail.id);
        }
        personId = existingByEmail.id;
      } else {
        const { data: person, error: personErr } = await supabase
          .from('persons')
          .upsert(
            {
              rg_id: p.id,
              email,
              full_name: p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || null,
              phone: (q.phone as string) ?? null,
              gender: (q.gender as string) ?? null,
              country: (q.country as string) ?? null,
              city: (q.city as string) ?? null,
            },
            { onConflict: 'rg_id' },
          )
          .select('id')
          .single();

        if (personErr || !person) {
          logError(`Person ${p.id} (${email})`, personErr?.message ?? 'upsert failed');
          continue;
        }
        personId = person.id;
      }

      // Create guest role + details if not exists
      if (guestRole) {
        const { data: existingGuestRole } = await supabase
          .from('person_roles')
          .select('id')
          .eq('person_id', personId)
          .eq('role_id', guestRole.id)
          .single();

        if (!existingGuestRole) {
          const { data: newRole } = await supabase
            .from('person_roles')
            .insert({
              person_id: personId,
              role_id: guestRole.id,
              status: 'active',
              starts_at: p.registered?.split(' ')[0] ?? new Date().toISOString().split('T')[0],
            })
            .select('id')
            .single();

          if (newRole) {
            await supabase.from('guest_details').upsert(
              {
                person_role_id: newRole.id,
                dietary_restrictions: (q['diet-notes'] as string) ?? (q.diet as string) ?? null,
                medical_conditions: (q.medical as string) ?? null,
                how_heard_about_us: (q.marketing as string) ?? (q['who-can-we-thank-for-telling-you-about-anamaya'] as string) ?? null,
              },
              { onConflict: 'person_role_id' },
            );
          }
        }
      }

      peopleImported++;
    }
    log.push(`People: ${peopleImported}/${rgPeople.length} imported (${peopleSkipped} skipped — no email)`);

    // Build person lookup
    const { data: allPersons } = await supabase.from('persons').select('id, rg_id');
    const personByRgId = new Map<number, string>();
    for (const pe of (allPersons ?? []) as Array<{ id: string; rg_id: number | null }>) {
      if (pe.rg_id) personByRgId.set(pe.rg_id, pe.id);
    }

    // ============================================================
    // 5. PROGRAMS → retreats
    // ============================================================
    log.push('Importing programs as retreats...');
    const rgPrograms = await fetchRGPrograms();
    let retreatsImported = 0;

    const validDateTypes = ['fixed', 'package', 'hotel', 'dateless'];
    const validStatuses = ['draft', 'confirmed', 'cancelled', 'completed'];

    for (const prog of rgPrograms) {
      const dateType = validDateTypes.includes(prog.date_type ?? '') ? prog.date_type : 'fixed';
      const status = validStatuses.includes(prog.status ?? '') ? prog.status : 'draft';

      const { error } = await supabase.from('retreats').upsert(
        {
          rg_id: prog.id,
          name: prog.name,
          description: prog.content ?? null,
          excerpt: prog.excerpt ?? null,
          date_type: dateType,
          start_date: prog.start_date ?? null,
          end_date: prog.end_date ?? null,
          package_nights: prog.package_nights ?? null,
          status,
          is_public: prog.public ?? true,
          registration_status: prog.program_registration_status ?? 'open',
          categories: prog.categories ?? [],
          pricing_type: prog.pricing_type === 'tiered' ? 'tiered' : 'lodging',
          pricing_options: prog.pricing_options ?? {},
          deposit_percentage: prog.deposit_percentage ?? 60,
          max_capacity: prog.max_capacity ?? null,
          available_spaces: prog.available_spaces ?? null,
          currency: prog.currency ?? 'USD',
          waitlist_enabled: prog.waitlist_enabled ?? false,
          program_info: prog.program_info ?? {},
          images: prog.images ?? [],
          external_link: prog.program_link ?? null,
          registration_link: prog.registration_link ?? null,
        },
        { onConflict: 'rg_id' },
      );
      if (error) logError(`Program ${prog.id}`, error.message);
      else retreatsImported++;
    }
    log.push(`Retreats: ${retreatsImported}/${rgPrograms.length} imported`);

    // Build retreat lookup
    const { data: allRetreats } = await supabase.from('retreats').select('id, rg_id');
    const retreatByRgId = new Map<number, string>();
    for (const r of (allRetreats ?? []) as Array<{ id: string; rg_id: number | null }>) {
      if (r.rg_id) retreatByRgId.set(r.rg_id, r.id);
    }

    // ============================================================
    // 6. ROOM BLOCKS
    // ============================================================
    log.push('Importing room blocks...');
    const rgBlocks = await fetchRGRoomBlocks();
    let blocksImported = 0;

    for (const block of rgBlocks) {
      if (!block.start_date || !block.end_date) {
        logError(`Room block ${block.id}`, 'Missing start_date or end_date');
        continue;
      }

      const { data: newBlock, error } = await supabase
        .from('retreat_room_blocks')
        .upsert(
          {
            rg_id: block.id,
            name: block.name ?? 'Unnamed Block',
            description: block.description ?? null,
            block_type: 'simple',
            start_date: block.start_date,
            end_date: block.end_date,
          },
          { onConflict: 'rg_id' },
        )
        .select('id')
        .single();

      if (error || !newBlock) {
        logError(`Room block ${block.id}`, error?.message ?? 'insert failed');
        continue;
      }

      // Link rooms to block
      if (block.lodgings) {
        for (const lodging of block.lodgings) {
          for (const room of lodging.rooms ?? []) {
            const ourRoomId = roomByRgId.get(room.id);
            if (ourRoomId) {
              await supabase
                .from('retreat_room_block_rooms')
                .upsert(
                  { block_id: newBlock.id, room_id: ourRoomId },
                  { onConflict: 'block_id,room_id' },
                );
            }
          }
        }
      }
      blocksImported++;
    }
    log.push(`Room blocks: ${blocksImported}/${rgBlocks.length} imported`);

    // ============================================================
    // 7. REGISTRATIONS → bookings
    // ============================================================
    log.push('Importing registrations as bookings...');
    const rgRegs = await fetchRGRegistrations();
    let bookingsImported = 0;
    let bookingsSkipped = 0;
    let bookingsFailed = 0;

    for (const reg of rgRegs) {
      const personId = reg.person_id ? personByRgId.get(reg.person_id) : null;
      if (!personId) { bookingsSkipped++; continue; }
      if (!reg.start_date || !reg.end_date) { bookingsSkipped++; continue; }
      if (reg.end_date <= reg.start_date) {
        logError(`Reg ${reg.id}`, `Invalid dates: ${reg.start_date} to ${reg.end_date}`);
        bookingsFailed++;
        continue;
      }

      const retreatId = reg.program_id ? retreatByRgId.get(reg.program_id) : null;
      const roomId = reg.room_id ? roomByRgId.get(reg.room_id) : null;
      const lodgingId = reg.lodging_id ? lodgingByRgId.get(reg.lodging_id) : null;
      const bookingStatus = BOOKING_STATUS_MAP[reg.status ?? ''] ?? 'inquiry';

      const { error } = await supabase.from('bookings').upsert(
        {
          rg_id: reg.id,
          person_id: personId,
          retreat_id: retreatId ?? null,
          room_id: roomId ?? null,
          lodging_type_id: lodgingId ?? null,
          status: bookingStatus,
          check_in: reg.start_date,
          check_out: reg.end_date,
          num_guests: 1,
          total_amount: reg.grand_total ?? 0,
          currency: 'USD',
          guest_type: reg.guest_type ?? 'participant',
          rg_parent_booking_id: reg.parent_registration_id ?? null,
          questions: reg.questions ?? {},
          notes: null,
        },
        { onConflict: 'rg_id' },
      );
      if (error) { logError(`Reg ${reg.id}`, error.message); bookingsFailed++; }
      else bookingsImported++;
    }
    log.push(`Bookings: ${bookingsImported}/${rgRegs.length} imported (${bookingsSkipped} skipped, ${bookingsFailed} failed)`);

    // Build booking lookup
    const { data: allBookings } = await supabase.from('bookings').select('id, rg_id');
    const bookingByRgId = new Map<number, string>();
    for (const b of (allBookings ?? []) as Array<{ id: string; rg_id: number | null }>) {
      if (b.rg_id) bookingByRgId.set(b.rg_id, b.id);
    }

    // ============================================================
    // 8. LEADS
    // ============================================================
    log.push('Importing leads...');
    const rgLeads = await fetchRGLeads();
    let leadsImported = 0;

    for (const lead of rgLeads) {
      if (!lead.email) continue;

      const { error } = await supabase.from('leads').upsert(
        {
          rg_id: lead.id,
          email: lead.email.toLowerCase().trim(),
          full_name: lead.full_name || `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || null,
          source: lead.lead_type ?? null,
          status: 'new',
          notes: lead.program ? `Program: ${lead.program}` : null,
        },
        { onConflict: 'rg_id' },
      );
      if (error) logError(`Lead ${lead.id}`, error.message);
      else leadsImported++;
    }
    log.push(`Leads: ${leadsImported}/${rgLeads.length} imported`);

    // ============================================================
    // 9. TRANSACTIONS
    // ============================================================
    log.push('Importing transactions...');
    const rgTrans = await fetchRGTransactions();
    let transImported = 0;

    for (const tx of rgTrans) {
      const txClass = TX_CLASS_MAP[tx.class ?? ''];
      const txCat = TX_CAT_MAP[tx.category ?? ''];
      if (!txClass || !txCat) {
        logError(`Transaction ${tx.id}`, `Unknown class="${tx.class}" or category="${tx.category}"`);
        continue;
      }

      const personId = tx.person_id ? personByRgId.get(tx.person_id) : null;
      const bookingId = tx.registration_id ? bookingByRgId.get(tx.registration_id) : null;
      const retreatId = tx.program_id ? retreatByRgId.get(tx.program_id) : null;

      const { error } = await supabase.from('transactions').upsert(
        {
          rg_id: tx.id,
          submitted_at: tx.submitted ?? new Date().toISOString(),
          trans_date: tx.trans_date ?? null,
          class: txClass,
          category: txCat,
          status: tx.status ?? 'complete',
          description: tx.description ?? null,
          person_id: personId ?? null,
          booking_id: bookingId ?? null,
          retreat_id: retreatId ?? null,
          charge_amount: tx.charge_amount ?? 0,
          credit_amount: tx.credit_amount ?? 0,
          tax_1_info: tx.tax_1_info ?? null,
          tax_1_amount: tx.tax_1_amount ?? 0,
          tax_2_info: tx.tax_2_info ?? null,
          tax_2_amount: tx.tax_2_amount ?? 0,
          subtotal: tx.subtotal ?? 0,
          grand_total: tx.grand_total ?? 0,
          discount_amount: tx.discount_amount ?? 0,
          discount_percent: tx.discount_percent ?? 0,
          quantity: tx.quantity ?? 1,
          price_per_item: tx.price_per_item ?? null,
          is_addon: tx.is_addon ?? false,
          fund_method: tx.fund_method ?? null,
          merchant_name: tx.merchant_name ?? null,
          merchant_trans_id: tx.merchant_trans_id ?? null,
          revenue: tx.revenue ?? {},
          notes: tx.notes ?? null,
          gl_code: tx.glcode ?? null,
        },
        { onConflict: 'rg_id' },
      );
      if (error) logError(`Transaction ${tx.id}`, error.message);
      else transImported++;
    }
    log.push(`Transactions: ${transImported}/${rgTrans.length} imported`);

    // ============================================================
    // DONE
    // ============================================================
    log.push('Import complete.');

    return NextResponse.json({
      success: true,
      log,
      errors: errors.length > 0 ? errors.slice(0, 100) : [],
      errorCount: errors.length,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      log,
      error: err instanceof Error ? err.message : 'Unknown error',
      errors: errors.slice(0, 100),
    }, { status: 500 });
  }
}
