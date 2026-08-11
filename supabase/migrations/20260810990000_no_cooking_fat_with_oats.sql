-- LEANR: dietitian correction — "we cannot add ghee with oats".
--
-- Oats (added alongside 20260810970000's parent, given its own "Oats Meal"
-- archetype with NO fat component in 20260810980000, specifically because
-- "plain oats porridge doesn't conventionally need a ghee tempering the way
-- a paratha does") was still showing up with Ghee plated next to it on
-- every day it was actually selected for breakfast.
--
-- Root cause: the Meal Archetype layer's dish-family narrowing is a WEEKLY
-- UNION per (slot, exchangeType) across all 7 days' assigned archetypes
-- (route.ts, CLAUDE.md's "Meal Archetype + Dish Composition layer"), while
-- meal-distributor.ts's skeleton is identical for every day of the week —
-- breakfast always carries a nonzero `fat` exchange count regardless of
-- which archetype that specific day landed on. Giving "Oats Meal" no fat
-- component only meant it contributed nothing NEW to that union; it never
-- REMOVED Ghee, which the region's paratha archetypes' own `ghee_fat`
-- components already put there for the whole week. So on the days Oats was
-- actually selected, Ghee remained the only eligible `fat` food for
-- breakfast — the exact pairing the archetype was designed to avoid.
--
-- Fixed one level below the archetype/dish-family system, at plain food
-- tags, which food-selector-fallback.ts (and, via a matching prompt rule,
-- the LLM path) can check per-item within a single slot regardless of which
-- archetype is nominally assigned that day — the same mechanism already
-- used for the vegetable_a/vegetable_b salad restriction. `cooking_fat`
-- marks every fat-exchange food actually used to cook/temper a dish (ghee,
-- cooking oils) — inappropriate spooned over a cold cereal porridge.
-- `no_cooking_fat` on Oats means: whichever `fat` food fills its slot
-- should avoid `cooking_fat`-tagged foods. Almonds and Walnut (already
-- 'generic' region, so eligible in every region including punjabi) are
-- widened to breakfast so there's a real, appropriate alternative —
-- chopped nuts sprinkled over porridge is a standard preparation, unlike
-- ghee.

update public.foods set tags = array_append(tags, 'no_cooking_fat')
  where name_en = 'Oats' and not ('no_cooking_fat' = any(tags));

update public.foods set tags = array_append(tags, 'cooking_fat')
  where name_en in ('Ghee', 'Toop', 'Mustard oil', 'Groundnut oil', 'Til oil', 'Coconut oil', 'Sesame oil', 'Grated coconut')
    and not ('cooking_fat' = any(tags));

update public.foods set meal_slots = array_append(meal_slots, 'breakfast')
  where name_en in ('Almonds', 'Walnut') and not (meal_slots @> array['breakfast']);

-- The tag-based restriction above only has something to restrict TO if
-- Almonds/Walnut can actually survive eligible-foods.ts's dish-family
-- narrowing. That narrowing is a WEEKLY UNION built from every archetype's
-- OWN declared components (route.ts) — "Oats Meal" declaring no fat
-- component at all means it never adds anything to that union, so the
-- union for breakfast's `fat` type stays exactly {ghee-family} (from the
-- paratha archetypes' `ghee_fat` components), and Almonds/Walnut — having
-- no dish_family_id — get filtered OUT by that narrowing before food
-- selection ever sees them, regardless of their tags or meal_slots. Giving
-- "Oats Meal" a real (optional) fat component pointing at a genuine "nuts"
-- family fixes this at its source: the union becomes {ghee-family,
-- nuts-family}, and the tag-based logic above then picks correctly between
-- them per day.
insert into public.dish_families (code, name, exchange_type, notes) values
  ('nuts_topping', 'Nuts', 'fat', 'Roasted/raw nuts (almonds, walnuts) used as a fat exchange — an oats-porridge topping, not a cooking fat.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'nuts_topping')
  where name_en in ('Almonds', 'Walnut');

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'nuts_fat', array[(select id from public.dish_families where code = 'nuts_topping')], 'fat', 2, false
from public.meal_archetypes where code = 'punjabi_oats_meal'
on conflict (archetype_id, component_role) do nothing;
