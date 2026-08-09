-- LEANR: observability only — does NOT feed back into nutrition math.
-- Nullable, on delete set null: losing/retiring an archetype definition
-- must never delete or corrupt historical plan data.

alter table public.diet_plan_meals
  add column if not exists archetype_id uuid references public.meal_archetypes (id) on delete set null;

create index if not exists diet_plan_meals_archetype_id_idx on public.diet_plan_meals (archetype_id);
