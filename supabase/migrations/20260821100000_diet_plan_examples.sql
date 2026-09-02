-- Diet Plan Examples RAG layer (see CLAUDE.md "Diet plan examples
-- layer") — a SECOND, independent RAG layer alongside
-- dietitian_knowledge_docs/chunks: not principles ("how dietitians
-- think") but complete real example days ("what dietitians actually
-- build"), retrieved and injected as few-shot precedent ranked ABOVE the
-- knowledge-chunk guidance. One row = one complete day, never chunked.
--
-- Two-tier content model: source_type='real' rows are adapted from real,
-- credentialed public sources (source_url/source_credibility populated);
-- source_type='synthetic' rows are explicitly fabricated filler, used
-- only to cover combinations the real set doesn't reach. Retrieval never
-- lets a synthetic row outrank an eligible real one.

create table public.diet_plan_examples (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  goal text not null check (goal in ('fat_loss', 'muscle_gain', 'maintenance')),
  diet_types text[] not null default '{}',   -- positive-list, NOT empty-means-universal
  region text not null,                       -- RecipeCuisine value, "General" = pan-Indian
  gender text not null default 'any' check (gender in ('male', 'female', 'any')),
  calorie_min numeric not null,
  calorie_max numeric not null,
  meal_count integer not null,
  meal_structure jsonb not null,              -- [{slot, timeHint, items}]
  reasoning text,
  condition text[] not null default '{}',     -- v1 no-op at retrieval, see CLAUDE.md
  source_type text not null default 'real' check (source_type in ('real', 'synthetic')),
  source_url text,                            -- required for source_type='real', enforced at ingestion
  source_credibility text,                    -- required for source_type='real', enforced at ingestion
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  weight integer not null default 5,
  day_label text,
  source_file text not null,
  raw_markdown text not null,
  estimated_tokens integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index diet_plan_examples_goal_idx on public.diet_plan_examples (goal);
create index diet_plan_examples_region_idx on public.diet_plan_examples (region);
create index diet_plan_examples_gender_idx on public.diet_plan_examples (gender);
create index diet_plan_examples_meal_count_idx on public.diet_plan_examples (meal_count);
create index diet_plan_examples_source_type_idx on public.diet_plan_examples (source_type);
create index diet_plan_examples_diet_types_gin_idx on public.diet_plan_examples using gin (diet_types);
create index diet_plan_examples_condition_gin_idx on public.diet_plan_examples using gin (condition);
create index diet_plan_examples_calorie_range_idx on public.diet_plan_examples (calorie_min, calorie_max);

alter table public.diet_plan_examples enable row level security;
create policy "fitelo staff full access to diet_plan_examples"
  on public.diet_plan_examples for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Deferred v2 semantic-retrieval placeholder — mirrors recipe_embeddings/
-- dietitian_knowledge_embeddings exactly. Lower priority than even the
-- knowledge layer's own placeholder: v1's entire similarity surface
-- (goal/dietType/region/calories/mealCount) is literal structured
-- columns, nothing here benefits from embeddings without also changing
-- what's matched.
create table public.diet_plan_example_embeddings (
  id uuid primary key default gen_random_uuid(),
  example_id uuid not null references public.diet_plan_examples (id) on delete cascade unique,
  embedding vector(1536),
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.diet_plan_example_embeddings enable row level security;
create policy "fitelo staff full access to diet_plan_example_embeddings"
  on public.diet_plan_example_embeddings for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Nullable audit column, sibling to knowledge_chunks_injected (not merged
-- into it) — {injected: [...], droppedForBudget: [...]} example slugs,
-- so the two RAG layers stay independently queryable. Null for every run
-- predating DIET_PLAN_EXAMPLES_ENABLED.
alter table public.plan_generation_runs
  add column diet_plan_examples_injected jsonb;
