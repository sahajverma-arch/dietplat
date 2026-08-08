-- LEANR: exchange_types, foods, meal_templates.
-- exchange_types is seeded from the real Fitelo exchange-list spreadsheet
-- (12 groups) — see CLAUDE.md "The exchange system" for why this replaced
-- the originally-scoped textbook "Table 4.1". READ-ONLY at runtime: no
-- admin UI writes to it.

create table if not exists public.exchange_types (
  code text primary key,
  label text not null,
  sort_order int not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric not null default 0,
  -- Always computed from the macros, never stored/sourced independently —
  -- so it can never drift from the numbers it summarises.
  kcal numeric generated always as (round(protein_g * 4 + carbs_g * 4 + fat_g * 9, 1)) stored,
  standard_serving text not null,
  notes text
);

alter table public.exchange_types enable row level security;

create policy "fitelo staff can read exchange_types"
  on public.exchange_types
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- ----------------------------------------------------------------------------

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_hi text,
  exchange_type text not null references public.exchange_types (code),
  -- How many exchanges of its own group one listed serving equals. Every
  -- seeded row is exactly 1 — each is calibrated to its group's anchor by
  -- design (see CLAUDE.md) — but the column stays general for foods added
  -- later that don't cleanly divide into a single exchange.
  exchange_units numeric not null default 1,
  serving_raw_g numeric not null,
  household_measure text,
  regions text[] not null default '{}',
  diet_types text[] not null default '{}',
  meal_slots text[] not null default '{}',
  allergens text[] not null default '{}',
  tags text[] not null default '{}',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists foods_regions_idx on public.foods using gin (regions);
create index if not exists foods_diet_types_idx on public.foods using gin (diet_types);
create index if not exists foods_meal_slots_idx on public.foods using gin (meal_slots);
create index if not exists foods_allergens_idx on public.foods using gin (allergens);
create index if not exists foods_exchange_type_idx on public.foods (exchange_type);

alter table public.foods enable row level security;

create policy "fitelo staff full access to foods"
  on public.foods
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

-- ----------------------------------------------------------------------------

create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  meal_count int not null,
  slot text not null,
  slot_order int not null,
  time_hint text,
  kcal_share numeric not null,
  allowed_exchange_types text[] not null default '{}',
  min_items int not null default 1,
  max_items int not null default 4,
  unique (region, meal_count, slot)
);

create index if not exists meal_templates_region_idx on public.meal_templates (region, meal_count);

alter table public.meal_templates enable row level security;

create policy "fitelo staff can read meal_templates"
  on public.meal_templates
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co');

insert into public.meal_templates (region, meal_count, slot, slot_order, time_hint, kcal_share, allowed_exchange_types, min_items, max_items)
values
  ('north_indian', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22,
    array['cereals_starches','fluid_dairy','paneer_dairy','egg','fruit','fats_oils','fitty_protein','nuts_seeds'], 2, 5),
  ('north_indian', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07,
    array['fruit','fluid_dairy','nuts_seeds','fitty_protein'], 1, 2),
  ('north_indian', 5, 'lunch', 3, '1:00–2:00 PM', 0.26,
    array['cereals_starches','pulses_legumes','soya_plant_protein','vegetables','poultry_fish_meat','paneer_dairy','fats_oils','fluid_dairy'], 3, 6),
  ('north_indian', 5, 'evening', 4, '4:30–5:30 PM', 0.19,
    array['fruit','nuts_seeds','fluid_dairy','fitty_protein','cereals_starches'], 1, 3),
  ('north_indian', 5, 'dinner', 5, '8:00–9:00 PM', 0.26,
    array['cereals_starches','pulses_legumes','soya_plant_protein','vegetables','poultry_fish_meat','paneer_dairy','fats_oils'], 3, 6)
on conflict (region, meal_count, slot) do nothing;
