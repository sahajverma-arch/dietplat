-- LEANR: extend the Meal Archetype layer from breakfast-only to lunch and
-- dinner, South Indian pilot region. Same pattern as
-- 20260810200000_south_indian_breakfast_archetype_pilot.sql: tag existing
-- foods into dish_families, add one new food only where no real dish exists
-- yet (Rasam), seed archetypes, seed components. Grounded against the live
-- foods table, not invented — see the accompanying design conversation.
--
-- Two of the brief's example dinner names are deliberately NOT seeded:
-- "Chapati + Curry Meal" duplicates "Chapati + Vegetable Stew Meal" with no
-- second south_indian vegetable-curry dish_family to distinguish them from
-- — seeding both would be a hollow, non-narrowing archetype. If a real
-- second vegetable-curry identity (e.g. a distinct "Avial"-style dinner
-- dish) is wanted, seed it once Phase 3's vegetable dish_family work lands.
--
-- Vegetable Kurma Meal / Chapati + Vegetable Stew Meal have no pulse
-- component at all (unlike the other seven archetypes here) — Kurma and
-- stew are coconut-vegetable preparations, not dal dishes, so their
-- identity is the coconut fat share (reusing coconut_condiment, already
-- proven for breakfast), not a pulse family. Their fat component is
-- is_required = false, matching the existing convention for every fat
-- component in this layer (see the breakfast pilot) — narrowing never
-- hard-requires a component whose allocation to the slot isn't guaranteed.

insert into public.foods
  (name_en, exchange_type, exchange_units, serving_raw_g, household_measure, regions, diet_types, meal_slots, allergens, tags, notes)
values
  ('Rasam', 'pulse', 1, 30, '1 katori rasam (toor dal, tamarind, tomato, rasam powder)',
    array['south_indian'], array['vegetarian','eggetarian','non_vegetarian','vegan'],
    array['lunch','dinner'], array[]::text[], array['requires_cooking','high_fibre'],
    'Thin tamarind-tomato-dal broth — pairs with rice, distinct from the thicker vegetable-laden Sambar.')
on conflict do nothing;

insert into public.dish_families (code, name, exchange_type, notes) values
  ('rasam', 'Rasam', 'pulse', 'Thin tamarind-toor dal broth, the other classic South Indian rice accompaniment alongside Sambar.'),
  ('parippu', 'Parippu', 'pulse', 'Kerala-style moong/toor dal with coconut and turmeric, simply seasoned.'),
  ('chana_dal', 'Chana dal', 'pulse', 'Split chickpea lentil curry.'),
  ('masoor_dal', 'Masoor dal', 'pulse', 'Split red lentil curry.'),
  ('chapati', 'Chapati', 'cereal', 'Whole-wheat flatbread — the dinner-slot cereal accompaniment to dal, distinct from the lunch-slot Rice family.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'rasam') where name_en = 'Rasam';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'parippu') where name_en = 'Parippu';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'chana_dal') where name_en = 'Chana dal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'masoor_dal') where name_en = 'Masoor dal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'chapati') where name_en = 'Chapati';

-- Diet types follow the same rule as the breakfast pilot: the intersection
-- of the archetype's REQUIRED components' own diet_types (a set-valued
-- pulse role like Mixed Lentil's is unioned across its member families
-- first, since any one of them satisfies the role, then intersected with
-- the other required components).
insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  ('south_indian_sambar_rice_meal', 'Sambar Rice Meal', 'south_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 1.0,
    'The default South Indian lunch — sambar and rice.'),
  ('south_indian_rasam_rice_meal', 'Rasam Rice Meal', 'south_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.85,
    'Rasam rice — lighter than sambar rice, equally everyday.'),
  ('south_indian_parippu_rice_meal', 'Parippu Rice Meal', 'south_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.9,
    'Kerala-style parippu and rice.'),
  ('south_indian_kadala_curry_rice_meal', 'Kadala Curry Rice Meal', 'south_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.7,
    'Kadala (black chickpea) curry with rice — reuses the kadala_curry family already seeded for the Puttu-Kadala breakfast pairing.'),
  ('south_indian_vegetable_kurma_meal', 'Vegetable Kurma Meal', 'south_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6,
    'Coconut-forward vegetable curry with rice. No pulse role by design — see migration header. Vegetable identity itself is the Phase 3 dish-naming layer''s job, not this archetype''s.'),
  ('south_indian_chapati_moong_dal_meal', 'Chapati Moong Dal Meal', 'south_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Everyday dinner: chapati with moong dal.'),
  ('south_indian_chapati_chana_dal_meal', 'Chapati Chana Dal Meal', 'south_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.9,
    'Everyday dinner: chapati with chana dal.'),
  ('south_indian_chapati_mixed_lentil_meal', 'Chapati Mixed Lentil Meal', 'south_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.8,
    'Broad archetype, deliberately not narrow: rotates among chana/moong/masoor dal, mirroring the "Everyday Thali" pattern for cuisines where any dal is an authentic chapati pairing.'),
  ('south_indian_chapati_vegetable_stew_meal', 'Chapati Vegetable Stew Meal', 'south_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6,
    'Coconut-milk vegetable stew with chapati. No pulse role by design — see migration header.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_sambar_rice_meal'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'sambar')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_sambar_rice_meal'

union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_rasam_rice_meal'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'rasam')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_rasam_rice_meal'

union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_parippu_rice_meal'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'parippu')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_parippu_rice_meal'

union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_kadala_curry_rice_meal'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'kadala_curry')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_kadala_curry_rice_meal'

union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_vegetable_kurma_meal'
union all
select id, 'coconut_fat', array[(select id from public.dish_families where code = 'coconut_condiment')], 'fat', 2, false
from public.meal_archetypes where code = 'south_indian_vegetable_kurma_meal'

union all
select id, 'chapati_cereal', array[(select id from public.dish_families where code = 'chapati')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_chapati_moong_dal_meal'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'moong_dal')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_chapati_moong_dal_meal'

union all
select id, 'chapati_cereal', array[(select id from public.dish_families where code = 'chapati')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_chapati_chana_dal_meal'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'chana_dal')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_chapati_chana_dal_meal'

union all
select id, 'chapati_cereal', array[(select id from public.dish_families where code = 'chapati')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_chapati_mixed_lentil_meal'
union all
select id, 'lentil_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'masoor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_chapati_mixed_lentil_meal'

union all
select id, 'chapati_cereal', array[(select id from public.dish_families where code = 'chapati')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_chapati_vegetable_stew_meal'
union all
select id, 'coconut_fat', array[(select id from public.dish_families where code = 'coconut_condiment')], 'fat', 2, false
from public.meal_archetypes where code = 'south_indian_chapati_vegetable_stew_meal'

on conflict (archetype_id, component_role) do nothing;
