-- LEANR Prompt 9 hardening #2: rate-limit /api/plan/generate per user. No
-- Upstash/Redis is configured for this project, so a Postgres counter — one
-- row per generation *request* (not per LLM attempt; a single request can
-- retry the LLM up to 3 times internally, but that's one rate-limited call).
-- Plan generation is the only expensive path (LLM calls + solver search).

create table if not exists public.plan_generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists plan_generation_requests_user_id_created_at_idx
  on public.plan_generation_requests (user_id, created_at);

alter table public.plan_generation_requests enable row level security;

create policy "fitelo staff full access to plan_generation_requests"
  on public.plan_generation_requests
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');
