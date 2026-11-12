-- Live retreat availability, refreshed hourly from Retreat Guru by
-- /api/cron/retreat-availability (src/lib/retreat-availability.ts).
--   rg_has_capacity          RG API's per-program "has spaces available" flag
--   lodging_availability     per room type: [{lodging_id, name, price, available}]
--                            read from the program's public booking form
--   availability_checked_at  when the two above were last refreshed
-- Read by the public feed /api/public/upcoming-retreats.
alter table retreats add column if not exists rg_has_capacity boolean;
alter table retreats add column if not exists lodging_availability jsonb;
alter table retreats add column if not exists availability_checked_at timestamptz;
