import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { SyncJob } from '@/lib/sync-job';
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
 * POST /api/admin/import/retreat-guru?mode=incremental|full
 * Streaming import — sends progress updates as Server-Sent Events style newline-delimited JSON.
 * mode=incremental (default): only fetch records updated since last sync
 * mode=full: re-import everything
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit: 3 imports per 10 minutes
  if (!checkRateLimit(`import:rg:${session.user.id}`, { limit: 3, windowSeconds: 600 })) {
    return new Response(JSON.stringify({ error: 'Too many import requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') ?? 'incremental';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const supabase = createServiceClient();
      let errorCount = 0;

      // Create a persistent job record
      const job = new SyncJob(supabase, 'retreat_guru', mode);
      await job.create();

      // Read last sync timestamp for incremental mode
      let since: string | undefined;
      if (mode === 'incremental') {
        const { data: syncRow } = await supabase
          .from('sync_log').select('last_synced_at').eq('source', 'retreat_guru').single();
        if (syncRow?.last_synced_at) {
          since = syncRow.last_synced_at;
        }
      }
      const syncStartedAt = new Date().toISOString();

      function send(data: { step: string; status: string; detail?: string; count?: string }) {
        try { controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')); } catch { /* client disconnected */ }
        job.send(data);
      }

      function sendError(step: string, msg: string) {
        errorCount++;
        try { controller.enqueue(encoder.encode(JSON.stringify({ step, status: 'error', detail: msg }) + '\n')); } catch { /* client disconnected */ }
        job.sendError(step, msg);
      }

      try {
        // Report mode
        if (since) {
          send({ step: 'mode', status: 'done', detail: `Update — new retreats, bookings & transactions since ${new Date(since).toLocaleDateString()}` });
        } else {
          send({ step: 'mode', status: 'done', detail: 'Full import — all data' });
        }

        // ============================================================
        // 1. ROOMS
        // ============================================================
        send({ step: 'rooms', status: 'fetching' });
        const rgRooms = await fetchRGRooms();
        send({ step: 'rooms', status: 'importing', count: `0/${rgRooms.length}` });
        let roomsMapped = 0;

        // RG uses short names ("Gaia", "Ganesha"), our DB has full names ("Gaia Cabina", "Ganesh Room")
        // Build a manual mapping for known mismatches, then fall back to prefix match
        const rgRoomNameMap: Record<string, string> = {
          'Ganesha': 'Ganesh Room',
        };

        for (let i = 0; i < rgRooms.length; i++) {
          const rgRoom = rgRooms[i];
          const mappedName = rgRoomNameMap[rgRoom.name];

          let data;
          if (mappedName) {
            // Use explicit mapping
            ({ data } = await supabase.from('rooms').update({ rg_id: rgRoom.id }).ilike('name', mappedName).select('id'));
          } else {
            // Try prefix match: "Gaia" matches "Gaia Cabina"
            ({ data } = await supabase.from('rooms').update({ rg_id: rgRoom.id }).ilike('name', `${rgRoom.name}%`).select('id'));
          }

          if (data && data.length >= 1) roomsMapped++;
          else sendError('rooms', `No match for "${rgRoom.name}"`);
          send({ step: 'rooms', status: 'importing', count: `${i + 1}/${rgRooms.length}` });
        }
        send({ step: 'rooms', status: 'done', count: `${roomsMapped}/${rgRooms.length} matched` });

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
        send({ step: 'lodgings', status: 'fetching' });
        const rgLodgings = await fetchRGLodgings();
        let lodgingsImported = 0;

        for (let i = 0; i < rgLodgings.length; i++) {
          const lg = rgLodgings[i];
          let matchedRoomId: string | null = null;
          const lgNameLower = lg.name.toLowerCase();
          let bestMatchLen = 0;
          for (const [roomName, roomId] of roomByName) {
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
          if (error) sendError('lodgings', `${lg.id}: ${error.message}`);
          else lodgingsImported++;
          send({ step: 'lodgings', status: 'importing', count: `${i + 1}/${rgLodgings.length}` });
        }
        send({ step: 'lodgings', status: 'done', count: `${lodgingsImported}/${rgLodgings.length}` });

        const { data: ourLodgings } = await supabase.from('lodging_types').select('id, rg_id');
        const lodgingByRgId = new Map<number, string>();
        for (const l of (ourLodgings ?? []) as Array<{ id: string; rg_id: number | null }>) {
          if (l.rg_id) lodgingByRgId.set(l.rg_id, l.id);
        }

        // ============================================================
        // 3. TEACHERS
        // ============================================================
        send({ step: 'teachers', status: 'fetching' });
        const rgTeachers = await fetchRGTeachers();
        let teachersImported = 0;

        const { data: retreatLeaderRole } = await supabase
          .from('roles').select('id').eq('slug', 'retreat_leader').single();

        for (let i = 0; i < rgTeachers.length; i++) {
          const t = rgTeachers[i];
          const email = t.email || `teacher-rg-${t.id}@placeholder.local`;
          const teacherRgId = t.id + TEACHER_RG_ID_OFFSET;

          const { data: existing } = await supabase
            .from('persons').select('id').eq('email', email.toLowerCase().trim()).single();

          let personId: string;
          if (existing) {
            await supabase.from('persons').update({ rg_id: teacherRgId }).eq('id', existing.id);
            personId = existing.id;
          } else {
            const { data: person, error } = await supabase
              .from('persons')
              .upsert({ email: email.toLowerCase().trim(), full_name: t.name, phone: t.phone ?? null, rg_id: teacherRgId, notes: t.content ?? null }, { onConflict: 'rg_id' })
              .select('id').single();
            if (error || !person) { sendError('teachers', `${t.id}: ${error?.message ?? 'failed'}`); continue; }
            personId = person.id;
          }

          if (retreatLeaderRole) {
            await supabase.from('person_roles').upsert(
              { person_id: personId, role_id: retreatLeaderRole.id, status: 'active', starts_at: new Date().toISOString().split('T')[0] },
              { onConflict: 'person_id,role_id' },
            );
          }
          teachersImported++;
          send({ step: 'teachers', status: 'importing', count: `${i + 1}/${rgTeachers.length}` });
        }
        send({ step: 'teachers', status: 'done', count: `${teachersImported}/${rgTeachers.length}` });

        // ============================================================
        // 4. PEOPLE
        // ============================================================
        send({ step: 'people', status: 'fetching' });
        const rgPeople = await fetchRGPeople();
        send({ step: 'people', status: 'importing', count: `0/${rgPeople.length}` });
        let peopleImported = 0;

        const { data: guestRole } = await supabase
          .from('roles').select('id').eq('slug', 'guest').single();

        for (let i = 0; i < rgPeople.length; i++) {
          const p = rgPeople[i];

          // Generate placeholder email if missing — never skip a person
          let email: string;
          if (p.email) {
            email = p.email.toLowerCase().trim();
          } else {
            const namePart = (p.full_name || `${p.first_name ?? ''}-${p.last_name ?? ''}` || `person-${p.id}`)
              .toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/, '');
            email = `${namePart}-rg${p.id}@noemail.placeholder`;
          }
          const q = (p.questions ?? {}) as Record<string, unknown>;

          const { data: existingByEmail } = await supabase
            .from('persons').select('id, rg_id').eq('email', email).single();

          let personId: string;
          if (existingByEmail) {
            if (!existingByEmail.rg_id) {
              await supabase.from('persons').update({
                rg_id: p.id, full_name: p.full_name || undefined,
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
              .upsert({
                rg_id: p.id, email,
                full_name: p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || null,
                phone: (q.phone as string) ?? null, gender: (q.gender as string) ?? null,
                country: (q.country as string) ?? null, city: (q.city as string) ?? null,
              }, { onConflict: 'rg_id' })
              .select('id').single();
            if (personErr || !person) { sendError('people', `${p.id}: ${personErr?.message ?? 'failed'}`); continue; }
            personId = person.id;
          }

          if (guestRole) {
            const { data: existingGuestRole } = await supabase
              .from('person_roles').select('id').eq('person_id', personId).eq('role_id', guestRole.id).single();
            if (!existingGuestRole) {
              const { data: newRole } = await supabase
                .from('person_roles')
                .insert({ person_id: personId, role_id: guestRole.id, status: 'active', starts_at: p.registered?.split(' ')[0] ?? new Date().toISOString().split('T')[0] })
                .select('id').single();
              if (newRole) {
                await supabase.from('guest_details').upsert({
                  person_role_id: newRole.id,
                  dietary_restrictions: (q['diet-notes'] as string) ?? (q.diet as string) ?? null,
                  medical_conditions: (q.medical as string) ?? null,
                  how_heard_about_us: (q.marketing as string) ?? (q['who-can-we-thank-for-telling-you-about-anamaya'] as string) ?? null,
                }, { onConflict: 'person_role_id' });
              }
            }
          }
          peopleImported++;
          if ((i + 1) % 20 === 0 || i === rgPeople.length - 1) {
            send({ step: 'people', status: 'importing', count: `${i + 1}/${rgPeople.length}` });
          }
        }
        send({ step: 'people', status: 'done', count: `${peopleImported}/${rgPeople.length}` });

        // Build person lookup
        const { data: allPersons } = await supabase.from('persons').select('id, rg_id');
        const personByRgId = new Map<number, string>();
        for (const pe of (allPersons ?? []) as Array<{ id: string; rg_id: number | null }>) {
          if (pe.rg_id) personByRgId.set(pe.rg_id, pe.id);
        }

        // ============================================================
        // 5. PROGRAMS → RETREATS
        // ============================================================
        send({ step: 'retreats', status: 'fetching' });
        const rgPrograms = await fetchRGPrograms(since);
        let retreatsImported = 0;
        const validDateTypes = ['fixed', 'package', 'hotel', 'dateless'];
        const validStatuses = ['draft', 'confirmed', 'cancelled', 'completed'];

        for (let i = 0; i < rgPrograms.length; i++) {
          const prog = rgPrograms[i];
          const dateType = validDateTypes.includes(prog.date_type ?? '') ? prog.date_type : 'fixed';
          const status = validStatuses.includes(prog.status ?? '') ? prog.status : 'draft';

          const { error } = await supabase.from('retreats').upsert({
            rg_id: prog.id, name: prog.name, description: prog.content ?? null, excerpt: prog.excerpt ?? null,
            date_type: dateType, start_date: prog.start_date ?? null, end_date: prog.end_date ?? null,
            package_nights: prog.package_nights ?? null, status, is_public: prog.public ?? true,
            registration_status: prog.program_registration_status ?? 'open', categories: prog.categories ?? [],
            pricing_type: prog.pricing_type === 'tiered' ? 'tiered' : 'lodging',
            pricing_options: prog.pricing_options ?? {}, deposit_percentage: prog.deposit_percentage ?? 60,
            max_capacity: prog.max_capacity ?? null, available_spaces: prog.available_spaces ?? null,
            currency: prog.currency ?? 'USD', waitlist_enabled: prog.waitlist_enabled ?? false,
            program_info: prog.program_info ?? {}, images: prog.images ?? [],
            external_link: prog.program_link ?? null, registration_link: prog.registration_link ?? null,
          }, { onConflict: 'rg_id' });
          if (error) sendError('retreats', `${prog.id}: ${error.message}`);
          else retreatsImported++;
          if ((i + 1) % 10 === 0 || i === rgPrograms.length - 1) {
            send({ step: 'retreats', status: 'importing', count: `${i + 1}/${rgPrograms.length}` });
          }
        }
        send({ step: 'retreats', status: 'done', count: `${retreatsImported}/${rgPrograms.length}` });

        const { data: allRetreats } = await supabase.from('retreats').select('id, rg_id');
        const retreatByRgId = new Map<number, string>();
        for (const r of (allRetreats ?? []) as Array<{ id: string; rg_id: number | null }>) {
          if (r.rg_id) retreatByRgId.set(r.rg_id, r.id);
        }

        // ============================================================
        // 6. ROOM BLOCKS
        // ============================================================
        send({ step: 'room_blocks', status: 'fetching' });
        const rgBlocks = await fetchRGRoomBlocks();
        let blocksImported = 0;

        for (let i = 0; i < rgBlocks.length; i++) {
          const block = rgBlocks[i];
          if (!block.start_date || !block.end_date) continue;

          const { data: newBlock, error } = await supabase
            .from('retreat_room_blocks')
            .upsert({ rg_id: block.id, name: block.name ?? 'Unnamed', description: block.description ?? null, block_type: 'simple', start_date: block.start_date, end_date: block.end_date }, { onConflict: 'rg_id' })
            .select('id').single();

          if (error || !newBlock) { sendError('room_blocks', `${block.id}: ${error?.message ?? 'failed'}`); continue; }

          if (block.lodgings) {
            for (const lodging of block.lodgings) {
              for (const room of lodging.rooms ?? []) {
                const ourRoomId = roomByRgId.get(room.id);
                if (ourRoomId) {
                  await supabase.from('retreat_room_block_rooms').upsert({ block_id: newBlock.id, room_id: ourRoomId }, { onConflict: 'block_id,room_id' });
                }
              }
            }
          }
          blocksImported++;
          send({ step: 'room_blocks', status: 'importing', count: `${i + 1}/${rgBlocks.length}` });
        }
        send({ step: 'room_blocks', status: 'done', count: `${blocksImported}/${rgBlocks.length}` });

        // ============================================================
        // 7. REGISTRATIONS → BOOKINGS
        // ============================================================
        send({ step: 'bookings', status: 'fetching' });
        const rgRegs = await fetchRGRegistrations(since);
        let bookingsImported = 0;
        let bookingsFailed = 0;

        for (let i = 0; i < rgRegs.length; i++) {
          const reg = rgRegs[i];
          if (!reg.start_date || !reg.end_date) {
            sendError('bookings', `${reg.id}: missing dates`);
            bookingsFailed++;
            continue;
          }
          if (reg.end_date < reg.start_date) {
            sendError('bookings', `${reg.id}: invalid dates ${reg.start_date} to ${reg.end_date}`);
            bookingsFailed++;
            continue;
          }
          // Same-day bookings: push checkout to next day
          let checkOut = reg.end_date;
          if (reg.end_date === reg.start_date) {
            const d = new Date(reg.end_date + 'T12:00:00');
            d.setDate(d.getDate() + 1);
            checkOut = d.toISOString().split('T')[0];
          }

          // Resolve person — try lookup first, then create from registration data
          let personId = (reg.person_id && reg.person_id > 0) ? personByRgId.get(reg.person_id) : null;

          if (!personId) {
            // Build email from registration data
            const regEmail = reg.email
              ? reg.email.toLowerCase().trim()
              : reg.full_name
                ? `${reg.full_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}-rg${reg.id}@noemail.placeholder`
                : `booking-rg${reg.id}@noemail.placeholder`;

            // Check if person exists by email
            const { data: existingPerson } = await supabase
              .from('persons').select('id').eq('email', regEmail).single();

            if (existingPerson) {
              personId = existingPerson.id;
            } else {
              // Create new person — don't set rg_id if person_id is 0 (would collide)
              const { data: newPerson } = await supabase
                .from('persons')
                .insert({
                  email: regEmail,
                  full_name: reg.full_name ?? null,
                })
                .select('id').single();
              if (newPerson) {
                personId = newPerson.id;
              }
            }
          }

          if (!personId) {
            sendError('bookings', `${reg.id}: could not resolve or create person`);
            bookingsFailed++;
            continue;
          }

          const retreatId = reg.program_id ? retreatByRgId.get(reg.program_id) : null;
          const roomId = reg.room_id ? roomByRgId.get(reg.room_id) : null;
          const lodgingId = reg.lodging_id ? lodgingByRgId.get(reg.lodging_id) : null;
          const bookingStatus = BOOKING_STATUS_MAP[reg.status ?? ''] ?? 'inquiry';

          const { error } = await supabase.from('bookings').upsert({
            rg_id: reg.id, person_id: personId, retreat_id: retreatId ?? null,
            room_id: roomId ?? null, lodging_type_id: lodgingId ?? null,
            status: bookingStatus, check_in: reg.start_date, check_out: checkOut,
            num_guests: 1, total_amount: reg.grand_total ?? 0, currency: 'USD',
            guest_type: reg.guest_type ?? 'participant', rg_parent_booking_id: reg.parent_registration_id ?? null,
            questions: reg.questions ?? {}, notes: null,
          }, { onConflict: 'rg_id' });
          if (error) { sendError('bookings', `${reg.id}: ${error.message}`); bookingsFailed++; }
          else bookingsImported++;
          if ((i + 1) % 20 === 0 || i === rgRegs.length - 1) {
            send({ step: 'bookings', status: 'importing', count: `${i + 1}/${rgRegs.length}` });
          }
        }
        send({ step: 'bookings', status: 'done', count: `${bookingsImported}/${rgRegs.length} (${bookingsFailed} failed)` });

        const { data: allBookings } = await supabase.from('bookings').select('id, rg_id');
        const bookingByRgId = new Map<number, string>();
        for (const b of (allBookings ?? []) as Array<{ id: string; rg_id: number | null }>) {
          if (b.rg_id) bookingByRgId.set(b.rg_id, b.id);
        }

        // ============================================================
        // 8. LEADS
        // ============================================================
        send({ step: 'leads', status: 'fetching' });
        const rgLeads = await fetchRGLeads(since);
        let leadsImported = 0;

        for (let i = 0; i < rgLeads.length; i++) {
          const lead = rgLeads[i];
          if (!lead.email) continue;

          const { error } = await supabase.from('leads').upsert({
            rg_id: lead.id, email: lead.email.toLowerCase().trim(),
            full_name: lead.full_name || `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || null,
            source: lead.lead_type ?? null, status: 'new',
            notes: lead.program ? `Program: ${lead.program}` : null,
          }, { onConflict: 'rg_id' });
          if (error) sendError('leads', `${lead.id}: ${error.message}`);
          else leadsImported++;
          if ((i + 1) % 50 === 0 || i === rgLeads.length - 1) {
            send({ step: 'leads', status: 'importing', count: `${i + 1}/${rgLeads.length}` });
          }
        }
        send({ step: 'leads', status: 'done', count: `${leadsImported}/${rgLeads.length}` });

        // ============================================================
        // 9. TRANSACTIONS
        // ============================================================
        send({ step: 'transactions', status: 'fetching' });
        const rgTrans = await fetchRGTransactions(since);
        let transImported = 0;

        for (let i = 0; i < rgTrans.length; i++) {
          const tx = rgTrans[i];
          const txClass = TX_CLASS_MAP[tx.class ?? ''];
          const txCat = TX_CAT_MAP[tx.category ?? ''];
          if (!txClass || !txCat) { sendError('transactions', `${tx.id}: unknown class/category`); continue; }

          const personId = tx.person_id ? personByRgId.get(tx.person_id) : null;
          const bookingId = tx.registration_id ? bookingByRgId.get(tx.registration_id) : null;
          const retreatId = tx.program_id ? retreatByRgId.get(tx.program_id) : null;

          const { error } = await supabase.from('transactions').upsert({
            rg_id: tx.id, submitted_at: tx.submitted ?? new Date().toISOString(),
            trans_date: tx.trans_date ?? null, class: txClass, category: txCat,
            status: tx.status ?? 'complete', description: tx.description ?? null,
            person_id: personId ?? null, booking_id: bookingId ?? null, retreat_id: retreatId ?? null,
            charge_amount: tx.charge_amount ?? 0, credit_amount: tx.credit_amount ?? 0,
            tax_1_info: tx.tax_1_info ?? null, tax_1_amount: tx.tax_1_amount ?? 0,
            tax_2_info: tx.tax_2_info ?? null, tax_2_amount: tx.tax_2_amount ?? 0,
            subtotal: tx.subtotal ?? 0, grand_total: tx.grand_total ?? 0,
            discount_amount: tx.discount_amount ?? 0, discount_percent: tx.discount_percent ?? 0,
            quantity: tx.quantity ?? 1, price_per_item: tx.price_per_item ?? null,
            is_addon: tx.is_addon ?? false, fund_method: tx.fund_method ?? null,
            merchant_name: tx.merchant_name ?? null, merchant_trans_id: tx.merchant_trans_id ?? null,
            revenue: tx.revenue ?? {}, notes: tx.notes ?? null, gl_code: tx.glcode ?? null,
          }, { onConflict: 'rg_id' });
          if (error) sendError('transactions', `${tx.id}: ${error.message}`);
          else transImported++;
          if ((i + 1) % 50 === 0 || i === rgTrans.length - 1) {
            send({ step: 'transactions', status: 'importing', count: `${i + 1}/${rgTrans.length}` });
          }
        }
        send({ step: 'transactions', status: 'done', count: `${transImported}/${rgTrans.length}` });

        // Record sync timestamp
        await supabase.from('sync_log').upsert(
          { source: 'retreat_guru', last_synced_at: syncStartedAt, updated_at: new Date().toISOString() },
          { onConflict: 'source' },
        );

        // DONE
        const modeLabel = since ? 'Incremental update' : 'Full import';
        send({ step: 'complete', status: 'done', detail: `${modeLabel} complete. ${errorCount} errors.` });
        await job.complete();
      } catch (err) {
        console.error('[Import RG Error]', err instanceof Error ? err.message : err);
        send({ step: 'error', status: 'error', detail: 'Import failed — check server logs' });
        await job.fail('Import failed — check server logs');
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
