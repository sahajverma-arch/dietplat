-- Add Dalia (broken-wheat porridge) as a Punjabi breakfast option.
--
-- Direct dietitian request: "add dalia also in breakfast options." Dalia was
-- seeded regions=['north_indian'] only (20260810900000_breakfast_evening_
-- archetypes.sql), and punjabi has no dalia archetype at all — its 3
-- breakfast archetypes are all stuffed paratha varieties plus Makki Roti, no
-- lighter porridge option. Same "eligible by every other check, invisible
-- because the region tag / archetype union never reaches it" shape already
-- fixed for Paratha/rajasthani, Rajasthani lunch pulse, etc. — punjabi and
-- north_indian are both wheat-belt regions where daliya is an everyday,
-- uncontroversial breakfast dish, so this is a real widening, not a
-- fabricated regional claim (same grounding standard as Paratha's own
-- rajasthani widening).
--
-- Mirrors north_indian_dalia_meal exactly: single required cereal component,
-- no fat component (Dalia's own archetype already omits ghee_fat in
-- north_indian too — a porridge isn't conventionally topped with ghee the
-- way a paratha is, see CLAUDE.md's "No cooking fat alongside a plain
-- porridge cereal" section).

update public.foods set regions = array_append(regions, 'punjabi')
  where name_en = 'Dalia' and not (regions @> array['punjabi']);

insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  ('punjabi_dalia_meal', 'Dalia Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.6,
    'Broken-wheat porridge — a lighter, everyday alternative to the stuffed parathas, same role Dalia already plays for north_indian breakfast.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'dalia_cereal', array[(select id from public.dish_families where code = 'dalia')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_dalia_meal'
on conflict (archetype_id, component_role) do nothing;
