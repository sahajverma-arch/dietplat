-- LEANR: adds "Gobi Paratha Meal", "Methi Paratha Meal", and "Mooli
-- Paratha Meal" archetypes for punjabi breakfast, mirroring "Aloo Paratha
-- Meal" (20260810900000_breakfast_evening_archetypes.sql) exactly — same
-- two-component shape (a paratha_cereal role + the shared ghee_fat role),
-- same dish families (gobi_paratha/methi_paratha/mooli_paratha, already
-- seeded and already tagged onto their foods, just never linked to an
-- archetype until now).
--
-- Root cause this fixes: with only Aloo Paratha Meal active for punjabi
-- breakfast (Makki Roti Meal was just retired — see
-- 20260810960000_retire_makki_roti_breakfast_archetype.sql — since plain
-- roti/makki roti no longer belong at breakfast at all), the Meal
-- Archetype layer's weekly dish-family union (see CLAUDE.md "Meal
-- Archetype + Dish Composition layer") collapsed EVERY breakfast day onto
-- Aloo Paratha specifically: Gobi/Methi/Mooli Paratha, Oats, Poha, and Corn
-- flakes are all real, eligible foods for the slot, but none of them were
-- ever linked to a breakfast archetype, so the narrowing never let them
-- through. Adding these three restores real day-to-day rotation among the
-- parathas specifically (Oats/Poha/Corn flakes remain archetype-agnostic —
-- they were never meant to be a "named dish" the way a stuffed paratha is,
-- so no archetype claims them; a dietitian may still want to look at
-- broadening variety further, but that's a separate, later decision).
--
-- Diet types per archetype match each paratha's own foods.diet_types
-- (matching the design comment already established in the south_indian
-- pilot migration: an archetype should never claim eligibility for a diet
-- type its own required food can't actually serve) — Gobi and Methi
-- Paratha are jain-tagged, Mooli Paratha is not, matching Aloo Paratha
-- Meal's own vegetarian/eggetarian/non_vegetarian-only shape.

insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  ('punjabi_gobi_paratha_meal', 'Gobi Paratha Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 0.9,
    'Cauliflower-stuffed paratha — as common a Punjabi breakfast staple as Aloo Paratha.'),
  ('punjabi_methi_paratha_meal', 'Methi Paratha Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 0.9,
    'Fenugreek-stuffed paratha — a real, common Punjabi breakfast paratha.'),
  ('punjabi_mooli_paratha_meal', 'Mooli Paratha Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian'], 0.9,
    'Radish-stuffed paratha — a real, common winter Punjabi breakfast paratha.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'gobi_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_gobi_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, true
from public.meal_archetypes where code = 'punjabi_gobi_paratha_meal'
union all
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'methi_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_methi_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, true
from public.meal_archetypes where code = 'punjabi_methi_paratha_meal'
union all
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'mooli_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_mooli_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, true
from public.meal_archetypes where code = 'punjabi_mooli_paratha_meal'
on conflict (archetype_id, component_role) do nothing;
