-- LEANR: three dietitian corrections to the punjabi breakfast rotation
-- added in 20260810970000_gobi_methi_mooli_paratha_archetypes.sql.
--
-- 1. Seasonal realism: Gobi (cauliflower) and Mooli (radish) are winter
-- vegetables in Punjab — already reflected on the plain sabzi foods
-- ("Gobi" and "Radish" both already carry seasons = {winter}, see
-- 20260810920000_food_seasons.sql) but never propagated to the paratha
-- versions of the same vegetables, which were added later
-- (20260810900000_breakfast_evening_archetypes.sql) without a seasons
-- column value, defaulting to all_year. Retagging them winter-only is
-- consistent with the existing sabzi tagging, not a new claim. Aloo
-- (potato) and Methi (fenugreek, already sourced dried/frozen
-- off-season in real kitchens far more often than gobi/mooli) are left
-- at all_year — not requested, and not grounded the same way.
--
-- 2. Composition notes: each paratha's notes now describe what it
-- actually is (filling + dough), matching the plain-language descriptive
-- style already used elsewhere in this data (e.g. dish_families.notes).
-- This is documentation only — format-item.ts still shows only the
-- verified gram figure for cereal items, never an invented ingredient
-- gram-split; see CLAUDE.md's own note on why that split is never shown.
--
-- 3. A new "Oats Meal" archetype: without this, Oats (added in the same
-- round as this migration's parent) could never actually appear in a
-- generated plan — once ANY archetype is active for a slot, the Meal
-- Archetype layer's weekly dish-family union (see CLAUDE.md "Meal
-- Archetype + Dish Composition layer") excludes every food that isn't
-- linked to SOME archetype's family, and Oats had no dish_family_id at
-- all. A lower authenticity_score (0.7 vs the parathas' 0.9-1.0) than the
-- parathas keeps it a real, periodic rotation option without making it as
-- frequent as an actual traditional dish — cereal-only, no fat role,
-- since plain oats porridge doesn't conventionally need a ghee tempering
-- the way a paratha does.

update public.foods set seasons = array['winter'] where name_en = 'Gobi Paratha';
update public.foods set seasons = array['winter'] where name_en = 'Mooli Paratha';

update public.foods set notes =
  'Wheat-flour (atta) dough stuffed with spiced mashed potato (aalo) filling. ' || notes
  where name_en = 'Aloo Paratha';
update public.foods set notes =
  'Wheat-flour (atta) dough stuffed with spiced grated cauliflower (gobi) filling. A winter vegetable in Punjab — see seasons.'
  where name_en = 'Gobi Paratha';
update public.foods set notes =
  'Wheat-flour (atta) dough kneaded with chopped fenugreek greens (methi).'
  where name_en = 'Methi Paratha';
update public.foods set notes =
  'Wheat-flour (atta) dough stuffed with grated radish (mooli) filling. ' || notes || ' A winter vegetable in Punjab — see seasons.'
  where name_en = 'Mooli Paratha';

insert into public.dish_families (code, name, exchange_type, notes) values
  ('oats', 'Oats', 'cereal', 'Plain rolled oats porridge — a modern, non-traditional breakfast option added alongside the region''s parathas.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'oats') where name_en = 'Oats';

insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  ('punjabi_oats_meal', 'Oats Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.7,
    'Plain oats porridge — a real but non-traditional breakfast alternative to the parathas, given a lower authenticity score so it rotates in periodically rather than dominating.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'oats_cereal', array[(select id from public.dish_families where code = 'oats')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_oats_meal'
on conflict (archetype_id, component_role) do nothing;
