-- LEANR: diet_plans hierarchy + plan_generation_runs. The AI (Prompt 7)
-- only ever picks which food fills a slot — every number here (exchange
-- counts, grams, macros) is computed in code from exchange-solver.ts /
-- meal-distributor.ts / Table 4.1, never trusted from the model.

create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps (id),
  week_number int not null,
  week_start date not null,
  week_end date not null,
  targets jsonb not null,
  achieved jsonb not null,
  deviation jsonb not null,
  generation_mode text not null check (generation_mode in ('ai', 'fallback')),
  model_used text,
  prepared_by uuid references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);

create index if not exists diet_plans_client_id_idx on public.diet_plans (client_id);
create index if not exists diet_plans_roadmap_id_idx on public.diet_plans (roadmap_id);

create table if not exists public.diet_plan_days (
  id uuid primary key default gen_random_uuid(),
  diet_plan_id uuid not null references public.diet_plans (id) on delete cascade,
  day_index int not null check (day_index between 0 and 6),
  date date not null,
  achieved jsonb not null,
  unique (diet_plan_id, day_index)
);

create table if not exists public.diet_plan_meals (
  id uuid primary key default gen_random_uuid(),
  diet_plan_day_id uuid not null references public.diet_plan_days (id) on delete cascade,
  slot text not null,
  slot_order int not null
);

create index if not exists diet_plan_meals_day_id_idx on public.diet_plan_meals (diet_plan_day_id);

create table if not exists public.diet_plan_items (
  id uuid primary key default gen_random_uuid(),
  diet_plan_meal_id uuid not null references public.diet_plan_meals (id) on delete cascade,
  food_id uuid not null references public.foods (id),
  exchange_type text not null references public.exchange_types (code),
  exchange_count numeric not null,
  -- Null for fruit items — Table 4.1 defines fruit's raw amount as
  -- variable, so there is no gram quantity to compute (household_measure
  -- alone, e.g. "1 medium", is the serving).
  serving_raw_g numeric
);

create index if not exists diet_plan_items_meal_id_idx on public.diet_plan_items (diet_plan_meal_id);

create table if not exists public.plan_generation_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps (id),
  week_number int not null,
  -- Filled in only once a run actually produces a saved plan — the first
  -- N attempts of a generation may all fail validation before that happens.
  diet_plan_id uuid references public.diet_plans (id) on delete set null,
  attempt_number int not null,
  prompt_hash text not null,
  raw_response text,
  validation_result jsonb not null,
  latency_ms int not null,
  created_at timestamptz not null default now()
);

create index if not exists plan_generation_runs_client_id_idx on public.plan_generation_runs (client_id);
create index if not exists plan_generation_runs_diet_plan_id_idx on public.plan_generation_runs (diet_plan_id);

alter table public.diet_plans enable row level security;
alter table public.diet_plan_days enable row level security;
alter table public.diet_plan_meals enable row level security;
alter table public.diet_plan_items enable row level security;
alter table public.plan_generation_runs enable row level security;

create policy "fitelo staff full access to diet_plans"
  on public.diet_plans for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to diet_plan_days"
  on public.diet_plan_days for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to diet_plan_meals"
  on public.diet_plan_meals for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to diet_plan_items"
  on public.diet_plan_items for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to plan_generation_runs"
  on public.plan_generation_runs for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');
