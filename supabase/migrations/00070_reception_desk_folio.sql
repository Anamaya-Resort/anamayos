-- 00070: Reception Desk charges on the guest folio.
--
-- 1. Finishes migration 00012 (folio system), which never fully ran on the
--    live AO database: tax_rates (+ 13% IVA), line_item_taxes and the
--    approval/signature columns. All idempotent.
-- 2. booking_line_items gains:
--      tip_amount          tip for the practitioner/staff (not taxed, not in total_amount)
--      commission_amount   practitioner payout snapshot at booking time
--      booked_by_person_id staff member (or guest) who made the booking
--    total_amount stays = net + tax. Folio grand total adds tips on top.

create table if not exists tax_rates (
  id          uuid default gen_random_uuid() primary key,
  slug        text unique not null,
  name        text not null,
  rate        numeric(6,4) not null,
  is_compound boolean not null default false,
  applies_to  text[] default '{}',
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
create index if not exists idx_tax_rates_active on tax_rates (is_active, sort_order);
drop trigger if exists trg_tax_rates_updated_at on tax_rates;
create trigger trg_tax_rates_updated_at before update on tax_rates
  for each row execute function update_updated_at();

insert into tax_rates (slug, name, rate, is_compound, applies_to, sort_order)
values ('iva', 'IVA', 0.1300, false, '{}', 10)
on conflict (slug) do nothing;

alter table booking_line_items
  add column if not exists approved_at              timestamptz,
  add column if not exists approved_signature       text,
  add column if not exists approved_location_name   text,
  add column if not exists approved_location_coords text,
  add column if not exists approved_by_person_id    uuid references persons(id) on delete set null,
  add column if not exists approval_method          text check (approval_method in ('self', 'staff_presented')),
  add column if not exists tip_amount               numeric(10,2) not null default 0 check (tip_amount >= 0),
  add column if not exists commission_amount        numeric(10,2) check (commission_amount is null or commission_amount >= 0),
  add column if not exists booked_by_person_id      uuid references persons(id) on delete set null;

create index if not exists idx_bli_approved on booking_line_items (approved_at) where approved_at is not null;
create index if not exists idx_bli_booking on booking_line_items (booking_id);
create index if not exists idx_bli_provider_day on booking_line_items (provider_id, scheduled_date) where status <> 'cancelled';

create table if not exists line_item_taxes (
  id           uuid default gen_random_uuid() primary key,
  line_item_id uuid not null references booking_line_items(id) on delete cascade,
  tax_rate_id  uuid not null references tax_rates(id),
  tax_name     text not null,
  tax_rate     numeric(6,4) not null,
  tax_amount   numeric(10,2) not null,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);
create index if not exists idx_lit_line_item on line_item_taxes (line_item_id);
create index if not exists idx_lit_tax_rate on line_item_taxes (tax_rate_id);
drop trigger if exists trg_line_item_taxes_updated_at on line_item_taxes;
create trigger trg_line_item_taxes_updated_at before update on line_item_taxes
  for each row execute function update_updated_at();

alter table tax_rates enable row level security;
alter table line_item_taxes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'tax_rates' and policyname = 'tax_rates_select') then
    create policy tax_rates_select on tax_rates for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tax_rates' and policyname = 'tax_rates_admin') then
    create policy tax_rates_admin on tax_rates for all to authenticated
      using (current_user_access_level() >= 5) with check (current_user_access_level() >= 5);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'line_item_taxes' and policyname = 'lit_select_staff') then
    create policy lit_select_staff on line_item_taxes for select to authenticated
      using (current_user_access_level() >= 3);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'line_item_taxes' and policyname = 'lit_staff_write') then
    create policy lit_staff_write on line_item_taxes for all to authenticated
      using (current_user_access_level() >= 3) with check (current_user_access_level() >= 3);
  end if;
end $$;
