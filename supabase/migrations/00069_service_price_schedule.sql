-- 00069: Practitioner commission + dated price changes for services.
--
-- commission_amount  what the practitioner earns per treatment, in the
--                    service's currency (USD). The house share is
--                    price - commission_amount. For a multi-therapist
--                    service (Lomi Lomi 4 Hands) it is the TOTAL paid
--                    out, split between the therapists.
--
-- service_price_changes  a price (and commission) that takes effect on a
--                    future date. apply_due_service_price_changes() copies
--                    every due row into service_catalog (and the linked
--                    products.base_price) and stamps applied_at. It runs
--                    daily from /api/cron/service-prices, just after
--                    midnight Costa Rica time, and is safe to re-run.
--
-- Seeds the 2026-Dec-05 spa price rise (Anamaya_Spa_Price_Comps.xlsx):
-- commission stays at 50% of the OLD price, so practitioners earn the
-- same dollars; prices rise ~25%, so the house share rises to ~60%.

alter table service_catalog
  add column if not exists commission_amount numeric(10,2)
  check (commission_amount is null or (commission_amount >= 0 and commission_amount <= price));

comment on column service_catalog.commission_amount is
  'Practitioner payout per treatment (USD). House share = price - commission_amount. Multi-therapist services: total across therapists.';

create table if not exists service_price_changes (
  id                     uuid primary key default gen_random_uuid(),
  service_id             uuid not null references service_catalog(id) on delete cascade,
  new_price              numeric(10,2) not null check (new_price >= 0),
  new_commission_amount  numeric(10,2) check (new_commission_amount is null or (new_commission_amount >= 0 and new_commission_amount <= new_price)),
  effective_date         date not null,
  applied_at             timestamptz,
  note                   text,
  created_at             timestamptz not null default now(),
  unique (service_id, effective_date)
);

create index if not exists service_price_changes_due_idx
  on service_price_changes (effective_date) where applied_at is null;

alter table service_price_changes enable row level security;
-- No policies: read/written only by the server (service role).

create or replace function apply_due_service_price_changes(
  p_today date default (now() at time zone 'America/Costa_Rica')::date
) returns integer
language plpgsql
as $$
declare
  r record;
  n integer := 0;
begin
  -- Oldest first, so if several are due the latest one wins.
  for r in
    select * from service_price_changes
    where applied_at is null and effective_date <= p_today
    order by effective_date, created_at
    for update
  loop
    update service_catalog
       set price = r.new_price,
           commission_amount = coalesce(r.new_commission_amount, commission_amount),
           updated_at = now()
     where id = r.service_id;

    update products
       set base_price = r.new_price,
           updated_at = now()
     where service_catalog_id = r.service_id;

    update service_price_changes set applied_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function apply_due_service_price_changes(date) from public, anon, authenticated;

-- Today's commission: 50% of the current spa price (unchanged on Dec 5).
update service_catalog
   set commission_amount = round(price * 0.5, 2)
 where domain = 'spa' and commission_amount is null;

-- 2026-Dec-05 spa prices: (service name, minutes, new price, commission).
insert into service_price_changes (service_id, new_price, new_commission_amount, effective_date, note)
select s.id, v.new_price, v.commission, date '2026-12-05', 'Spa price rise 2026-Dec-05 (Anamaya_Spa_Price_Comps.xlsx)'
from (values
  ('Relaxing Massage', 60, 100, 40.00), ('Relaxing Massage', 75, 120, 47.50), ('Relaxing Massage', 90, 140, 55.00),
  ('Therapeutic Massage', 60, 115, 45.00), ('Therapeutic Massage', 75, 130, 52.50), ('Therapeutic Massage', 90, 155, 62.50),
  ('Deep Tissue Massage', 60, 115, 45.00), ('Deep Tissue Massage', 75, 130, 52.50), ('Deep Tissue Massage', 90, 155, 62.50),
  ('Hot Stone Massage', 60, 125, 50.00), ('Hot Stone Massage', 75, 145, 57.50), ('Hot Stone Massage', 90, 170, 67.50),
  ('Eastern Massage', 60, 115, 45.00),
  ('Ashiatsu "Barefoot" Massage', 60, 125, 50.00), ('Ashiatsu "Barefoot" Massage', 75, 145, 57.50), ('Ashiatsu "Barefoot" Massage', 90, 170, 67.50),
  ('Lomi Lomi Massage (2 Hands)', 60, 115, 45.00), ('Lomi Lomi Massage (4 Hands)', 60, 165, 65.00),
  ('Chi Nei Tsang (Abdominal Massage)', 60, 100, 40.00),
  ('Lymphatic Drainage Massage', 60, 100, 40.00),
  ('Cranio Sacral Therapy', 60, 105, 40.00),
  ('Foot Reflexology', 60, 100, 40.00),
  ('Reiki Session', 60, 100, 40.00), ('Reiki Session', 75, 120, 47.50), ('Reiki Session', 90, 140, 55.00),
  ('Facial', 60, 105, 40.00),
  ('Organic Body Polish', 60, 115, 45.00),
  ('Detox Body Wrap', 75, 125, 50.00),
  ('Bamboo Massage', 60, 125, 50.00),
  ('Kobido (Ancient Japanese Facial Massage)', 60, 115, 45.00),
  ('Back Body Polish', 15, 35, 15.00), ('Hot Oil Head', 15, 35, 15.00), ('Hands', 15, 35, 15.00),
  ('Feet', 15, 35, 15.00), ('Face', 15, 35, 15.00), ('Abdominals', 15, 35, 15.00), ('Cupping', 15, 35, 15.00)
) as v(name, minutes, new_price, commission)
join service_catalog s
  on s.domain = 'spa' and s.name = v.name and s.duration_minutes = v.minutes
on conflict (service_id, effective_date) do nothing;
