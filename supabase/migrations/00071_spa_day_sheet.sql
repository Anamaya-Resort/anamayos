-- 00071: Spa day sheet (the digital version of the paper "Spa Services
-- Bookings" sheet).
--
-- * The three treatment rooms become bookable facilities (sheet columns).
-- * spa_day_notes: one free-text note per day ("YTT Day Off", "Beach Trip
--   Day", "No Barb"), written by the spa manager.
-- * Therapist hours per day reuse staff_availability (person, date,
--   start/end; several rows = split shift). Hours are drawn day by day,
--   there is no fixed weekly schedule.
-- * Adds the therapists named on the sheet who were missing: Dianne (spa
--   manager), Vale, Maria Jose. Placeholder emails like Barbara/Jenifer.
-- * Spa bookings are tracked per room via booking_line_items.facility_id.

insert into facilities (name, slug, facility_type, capacity, is_bookable, is_active, sort_order) values
  ('Jungle Spa', 'jungle-spa', 'spa_room', 1, true, true, 1),
  ('Ocean Spa', 'ocean-spa', 'spa_room', 1, true, true, 2),
  ('Serafina Spa and Consulting', 'serafina-spa', 'spa_room', 1, true, true, 3)
on conflict (slug) do nothing;

create table if not exists spa_day_notes (
  date        date primary key,
  note        text not null check (length(note) <= 500),
  updated_by  uuid references persons(id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table spa_day_notes enable row level security;
-- No policies: server (service role) only.

create index if not exists idx_staff_availability_date on staff_availability (date, person_id);
create index if not exists idx_bli_facility_day on booking_line_items (facility_id, scheduled_date) where status <> 'cancelled';

-- Missing therapists.
with new_people as (
  insert into persons (full_name, email, is_active) values
    ('Dianne', 'dianne@placeholder.local', true),
    ('Vale', 'vale@placeholder.local', true),
    ('María José', 'maria.jose@placeholder.local', true)
  on conflict (email) do nothing
  returning id, full_name
)
insert into person_roles (person_id, role_id, status, starts_at)
select np.id, r.id, 'active', current_date
from new_people np cross join roles r
where r.slug = 'practitioner';

insert into practitioners (full_name, is_active, sort_order)
select v.name, true, v.ord
from (values ('Dianne', 0), ('Vale', 3), ('María José', 4)) as v(name, ord)
where not exists (select 1 from practitioners p where p.full_name = v.name);
