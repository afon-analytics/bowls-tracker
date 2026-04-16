-- Drill sessions table for tracking standardised drill results (40-Bowl Test, etc.)
-- Only populated for Personal+ tier (Essential tier results are shown but not persisted)

create table if not exists drill_sessions (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade,
  player_name text,
  drill_type text not null, -- '40bowl_test', 'corridor', 'jack_length', etc.
  score integer,
  max_score integer,
  sub_scores jsonb, -- e.g. { "fh_short": 7, "fh_long": 6, "bh_short": 5, "bh_long": 6 }
  metadata jsonb,   -- drill-specific extra data (individual bowl results, etc.)
  completed_at timestamptz default now()
);

-- Row Level Security: users can only see their own org's drill sessions
alter table drill_sessions enable row level security;

create policy "org_isolation" on drill_sessions
  using (org_id = (select org_id from users where id = auth.uid()));

-- Index for efficient lookups by player and drill type
create index idx_drill_sessions_player_type on drill_sessions (player_name, drill_type);
create index idx_drill_sessions_org on drill_sessions (org_id);
