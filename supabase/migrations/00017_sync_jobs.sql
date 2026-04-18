-- Sync jobs: tracks import progress in the DB so the UI can navigate away and return
create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,                -- 'retreat_guru', 'wetravel'
  mode text not null default 'full',   -- 'full', 'incremental'
  status text not null default 'running', -- 'running', 'done', 'error'
  steps jsonb not null default '[]'::jsonb,   -- array of {step, status, count?, detail?}
  errors jsonb not null default '[]'::jsonb,  -- array of error strings
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table sync_jobs enable row level security;

create policy "Service role full access" on sync_jobs
  for all using (true) with check (true);

create index idx_sync_jobs_source_status on sync_jobs(source, status);
