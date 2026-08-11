-- LEANR: extends the Dish Composition Layer's curated vegetable combos
-- (see 20260810700000_vegetable_dish_combinations.sql for the original
-- Avial/Aloo Gobi pilot) with three more real, well-documented "Aloo + X"
-- pairings — Aloo Baingan, Tinda Aloo, Aloo Methi — confirmed via web
-- research, not invented. Companion fix to food-selector-fallback.ts's
-- SPLITTABLE_TYPES reversal (see the conversation this accompanies):
-- vegetable_a/vegetable_b no longer force-split into 2 arbitrary foods, so
-- a 2-vegetable meal now only ever happens when vegetable_b naturally
-- lands on Potato that day — these rows give that combination a real name
-- instead of falling through to the generic "Mixed Vegetable Sabzi".
--
-- All region: null (pan-Indian dishes, same reasoning as Aloo Gobi) —
-- Aloo Baingan and Aloo Methi are cooked across North India generally;
-- Tinda specifically is most associated with Punjab/North Indian cooking,
-- but the dish combo itself isn't a Punjab-exclusive idiom.
--
-- "potato" dish_family already exists from the Aloo Gobi migration and is
-- reused here unchanged — this only adds the 3 NEW vegetable_a families
-- (brinjal, tinda, methi) it pairs with.

insert into public.dish_families (code, name, exchange_type, notes) values
  ('brinjal', 'Brinjal', 'vegetable_a', 'Aloo Baingan''s vegetable_a half.'),
  ('tinda', 'Tinda', 'vegetable_a', 'Aloo Tinda / Tinda Aloo''s vegetable_a half — apple gourd, Punjab/North Indian.'),
  ('methi', 'Methi', 'vegetable_a', 'Aloo Methi''s vegetable_a half — fenugreek leaves.')
on conflict (code) do nothing;

-- Brinjal and its regional alias Vangi (identical exchange, see
-- table41_foods.json) share the same culinary identity for matching
-- purposes, same pattern as Potato/Cauliflower did not need an alias but
-- Avial's members would have, had one existed.
update public.foods set dish_family_id = (select id from public.dish_families where code = 'brinjal') where name_en in ('Brinjal', 'Vangi');
update public.foods set dish_family_id = (select id from public.dish_families where code = 'tinda') where name_en = 'Tinda';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'methi') where name_en = 'Methi';

insert into public.vegetable_dish_combinations (code, display_name, region) values
  ('aloo_baingan', 'Aloo Baingan', null),
  ('tinda_aloo', 'Tinda Aloo', null),
  ('aloo_methi', 'Aloo Methi', null)
on conflict (code) do nothing;

insert into public.vegetable_dish_combination_members (vegetable_dish_combination_id, dish_family_id)
select id, (select id from public.dish_families where code = 'potato') from public.vegetable_dish_combinations where code = 'aloo_baingan'
union all
select id, (select id from public.dish_families where code = 'brinjal') from public.vegetable_dish_combinations where code = 'aloo_baingan'
union all
select id, (select id from public.dish_families where code = 'potato') from public.vegetable_dish_combinations where code = 'tinda_aloo'
union all
select id, (select id from public.dish_families where code = 'tinda') from public.vegetable_dish_combinations where code = 'tinda_aloo'
union all
select id, (select id from public.dish_families where code = 'potato') from public.vegetable_dish_combinations where code = 'aloo_methi'
union all
select id, (select id from public.dish_families where code = 'methi') from public.vegetable_dish_combinations where code = 'aloo_methi'
on conflict do nothing;
