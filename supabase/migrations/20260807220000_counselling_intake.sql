-- LEANR: clients, counselling_sessions, roadmaps.
-- Shared staff tool — any @fitelo.co dietitian can read/write any client's
-- data, same access model as the profiles table (see 20260807120000).

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  city text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.counselling_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null check (type in ('quick', 'full')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  answers jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

-- Roadmap snapshots are immutable — recomputation inserts a new row, never
-- an update. engine_version lets old snapshots stay readable even after the
-- deterministic engine (src/lib/counselling/roadmap.ts) changes.
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.counselling_sessions (id) on delete cascade,
  engine_version text not null,
  input jsonb not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists counselling_sessions_client_id_idx on public.counselling_sessions (client_id);
create index if not exists roadmaps_session_id_idx on public.roadmaps (session_id);

alter table public.clients enable row level security;
alter table public.counselling_sessions enable row level security;
alter table public.roadmaps enable row level security;

create policy "fitelo staff full access to clients"
  on public.clients
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to counselling_sessions"
  on public.counselling_sessions
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to roadmaps"
  on public.roadmaps
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');
