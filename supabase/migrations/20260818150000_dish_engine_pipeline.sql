-- Dish-gram generation engine (Stage 1, additive only): a second, parallel
-- plan-generation pipeline where the LLM picks both a real named dish and
-- its gram quantity directly, grounded against a per-100g dish nutrition
-- table and deterministically rebalanced + validated in code — see
-- CLAUDE.md "The dish-gram system". Nothing here touches the existing
-- exchange system (exchange_types/foods/diet_plan_items) or any historical
-- plan; diet_plans.engine defaults every existing row to 'exchange' so
-- history renders byte-identically.

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  -- Exact CSV food_name — also the grounding resolver's exact-match key.
  name text not null unique,
  category text not null,
  regions text[] not null default '{}',
  protein_per_100g numeric not null,
  carbs_per_100g numeric not null,
  fat_per_100g numeric not null,
  -- Generated (Atwater) — never trusted from the source CSV's own
  -- calories_kcal column. Same discipline as exchange_types.kcal.
  kcal_per_100g numeric generated always as (
    round(protein_per_100g * 4 + carbs_per_100g * 4 + fat_per_100g * 9, 1)
  ) stored,
  -- Classified from ingredients_json at ingestion time — a positive list
  -- (every diet type this dish is safe for). See dish-diet-classifier.ts.
  diet_types text[] not null default '{}',
  -- Audit trail only — never read for macros.
  ingredients_json jsonb not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dishes_regions_gin_idx on public.dishes using gin (regions);
create index if not exists dishes_diet_types_gin_idx on public.dishes using gin (diet_types);

alter table public.dishes enable row level security;

create policy "fitelo staff full access to dishes"
  on public.dishes for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- The dish-gram engine's leaf item, sibling to diet_plan_items — hangs off
-- the SAME diet_plan_meals row the exchange engine uses; only the leaf item
-- table forks by diet_plans.engine. grams is the code-rebalanced final
-- value (see dish-balancer.ts), never the LLM's raw suggestion trusted as-is.
create table if not exists public.diet_plan_dish_items (
  id uuid primary key default gen_random_uuid(),
  diet_plan_meal_id uuid not null references public.diet_plan_meals (id) on delete cascade,
  dish_id uuid not null references public.dishes (id),
  grams numeric not null,
  -- Snapshotted at generation time, NOT a live join to dishes — a later CSV
  -- re-ingestion that corrects a dish's macros must never retroactively
  -- rewrite an already-approved historical plan's displayed numbers.
  protein_per_100g_snapshot numeric not null,
  carbs_per_100g_snapshot numeric not null,
  fat_per_100g_snapshot numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists diet_plan_dish_items_meal_idx
  on public.diet_plan_dish_items (diet_plan_meal_id);
create index if not exists diet_plan_dish_items_dish_idx
  on public.diet_plan_dish_items (dish_id);

alter table public.diet_plan_dish_items enable row level security;

create policy "fitelo staff full access to diet_plan_dish_items"
  on public.diet_plan_dish_items for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Discriminates which generation pipeline produced a plan, and therefore
-- which item table its meals' children live in. Defaults every existing row
-- to 'exchange' so history is unaffected.
alter table public.diet_plans
  add column engine text not null default 'exchange'
  check (engine in ('exchange', 'dish'));

-- Null = a whole-week generation attempt (both engines). Set = a single-day
-- retry attempt (dish engine only) — lets /settings/generation-log
-- distinguish the two.
alter table public.plan_generation_runs
  add column day_index integer;
