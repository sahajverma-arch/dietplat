-- LEANR: Meal Archetype + Dish Composition layer. Additive only — does not
-- touch the roadmap engine, exchange solver, meal distributor, quantity/
-- pricing, or nutrition validation. Purpose: let food ELIGIBILITY be
-- narrowed to authentic regional combinations (e.g. Idli pairs with Sambar,
-- never with Masoor Dal) without changing how exchange counts or macros are
-- computed. See CLAUDE.md "The exchange system" and the architecture
-- design doc this implements.
--
-- Three tables, same shape as the design that was reviewed and approved:
--   dish_families      — a small, closed vocabulary (same pattern as
--                         exchange_types) identifying a specific dish
--                         identity, e.g. "sambar". A component points at a
--                         SET of these, never a raw exchange type or a
--                         free-text tag, so the eligible pool for "the
--                         lentil-curry role of an Idli-Sambar breakfast"
--                         can never silently include Masoor Dal just
--                         because both are pulse-exchange.
--   meal_archetypes    — the named, curator-approved COMPLETE meal (e.g.
--                         "Idli-Sambar"), not a single dish — see the
--                         "Complete Meal Identity" decision. Region- and
--                         slot-scoped.
--   archetype_components — the roles within an archetype (e.g. "steamed
--                         batter cereal", "lentil curry"), each pointing at
--                         one or more dish_families.

create table if not exists public.dish_families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  exchange_type text not null references public.exchange_types (code),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dish_families enable row level security;

create policy "fitelo staff full access to dish_families"
  on public.dish_families for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create table if not exists public.meal_archetypes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  region text not null,
  slot text not null,
  diet_types text[] not null default '{}',
  -- 0-1, curator-assigned: how central/authentic this archetype is to the
  -- region+slot, used only to weight rotation frequency (see
  -- archetype-selector.ts) — never a hard eligibility filter.
  authenticity_score numeric not null default 1.0 check (authenticity_score between 0 and 1),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meal_archetypes_lookup_idx
  on public.meal_archetypes (region, slot, is_active);

alter table public.meal_archetypes enable row level security;

create policy "fitelo staff full access to meal_archetypes"
  on public.meal_archetypes for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create table if not exists public.archetype_components (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.meal_archetypes (id) on delete cascade,
  -- Display label only (e.g. "Lentil curry") — NOT the matching key. The
  -- matching key is dish_family_ids below, a closed reference, precisely
  -- so this can never regress into the free-text-tag leak the architecture
  -- audit found (Roti/Chapati tagged "generic" and leaking into South
  -- Indian/Bengali plans).
  component_role text not null,
  -- A SET of acceptable dish families, not one — lets a single archetype
  -- (e.g. "Everyday North Indian Thali") accept any of {Rajma, Chole,
  -- Masoor dal, Kala chana, Moong dal} for its pulse role without needing
  -- one archetype row per dal, while South Indian/Bengali archetypes with
  -- rigid traditional pairings simply keep this set to a single family.
  dish_family_ids uuid[] not null default '{}',
  -- Redundant with dish_families.exchange_type by construction — kept as a
  -- second, cheap integrity check at archetype-authoring time (a mismatch
  -- here is a curation bug caught before the archetype ever ships).
  exchange_type text not null references public.exchange_types (code),
  component_order int not null default 0,
  is_required boolean not null default true,
  notes text,
  unique (archetype_id, component_role),
  constraint archetype_components_families_nonempty check (cardinality(dish_family_ids) >= 1)
);

create index if not exists archetype_components_archetype_id_idx
  on public.archetype_components (archetype_id);

alter table public.archetype_components enable row level security;

create policy "fitelo staff full access to archetype_components"
  on public.archetype_components for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');
