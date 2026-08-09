-- LEANR: Dish Composition Layer, stage 3 — curated names for a SET of 2+
-- vegetables (see src/db/schema.ts's vegetable_dish_combinations /
-- vegetable_dish_combination_members and
-- src/lib/plan/vegetable-dish-naming.ts). Presentation only: no exchange
-- allocation, quantity, or macro logic changes.
--
-- Unlike dish_combinations (a fixed cereal+pulse PAIR, two FK columns), a
-- vegetable dish can have 2-4 members and the candidate vegetable pool
-- varies day to day, so membership is a separate join table rather than
-- fixed columns.
--
-- Seeded with exactly the two combos this pilot can ground in real,
-- already-tagged food data: Avial (Drumstick + Ash gourd + Yam, the
-- south_indian brief's own example) and Aloo Gobi (Potato + Cauliflower,
-- pan-Indian — region left null so it applies wherever a chapati/roti
-- dinner picks up that exact pair, matching how rajma_chawal/
-- moong_dal_rice were scoped). "Cabbage Peas Sabzi" and "Beans Poriyal"
-- from the brief's examples are NOT seeded here — this database has no
-- "Green peas" or "Beans"/"French beans" food yet, and inventing the combo
-- without the underlying food would be exactly the kind of unverified
-- substitution this layer exists to prevent. Add the food first, in its
-- own migration, if that combo is wanted.

create table if not exists public.vegetable_dish_combinations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  -- null = applies in every region; set = a region-specific idiom.
  region text,
  is_active boolean not null default true
);

create table if not exists public.vegetable_dish_combination_members (
  id uuid primary key default gen_random_uuid(),
  vegetable_dish_combination_id uuid not null references public.vegetable_dish_combinations(id) on delete cascade,
  dish_family_id uuid not null references public.dish_families(id),
  unique (vegetable_dish_combination_id, dish_family_id)
);

alter table public.vegetable_dish_combinations enable row level security;
alter table public.vegetable_dish_combination_members enable row level security;

create policy "fitelo staff full access to vegetable_dish_combinations"
  on public.vegetable_dish_combinations for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff full access to vegetable_dish_combination_members"
  on public.vegetable_dish_combination_members for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co')
  with check ((auth.jwt() ->> 'email') like '%@fitelo.co');

insert into public.dish_families (code, name, exchange_type, notes) values
  ('drumstick', 'Drumstick', 'vegetable_a', 'Moringa pod — one of Avial''s defining vegetables.'),
  ('ash_gourd', 'Ash gourd', 'vegetable_a', 'One of Avial''s defining vegetables.'),
  ('yam', 'Yam', 'vegetable_b', 'One of Avial''s defining vegetables.'),
  ('potato', 'Potato', 'vegetable_b', 'One of Aloo Gobi''s two defining vegetables.'),
  ('cauliflower', 'Cauliflower', 'vegetable_a', 'One of Aloo Gobi''s two defining vegetables.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'drumstick') where name_en = 'Drumstick';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'ash_gourd') where name_en = 'Ash gourd';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'yam') where name_en = 'Yam';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'potato') where name_en = 'Potato';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'cauliflower') where name_en = 'Cauliflower';

insert into public.vegetable_dish_combinations (code, display_name, region) values
  ('avial', 'Avial', 'south_indian'),
  ('aloo_gobi', 'Aloo Gobi', null)
on conflict (code) do nothing;

insert into public.vegetable_dish_combination_members (vegetable_dish_combination_id, dish_family_id)
select id, (select id from public.dish_families where code = 'drumstick') from public.vegetable_dish_combinations where code = 'avial'
union all
select id, (select id from public.dish_families where code = 'ash_gourd') from public.vegetable_dish_combinations where code = 'avial'
union all
select id, (select id from public.dish_families where code = 'yam') from public.vegetable_dish_combinations where code = 'avial'
union all
select id, (select id from public.dish_families where code = 'potato') from public.vegetable_dish_combinations where code = 'aloo_gobi'
union all
select id, (select id from public.dish_families where code = 'cauliflower') from public.vegetable_dish_combinations where code = 'aloo_gobi'
on conflict do nothing;
