-- Sync log: tracks last successful import timestamp per source
create table if not exists sync_log (
  source text primary key,           -- 'retreat_guru', 'wetravel', etc.
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sync_log enable row level security;

-- Only service role (admin imports) can read/write
create policy "Service role full access" on sync_log
  for all using (true) with check (true);
