-- LEANR: dietitian directive — whenever Omelette fills a slot's `meat`
-- exchange, that same slot's `cereal` exchange should be plain Paratha
-- specifically (not Roti, Aloo Paratha, Oats, or any other cereal).
--
-- Tagged on Omelette rather than hardcoded by name in the selection code,
-- matching the existing no_cooking_fat/cooking_fat convention — a food-tag
-- read at selection time, not a name string baked into food-selector-
-- fallback.ts. Scoped to Omelette only, not Egg/Egg curry/Egg bhurji —
-- the dietitian named Omelette specifically, and this project's discipline
-- is to implement exactly the confirmed rule, not generalize past it.
--
-- Paratha (plain, north_indian, breakfast-only in this data) is matched by
-- name at the selection layer rather than a new tag on the Paratha side —
-- there's only one plain Paratha food in this dataset (no regional alias
-- rows exist for it the way Roti/Ghee have many), so a second tag would be
-- redundant. Where Paratha isn't eligible (any region other than
-- north_indian, or any slot other than breakfast), the pairing gracefully
-- degrades to the normal cereal pool — same pattern as every other
-- same-slot pairing rule in this file.
--
-- A real, structural gap found by actually regenerating a plan (not
-- assumed): "Paratha" already carries dish_family_id = 'plain_paratha'
-- (set back in 20260810900000), but NO north_indian breakfast archetype
-- (Aloo/Gobi/Methi Paratha Meal, Roti Meal, Dalia Meal) declares that
-- family in its cereal role. Since the archetype layer's weekly
-- dish-family union (route.ts) narrows eligible-foods.ts's cereal pool to
-- ONLY the families the week's assigned archetypes declared, plain
-- Paratha was excluded from the eligible pool entirely, every single
-- week, regardless of Omelette — the exact same class of bug the original
-- Oats fix (20260810990000) addressed, just on the cereal side instead of
-- fat. A regenerated test plan confirmed it: Omelette days picked Aloo/
-- Methi Paratha instead of plain Paratha, because plain Paratha was never
-- even in the pool to begin with — this file's own selection-time
-- restriction can only pick from what eligible-foods.ts already handed it.
--
-- Fixed the same way Oats was: widen each of the 5 existing north_indian
-- breakfast archetypes' cereal-role dish_family_ids to ALSO accept
-- 'plain_paratha', alongside their own declared family (Aloo Paratha Meal
-- still primarily means aloo_paratha, etc.) — dish_family_ids is already a
-- SET per role specifically to allow this (see Roti Dal Meal's own
-- dal_curry role accepting 4 dal families, not 1). Guarantees
-- plain_paratha is part of the weekly union regardless of which of the 5
-- archetypes actually gets picked each day, restoring it as a real,
-- always-reachable rotation option on its own merit too — not purely an
-- Omelette-triggered special case. Safe from the "archetype label doesn't
-- match the actual food" concern already investigated earlier this
-- session: breakfast archetypes have no pulse role, so dish-combination.ts
-- never merges a cereal group into the archetype's own name here — the
-- rendered dish name always comes from whichever food was actually
-- selected, accurate regardless of which archetype nominally applied that
-- day.

update public.foods set tags = array_append(tags, 'pairs_with_plain_paratha')
  where name_en = 'Omelette' and not ('pairs_with_plain_paratha' = any(tags));

update public.archetype_components
set dish_family_ids = array_append(dish_family_ids, (select id from public.dish_families where code = 'plain_paratha'))
where exchange_type = 'cereal'
  and archetype_id in (
    select id from public.meal_archetypes where code in (
      'north_indian_aloo_paratha_meal',
      'north_indian_gobi_paratha_meal',
      'north_indian_methi_paratha_meal',
      'north_indian_roti_meal',
      'north_indian_dalia_meal'
    )
  )
  and not (dish_family_ids @> array[(select id from public.dish_families where code = 'plain_paratha')]);
