-- Dietitian Knowledge RAG layer (see CLAUDE.md "Dietitian knowledge
-- layer"): a SEPARATE knowledge base from `recipes` — dietitian domain
-- reasoning (regional identity, meal-slot patterns, combination rules,
-- serving norms, goal-construction principles), never recipes or nutrition
-- numbers. Retrieved and injected as descriptive prompt text only; the
-- recipe engine's LLM output contract is unchanged. v1 retrieval is
-- deterministic tag-filtering, NOT semantic search — the embeddings table
-- below is an unpopulated v2 placeholder, mirroring recipe_embeddings'
-- own precedent exactly. pgvector is already enabled (see
-- 20260819100000_recipe_engine_pipeline.sql).

create table public.dietitian_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null check (category in (
    'meal_pattern','meal_slot','region','goal','combination',
    'serving_norm','protein','variety','adherence','reasoning_example'
  )),
  status text not null default 'draft' check (status in ('draft','confirmed')),
  version integer not null default 1,
  confirmed_by text,
  confirmed_at timestamptz,
  regions text[] not null default '{}',      -- '{}' = applies to every cuisine
  diet_types text[] not null default '{}',   -- '{}' = applies to every diet type
  goals text[] not null default '{}',        -- '{}' = applies to every inferred goal
  meal_slots text[] not null default '{}',   -- '{}' = applies to every meal slot
  weight integer not null default 5,         -- author-assigned relevance, 1-10
  source_file text not null,                 -- relative path under seed-data, audit trail
  raw_markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dietitian_knowledge_docs_category_idx on public.dietitian_knowledge_docs (category);
create index dietitian_knowledge_docs_regions_gin_idx on public.dietitian_knowledge_docs using gin (regions);
create index dietitian_knowledge_docs_goals_gin_idx on public.dietitian_knowledge_docs using gin (goals);
create index dietitian_knowledge_docs_meal_slots_gin_idx on public.dietitian_knowledge_docs using gin (meal_slots);
create index dietitian_knowledge_docs_diet_types_gin_idx on public.dietitian_knowledge_docs using gin (diet_types);

alter table public.dietitian_knowledge_docs enable row level security;
create policy "fitelo staff full access to dietitian_knowledge_docs"
  on public.dietitian_knowledge_docs for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create table public.dietitian_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.dietitian_knowledge_docs (id) on delete cascade,
  slug text not null unique,           -- `${doc.slug}#${section-anchor}`
  heading text not null,               -- the H2 text verbatim
  chunk_order integer not null,
  content text not null,
  estimated_tokens integer not null,   -- charCount/4, computed at ingestion
  created_at timestamptz not null default now()
);

create index dietitian_knowledge_chunks_doc_idx on public.dietitian_knowledge_chunks (doc_id);

alter table public.dietitian_knowledge_chunks enable row level security;
create policy "fitelo staff full access to dietitian_knowledge_chunks"
  on public.dietitian_knowledge_chunks for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Deferred v2 semantic-retrieval placeholder — mirrors recipe_embeddings
-- exactly (same 1536-dim placeholder, same "unpopulated, no ANN index
-- until a model is chosen" posture). Not wired into knowledge-retrieval.ts
-- at all in v1.
create table public.dietitian_knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.dietitian_knowledge_chunks (id) on delete cascade unique,
  embedding vector(1536),
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dietitian_knowledge_embeddings enable row level security;
create policy "fitelo staff full access to dietitian_knowledge_embeddings"
  on public.dietitian_knowledge_embeddings for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- Nullable audit column, sibling to raw_response/model — null for every
-- exchange-engine run and any recipe-engine run predating this feature;
-- set to {injected: [...], droppedForBudget: [...]} once
-- DIETITIAN_KNOWLEDGE_ENABLED is on, so a dietitian can trace "which
-- knowledge shaped this specific generated plan" after the fact.
alter table public.plan_generation_runs
  add column knowledge_chunks_injected jsonb;
