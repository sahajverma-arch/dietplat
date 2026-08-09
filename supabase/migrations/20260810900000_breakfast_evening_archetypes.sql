-- LEANR: extend the Meal Archetype layer to breakfast and evening across
-- all 8 regions. Triggered by a concrete, confirmed gap: the "Paratha"
-- food row is regions=['north_indian'] ONLY — Punjab's breakfast pool
-- currently contains no paratha at all, only generic Poha/Corn flakes plus
-- the thin punjabi-specific set (Makki roti, Ghee, Lassi). Verified against
-- the live foods table before writing this migration.
--
-- Same discipline as every prior archetype migration: real, grounded food
-- data only. Most regions already HAD real, region-tagged breakfast foods
-- sitting with zero archetype coverage (Dhokla, Thepla, Luchi, Thalipeeth,
-- Sabudana khichdi, Bajra bhakri, Dalia, Idli, Dosa) — those just get new
-- archetype rows, no new food data. Only 3 regions needed new foods:
--
--  - Punjab/North India: 5 named paratha varieties (Aloo, Gobi, Paneer,
--    Methi, Mooli) — all standard, widely-known dishes, tagged for BOTH
--    regions since both genuinely eat all five. The existing generic
--    "Paratha" food is kept as-is (plain fallback) and also gets a
--    dish_family so it can be reused directly.
--  - Gujarat: Khakhra (thin roasted multigrain cracker) — extremely
--    common, uncontroversial addition alongside the already-real Dhokla/
--    Thepla.
--  - Rajasthan: Pyaaz Kachori (fried onion-stuffed kachori) — iconic
--    Rajasthani breakfast street food.
--  - Bengal: Muri, a regional alias name for puffed rice — same food
--    concept as the already-seeded generic "Murmura", same pattern as
--    Curd/Chaas/Lassi/Moru/Taak already being buttermilk aliases of each
--    other.
--
-- Two REAL foods get their `regions` widened (not duplicated) because they
-- are well-established as authentic to a region the data hadn't tagged yet:
--  - Poha (Kanda Poha) is Maharashtra's single most iconic breakfast dish;
--    it was seeded generic-only.
--  - Upma (Suji/Rava) is extremely common across Telugu-speaking
--    Andhra/Telangana households; it was seeded north_indian+maharashtrian
--    only.
--
-- Breakfast and evening structurally never allocate a pulse or vegetable
-- exchange in this data (meal_templates.allowed_exchange_types for both
-- slots is cereal/milk_cow/milk_skim/meat/fruit/fat/sugar) — every
-- archetype here is therefore cereal(+optional fat), the same shape
-- already established for South Indian's breakfast pilot. This is a
-- structural fact of the meal skeleton, not a simplification chosen here.

-- ---------------------------------------------------------------------
-- New foods.
-- ---------------------------------------------------------------------
insert into public.foods (name_en, exchange_type, exchange_units, serving_raw_g, household_measure, regions, diet_types, meal_slots, allergens, tags, notes) values
  ('Aloo Paratha', 'cereal', 2, 40, '1 paratha (potato-stuffed, atta)',
    array['north_indian','punjabi'], array['vegetarian','eggetarian','non_vegetarian'],
    array['breakfast'], array[]::text[], array['requires_cooking'],
    'Potato is a root vegetable — not jain. Same exchange_units/serving_raw_g convention as the existing plain "Paratha" row.'),
  ('Gobi Paratha', 'cereal', 2, 40, '1 paratha (cauliflower-stuffed, atta)',
    array['north_indian','punjabi'], array['vegetarian','eggetarian','non_vegetarian','jain'],
    array['breakfast'], array[]::text[], array['requires_cooking'], null),
  ('Paneer Paratha', 'cereal', 2, 40, '1 paratha (paneer-stuffed, atta)',
    array['north_indian','punjabi'], array['vegetarian','eggetarian','non_vegetarian','jain'],
    array['breakfast'], array['dairy'], array['requires_cooking'], null),
  ('Methi Paratha', 'cereal', 2, 40, '1 paratha (fenugreek leaf, atta)',
    array['north_indian','punjabi'], array['vegetarian','eggetarian','non_vegetarian','jain'],
    array['breakfast'], array[]::text[], array['requires_cooking'], null),
  ('Mooli Paratha', 'cereal', 2, 40, '1 paratha (radish-stuffed, atta)',
    array['north_indian','punjabi'], array['vegetarian','eggetarian','non_vegetarian'],
    array['breakfast'], array[]::text[], array['requires_cooking'], 'Radish (mooli) is a root vegetable — not jain.'),
  ('Khakhra', 'cereal', 1, 20, '2 khakhra (thin roasted multigrain crisps)',
    array['gujarati'], array['vegetarian','eggetarian','non_vegetarian','vegan','jain'],
    array['breakfast'], array[]::text[], array[]::text[], null),
  ('Pyaaz Kachori', 'cereal', 1, 25, '1 kachori (fried, onion-stuffed)',
    array['rajasthani'], array['vegetarian','eggetarian','non_vegetarian','vegan'],
    array['breakfast'], array[]::text[], array['requires_cooking'], 'Onion filling — not jain.'),
  ('Muri', 'cereal', 1, 20, '~2 cups puffed rice',
    array['bengali'], array['vegetarian','eggetarian','non_vegetarian','vegan','jain'],
    array['evening'], array[]::text[], array[]::text[], 'Regional alias of Murmura — same puffed-rice food, Bengali name.')
on conflict do nothing;

-- Widen, don't duplicate — both are real, well-established regional facts.
update public.foods set regions = array_append(regions, 'maharashtrian')
  where name_en = 'Poha' and not (regions @> array['maharashtrian']);
update public.foods set regions = array_append(regions, 'hyderabadi')
  where name_en = 'Suji / Rava (upma)' and not (regions @> array['hyderabadi']);

-- ---------------------------------------------------------------------
-- New dish_families.
-- ---------------------------------------------------------------------
insert into public.dish_families (code, name, exchange_type, notes) values
  ('aloo_paratha', 'Aloo Paratha', 'cereal', 'Potato-stuffed wheat flatbread.'),
  ('gobi_paratha', 'Gobi Paratha', 'cereal', 'Cauliflower-stuffed wheat flatbread.'),
  ('paneer_paratha', 'Paneer Paratha', 'cereal', 'Paneer-stuffed wheat flatbread.'),
  ('methi_paratha', 'Methi Paratha', 'cereal', 'Fenugreek-leaf wheat flatbread.'),
  ('mooli_paratha', 'Mooli Paratha', 'cereal', 'Radish-stuffed wheat flatbread.'),
  ('plain_paratha', 'Paratha', 'cereal', 'Plain, unstuffed layered wheat flatbread.'),
  ('dhokla', 'Dhokla', 'cereal', 'Steamed fermented besan-rice batter.'),
  ('thepla', 'Thepla', 'cereal', 'Fenugreek multigrain flatbread.'),
  ('khakhra', 'Khakhra', 'cereal', 'Thin roasted multigrain cracker.'),
  ('luchi', 'Luchi', 'cereal', 'Deep-fried maida bread.'),
  ('puffed_rice', 'Puffed rice', 'cereal', 'Covers both Murmura and Muri — same food, different regional name.'),
  ('poha', 'Poha', 'cereal', 'Flattened rice.'),
  ('thalipeeth', 'Thalipeeth', 'cereal', 'Multigrain bhajani flatbread.'),
  ('sabudana_khichdi', 'Sabudana khichdi', 'cereal', 'Sago pearl khichdi.'),
  ('dalia', 'Dalia', 'cereal', 'Broken-wheat porridge.'),
  ('upma', 'Upma', 'cereal', 'Roasted semolina (suji/rava) preparation.'),
  ('pyaaz_kachori', 'Pyaaz Kachori', 'cereal', 'Fried onion-stuffed kachori.'),
  ('ghee', 'Ghee', 'fat', 'Clarified butter.'),
  ('toop', 'Toop', 'fat', 'Maharashtrian name for ghee.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'aloo_paratha') where name_en = 'Aloo Paratha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'gobi_paratha') where name_en = 'Gobi Paratha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'paneer_paratha') where name_en = 'Paneer Paratha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'methi_paratha') where name_en = 'Methi Paratha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'mooli_paratha') where name_en = 'Mooli Paratha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'plain_paratha') where name_en = 'Paratha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'dhokla') where name_en = 'Dhokla';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'thepla') where name_en = 'Thepla';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'khakhra') where name_en = 'Khakhra';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'luchi') where name_en = 'Luchi';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'puffed_rice') where name_en in ('Murmura', 'Muri');
update public.foods set dish_family_id = (select id from public.dish_families where code = 'poha') where name_en = 'Poha';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'thalipeeth') where name_en = 'Thalipeeth';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'sabudana_khichdi') where name_en = 'Sabudana khichdi';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'dalia') where name_en = 'Dalia';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'upma') where name_en = 'Suji / Rava (upma)';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'pyaaz_kachori') where name_en = 'Pyaaz Kachori';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'ghee') where name_en = 'Ghee';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'toop') where name_en = 'Toop';

-- ---------------------------------------------------------------------
-- Archetypes. dietTypes = intersection of REQUIRED components' own
-- dietTypes (the optional ghee/toop fat component never narrows it).
-- ---------------------------------------------------------------------
insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  -- north_indian breakfast
  ('north_indian_aloo_paratha_meal', 'Aloo Paratha Meal', 'north_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian'], 1.0, 'The default North Indian breakfast.'),
  ('north_indian_gobi_paratha_meal', 'Gobi Paratha Meal', 'north_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 0.85, null),
  ('north_indian_methi_paratha_meal', 'Methi Paratha Meal', 'north_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 0.8, null),
  ('north_indian_roti_meal', 'Roti Meal', 'north_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6, 'Plain roti — an everyday, lighter alternative to the stuffed parathas.'),
  ('north_indian_dalia_meal', 'Dalia Meal', 'north_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.6, null),
  ('north_indian_upma_meal_evening', 'Upma Meal', 'north_indian', 'evening',
    array['vegetarian','eggetarian','non_vegetarian'], 0.7, null),
  ('north_indian_dalia_meal_evening', 'Dalia Meal', 'north_indian', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.6, null),

  -- punjabi breakfast
  ('punjabi_aloo_paratha_meal', 'Aloo Paratha Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian'], 1.0, 'The default Punjabi breakfast — Punjab is the paratha''s home region.'),
  ('punjabi_paneer_paratha_meal', 'Paneer Paratha Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 0.85, null),
  ('punjabi_makki_roti_meal', 'Makki Roti Meal', 'punjabi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6,
    'Corn-flour roti, more commonly a winter/dinner bread but a legitimate breakfast option — reuses the makki_roti family already seeded for the Makki Roti Sarson Saag dinner pairing.'),

  -- gujarati breakfast + evening
  ('gujarati_dhokla_meal', 'Dhokla Meal', 'gujarati', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 1.0, 'The default Gujarati breakfast.'),
  ('gujarati_thepla_meal', 'Thepla Meal', 'gujarati', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.9, null),
  ('gujarati_khakhra_meal', 'Khakhra Meal', 'gujarati', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.7, null),
  ('gujarati_dhokla_meal_evening', 'Dhokla Meal', 'gujarati', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 1.0, null),

  -- bengali breakfast + evening
  ('bengali_luchi_meal', 'Luchi Meal', 'bengali', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 1.0, 'The default Bengali breakfast. No pulse/vegetable role — breakfast never allocates either exchange type in this data, so the classic Luchi-Aloo Dum pairing isn''t structurally representable here.'),
  ('bengali_muri_meal_evening', 'Muri Meal', 'bengali', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.8, null),

  -- maharashtrian breakfast + evening
  ('maharashtrian_poha_meal', 'Poha Meal', 'maharashtrian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'Kanda Poha — Maharashtra''s single most iconic breakfast.'),
  ('maharashtrian_thalipeeth_meal', 'Thalipeeth Meal', 'maharashtrian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.8, null),
  ('maharashtrian_sabudana_khichdi_meal', 'Sabudana Khichdi Meal', 'maharashtrian', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.9, null),
  ('maharashtrian_poha_meal_evening', 'Poha Meal', 'maharashtrian', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.7, null),

  -- rajasthani breakfast
  ('rajasthani_bajra_bhakri_meal', 'Bajra Bhakri Meal', 'rajasthani', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Reuses the bhakri family already seeded for Rajasthani dinner (Jowar/Bajra bhakri).'),
  ('rajasthani_pyaaz_kachori_meal', 'Pyaaz Kachori Meal', 'rajasthani', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.8, null),

  -- south_indian evening (reuses breakfast's own idli/dosa families, zero new food data)
  ('south_indian_idli_meal_evening', 'Idli Meal', 'south_indian', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.9,
    'No pulse role — evening never allocates a pulse exchange in this data, unlike breakfast''s narrower case where Sambar is at least reachable.'),
  ('south_indian_dosa_meal_evening', 'Dosa Meal', 'south_indian', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.8, null),

  -- hyderabadi breakfast
  ('hyderabadi_upma_meal', 'Upma Meal', 'hyderabadi', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian'], 0.8,
    'Widened from the already-seeded north_indian/maharashtrian Upma food — extremely common across Telugu-speaking households.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Components.
-- ---------------------------------------------------------------------
insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)

-- north_indian
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'aloo_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_aloo_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'north_indian_aloo_paratha_meal'
union all
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'gobi_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_gobi_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'north_indian_gobi_paratha_meal'
union all
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'methi_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_methi_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'north_indian_methi_paratha_meal'
union all
select id, 'roti_cereal', array[(select id from public.dish_families where code = 'roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_roti_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'north_indian_roti_meal'
union all
select id, 'dalia_cereal', array[(select id from public.dish_families where code = 'dalia')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_dalia_meal'
union all
select id, 'upma_cereal', array[(select id from public.dish_families where code = 'upma')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_upma_meal_evening'
union all
select id, 'dalia_cereal', array[(select id from public.dish_families where code = 'dalia')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_dalia_meal_evening'

-- punjabi
union all
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'aloo_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_aloo_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'punjabi_aloo_paratha_meal'
union all
select id, 'paratha_cereal', array[(select id from public.dish_families where code = 'paneer_paratha')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_paneer_paratha_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'punjabi_paneer_paratha_meal'
union all
select id, 'makki_roti_cereal', array[(select id from public.dish_families where code = 'makki_roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_makki_roti_meal'

-- gujarati
union all
select id, 'dhokla_cereal', array[(select id from public.dish_families where code = 'dhokla')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_dhokla_meal'
union all
select id, 'thepla_cereal', array[(select id from public.dish_families where code = 'thepla')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_thepla_meal'
union all
select id, 'khakhra_cereal', array[(select id from public.dish_families where code = 'khakhra')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_khakhra_meal'
union all
select id, 'dhokla_cereal', array[(select id from public.dish_families where code = 'dhokla')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_dhokla_meal_evening'

-- bengali
union all
select id, 'luchi_cereal', array[(select id from public.dish_families where code = 'luchi')], 'cereal', 1, true
from public.meal_archetypes where code = 'bengali_luchi_meal'
union all
select id, 'puffed_rice_cereal', array[(select id from public.dish_families where code = 'puffed_rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'bengali_muri_meal_evening'

-- maharashtrian
union all
select id, 'poha_cereal', array[(select id from public.dish_families where code = 'poha')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_poha_meal'
union all
select id, 'toop_fat', array[(select id from public.dish_families where code = 'toop')], 'fat', 2, false
from public.meal_archetypes where code = 'maharashtrian_poha_meal'
union all
select id, 'thalipeeth_cereal', array[(select id from public.dish_families where code = 'thalipeeth')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_thalipeeth_meal'
union all
select id, 'toop_fat', array[(select id from public.dish_families where code = 'toop')], 'fat', 2, false
from public.meal_archetypes where code = 'maharashtrian_thalipeeth_meal'
union all
select id, 'sabudana_khichdi_cereal', array[(select id from public.dish_families where code = 'sabudana_khichdi')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_sabudana_khichdi_meal'
union all
select id, 'poha_cereal', array[(select id from public.dish_families where code = 'poha')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_poha_meal_evening'

-- rajasthani
union all
select id, 'bhakri_cereal', array[(select id from public.dish_families where code = 'bhakri')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_bajra_bhakri_meal'
union all
select id, 'ghee_fat', array[(select id from public.dish_families where code = 'ghee')], 'fat', 2, false
from public.meal_archetypes where code = 'rajasthani_bajra_bhakri_meal'
union all
select id, 'kachori_cereal', array[(select id from public.dish_families where code = 'pyaaz_kachori')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_pyaaz_kachori_meal'

-- south_indian evening
union all
select id, 'steamed_batter_cereal', array[(select id from public.dish_families where code = 'idli')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_idli_meal_evening'
union all
select id, 'fermented_crepe_cereal', array[(select id from public.dish_families where code = 'dosa')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_dosa_meal_evening'

-- hyderabadi
union all
select id, 'upma_cereal', array[(select id from public.dish_families where code = 'upma')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_upma_meal'

on conflict (archetype_id, component_role) do nothing;
