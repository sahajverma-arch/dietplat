-- LEANR: Dish Composition Layer, stage 2 — combines an already-composed
-- cereal group with an already-composed pulse dish (e.g. "Rice" +
-- "Rajma Curry") into one named combo ("Rajma Chawal") for meals that
-- have no meal_archetype driving the pairing. Purely additive, presentation
-- layer only — see src/lib/plan/dish-combination.ts. Reuses dish_families
-- as its matching key rather than inventing a parallel vocabulary, same
-- pattern as archetype_components.

create table if not exists public.dish_combinations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  -- "primary" is always the cereal-side dish_family, "secondary" the
  -- pulse-side, matching combineDishGroups()'s cereal+pulse pairing rule.
  primary_dish_family_id uuid not null references public.dish_families(id),
  secondary_dish_family_id uuid not null references public.dish_families(id),
  -- null = applies in every region; set = a region-specific idiom override.
  region text,
  is_active boolean not null default true
);

-- A plain UNIQUE constraint on (primary, secondary, region) would NOT catch
-- duplicate global (region is null) rows, since SQL treats every NULL as
-- distinct for uniqueness purposes — this partial index closes that gap.
create unique index if not exists dish_combinations_global_unique
  on public.dish_combinations (primary_dish_family_id, secondary_dish_family_id)
  where region is null;

create unique index if not exists dish_combinations_regional_unique
  on public.dish_combinations (primary_dish_family_id, secondary_dish_family_id, region)
  where region is not null;

alter table public.dish_combinations enable row level security;

create policy "fitelo staff full access to dish_combinations"
  on public.dish_combinations for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- New dish_families needed for the two seeded examples — Rice, Rajma and
-- Moong Dal currently have no dish_family_id at all (they were never part
-- of the South Indian breakfast pilot).
insert into public.dish_families (code, name, exchange_type, notes) values
  ('rice', 'Rice', 'cereal', 'Plain rice — the cereal half of common rice+curry combos (Rajma Chawal, Moong Dal Rice, etc).'),
  ('rajma', 'Rajma', 'pulse', 'Red kidney bean curry.'),
  ('moong_dal', 'Moong Dal', 'pulse', 'Moong dal curry.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'rice') where name_en = 'Rice';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'rajma') where name_en = 'Rajma';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'moong_dal') where name_en = 'Moong dal';

insert into public.dish_combinations (code, display_name, primary_dish_family_id, secondary_dish_family_id, region)
values
  ('rajma_chawal', 'Rajma Chawal',
    (select id from public.dish_families where code = 'rice'),
    (select id from public.dish_families where code = 'rajma'),
    null),
  ('moong_dal_rice', 'Moong Dal Rice',
    (select id from public.dish_families where code = 'rice'),
    (select id from public.dish_families where code = 'moong_dal'),
    null)
on conflict do nothing;
