-- LEANR: roadmap_overrides — records a dietitian's explicit override of a
-- block-level roadmap flag (e.g. GOAL_CATEGORY_CONFLICT). One row per
-- override; the roadmap row itself is never mutated.

create table if not exists public.roadmap_overrides (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  flag_code text not null,
  reason text not null,
  dietitian_name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists roadmap_overrides_roadmap_id_idx on public.roadmap_overrides (roadmap_id);

alter table public.roadmap_overrides enable row level security;

create policy "fitelo staff full access to roadmap_overrides"
  on public.roadmap_overrides
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');
