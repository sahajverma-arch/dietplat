-- Full replacement of the dish-gram engine (Stage 1, 2026-08-18) with a
-- recipe-name-only LLM engine + code-side quantity optimizer — see
-- CLAUDE.md "The recipe engine". Deletes every dish-gram-produced plan
-- first (their engine value becomes unrenderable once dishes/
-- diet_plan_dish_items are dropped) — this includes the real Sahaj Verma
-- plan e67c119f-110c-41a9-9c7a-5e84ab14a797, confirmed and accepted.

delete from public.diet_plans where engine = 'dish';
-- cascades diet_plan_days -> diet_plan_meals -> diet_plan_dish_items via
-- existing FKs; plan_generation_runs.diet_plan_id is ON DELETE SET NULL,
-- so those audit rows survive, orphaned, same as retiring an archetype.

drop table if exists public.diet_plan_dish_items;
drop table if exists public.dishes;

alter table public.diet_plans drop constraint diet_plans_engine_check;
alter table public.diet_plans add constraint diet_plans_engine_check
  check (engine in ('exchange', 'recipe'));

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null,               -- CSV RECIPE ID, audit only, NOT unique (2 real raw duplicates existed, resolved to 1 kept row each at ingestion)
  name text not null unique,             -- grounding's exact-match key
  diet_types text[] not null default '{}',
  cuisine text not null,                 -- normalized onto RECIPE_CUISINES; non-Indian/low-count cuisines relabeled "General"
  category text not null,                -- raw CSV category, verbatim (~69 real values)
  macro_category text,                   -- nullable, ~44% blank — real signal: prompt table column + fallback-selector tie-breaker
  heavy_light text not null,             -- light | medium | heavy
  main_or_mid text not null,             -- 'main' | 'mid' — prompt-only hint, never LLM-enforced
  commonality integer not null,          -- raw 0/1/2 — prompt bias + fallback rotation weight
  priority text,                         -- real values are "Primary"/"Secondary" text, NOT an integer (verified against the real column)
  season text not null,                  -- winter | summer | all_year (no monsoon signal in this data)
  allergen_tags text[] not null default '{}',
  min_grams numeric not null,
  max_grams numeric not null,
  ideal_grams numeric not null,          -- balancer's starting point (x0) — real authored typical portion, not an LLM guess
  serving_limits_source text not null default 'computed'
    check (serving_limits_source in ('computed', 'fallback_category_default')),
  protein_per_100g numeric not null,
  carbs_per_100g numeric not null,
  fat_per_100g numeric not null,
  fiber_per_100g numeric not null,
  kcal_per_100g numeric generated always as (
    round(protein_per_100g * 4 + carbs_per_100g * 4 + fat_per_100g * 9, 1)
  ) stored,                              -- Atwater, never the CSV's own Energy/100gm (mixes clean numbers with "#VALUE!" strings)
  is_active boolean not null default true,
  notes text,
  raw_csv_row jsonb not null,            -- full raw row, audit trail only, never read for macros
  created_at timestamptz not null default now()
);

create index recipes_diet_types_gin_idx on public.recipes using gin (diet_types);
create index recipes_allergen_tags_gin_idx on public.recipes using gin (allergen_tags);
create index recipes_cuisine_idx on public.recipes (cuisine);
create index recipes_category_idx on public.recipes (category);

alter table public.recipes enable row level security;
create policy "fitelo staff full access to recipes"
  on public.recipes for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Grounding tier 2 (exact -> alias -> fuzzy). alias is NOT globally unique
-- across recipes — recipe-alias-generation.ts's collision handling drops an
-- ambiguous alias entirely rather than guessing which recipe it belongs to.
create table public.recipe_aliases (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  alias text not null,
  source text not null default 'generated' check (source in ('generated', 'manual')),
  created_at timestamptz not null default now(),
  unique (recipe_id, alias)
);
create index recipe_aliases_alias_lower_idx on public.recipe_aliases (lower(alias));

alter table public.recipe_aliases enable row level security;
create policy "fitelo staff full access to recipe_aliases"
  on public.recipe_aliases for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create table public.diet_plan_recipe_items (
  id uuid primary key default gen_random_uuid(),
  diet_plan_meal_id uuid not null references public.diet_plan_meals (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id),
  grams numeric not null,               -- code-optimized final value; the LLM never proposes one
  protein_per_100g_snapshot numeric not null,
  carbs_per_100g_snapshot numeric not null,
  fat_per_100g_snapshot numeric not null,
  fiber_per_100g_snapshot numeric not null,
  created_at timestamptz not null default now()
);

create index diet_plan_recipe_items_meal_idx on public.diet_plan_recipe_items (diet_plan_meal_id);
create index diet_plan_recipe_items_recipe_idx on public.diet_plan_recipe_items (recipe_id);

alter table public.diet_plan_recipe_items enable row level security;
create policy "fitelo staff full access to diet_plan_recipe_items"
  on public.diet_plan_recipe_items for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Placeholder for the deferred v2 embedding-search grounding tier. Created
-- now, unpopulated and unindexed, so v2 has a ready landing spot instead of
-- a fresh migration. Dimension is a placeholder (1536, OpenAI-ada-002-
-- shaped) — TBD for real once a specific embedding model is chosen; no
-- ivfflat/hnsw index is built until then, since the index type depends on
-- the final dimension and distance metric.
create extension if not exists vector;

create table public.recipe_embeddings (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade unique,
  embedding vector(1536),
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipe_embeddings enable row level security;
create policy "fitelo staff full access to recipe_embeddings"
  on public.recipe_embeddings for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- plan_generation_runs.day_index already exists (from the dish-engine
-- migration) and is reused as-is for the recipe engine's own per-day
-- retries — no schema change needed there.
