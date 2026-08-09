-- LEANR: extend the Meal Archetype layer's lunch/dinner coverage (see
-- 20260810600000_south_indian_lunch_dinner_archetypes.sql) from South
-- Indian to the remaining 7 regions: north_indian, punjabi, gujarati,
-- bengali, maharashtrian, rajasthani, hyderabadi. Same discipline: every
-- dish_family is grounded in a real, already-seeded food row (verified
-- against the live foods table before writing this migration, not
-- invented); no new food added except where explicitly noted.
--
-- Design notes:
--
-- 1. LUNCH and DINNER pulse families are deliberately kept DISJOINT per
--    region wherever the food data allows it — e.g. north_indian's lunch
--    draws from {rajma, kala_chana}, its dinner from {chana_dal,
--    masoor_dal, moong_dal, toor_dal}. This is a variety-engineering
--    decision, not a culinary-authenticity claim: it means same-day
--    protein repetition is structurally unlikely by construction, on top
--    of (not instead of) the archetype-selector.ts / food-selector-
--    fallback.ts same-day exclusion logic already shipped.
--
-- 2. Coverage depth varies honestly with what the food data actually
--    supports. maharashtrian, punjabi, bengali and rajasthani each have
--    real, already-seeded, region-specific pulse/cereal names (Varan,
--    Amti, Usal, Chole, Cholar dal, Gatte, Poli, Bhakri, Makki roti,
--    Bhaat) — those regions get richer, name-accurate archetype sets.
--    gujarati and hyderabadi have no region-specific pulse or dinner-
--    cereal food beyond the generic Hindi-belt pool, so their archetypes
--    reuse that same generic pool rather than inventing region-specific
--    dish names this data can't support.
--
-- 3. "Chole" is regions=['punjabi'] only (not north_indian) — confirmed
--    against the live foods table before use here. It is NOT reused for
--    north_indian's archetypes.
--
-- 4. Two no-pulse, vegetable-defined archetypes follow the same pattern
--    already shipped for South Indian's Vegetable Kurma Meal /
--    Vegetable Stew Meal: Punjabi's "Makki Roti Sarson Saag Meal" is the
--    single most iconic Punjabi winter pairing, safe to assert without
--    further verification.

-- ---------------------------------------------------------------------
-- New dish_families, grounded in already-seeded food rows.
-- ---------------------------------------------------------------------
insert into public.dish_families (code, name, exchange_type, notes) values
  ('toor_dal', 'Toor dal', 'pulse', 'Split pigeon-pea lentil curry — shared across most non-South-Indian regions.'),
  ('roti', 'Roti', 'cereal', 'Whole-wheat flatbread, the North Indian-tagged staple word (distinct from the Chapati family used for South Indian dinner).'),
  ('chole', 'Chole', 'pulse', 'Kabuli chana (chickpea) curry — Punjabi-specific food row.'),
  ('makki_roti', 'Makki roti', 'cereal', 'Corn-flour flatbread — Punjabi winter staple, classically paired with Sarson saag.'),
  ('sarson_saag', 'Sarson saag', 'vegetable_a', 'Mustard greens — the classic partner to Makki roti.'),
  ('cholar_dal', 'Cholar dal', 'pulse', 'Bengali chana dal preparation with coconut and bay leaf.'),
  ('poli', 'Poli', 'cereal', 'Maharashtrian word for the wheat flatbread other regions call Roti/Chapati (see CLAUDE.md''s Anjali plan finding).'),
  ('bhakri', 'Bhakri', 'cereal', 'Millet flatbread — covers both Jowar bhakri and Bajra bhakri (both maharashtrian+rajasthani food rows, exchange-equivalent).'),
  ('varan', 'Varan', 'pulse', 'Plain Maharashtrian dal — the everyday half of "Varan Bhaat".'),
  ('masoor_amti', 'Masoor amti', 'pulse', 'Maharashtrian tamarind-spiced masoor dal.'),
  ('matki_usal', 'Matki usal', 'pulse', 'Sprouted moth bean curry.'),
  ('vaal_usal', 'Vaal usal', 'pulse', 'Sprouted field bean curry.'),
  ('chana_usal', 'Chana usal', 'pulse', 'Sprouted chickpea curry.'),
  ('moong_usal', 'Moong usal', 'pulse', 'Sprouted moong curry.'),
  ('gatte', 'Gatte', 'pulse', 'Besan (gram flour) dumplings in curd curry — Rajasthani specialty; not vegan (curd-based).')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'toor_dal') where name_en = 'Toor dal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'roti') where name_en = 'Roti';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'chole') where name_en = 'Chole';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'makki_roti') where name_en = 'Makki roti';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'sarson_saag') where name_en = 'Sarson saag';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'cholar_dal') where name_en = 'Cholar dal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'poli') where name_en = 'Poli';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'bhakri') where name_en in ('Jowar bhakri', 'Bajra bhakri');
update public.foods set dish_family_id = (select id from public.dish_families where code = 'varan') where name_en = 'Varan';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'masoor_amti') where name_en = 'Masoor amti';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'matki_usal') where name_en = 'Matki usal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'vaal_usal') where name_en = 'Vaal usal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'chana_usal') where name_en = 'Chana usal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'moong_usal') where name_en = 'Moong usal';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'gatte') where name_en = 'Gatte';
-- Bhaat is Maharashtrian's own alias food row for plain rice — reuses the
-- EXISTING 'rice' family (from 20260810500000_dish_combinations.sql) so a
-- maharashtrian archetype's rice-family role admits either name.
update public.foods set dish_family_id = (select id from public.dish_families where code = 'rice') where name_en = 'Bhaat';

-- ---------------------------------------------------------------------
-- Archetypes. dietTypes = intersection of REQUIRED components' own
-- dietTypes, same rule as every prior archetype migration. Gatte is the
-- only new food here without vegan in its dietTypes (curd-based) — its
-- archetype is scoped accordingly.
-- ---------------------------------------------------------------------
insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  -- north_indian
  ('north_indian_rajma_chawal_meal', 'Rajma Chawal Meal', 'north_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'The default North Indian lunch.'),
  ('north_indian_kala_chana_chawal_meal', 'Kala Chana Chawal Meal', 'north_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.75, 'Black chickpea curry with rice.'),
  ('north_indian_roti_dal_meal', 'Roti Dal Meal', 'north_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype, deliberately not narrow: rotates among chana/masoor/moong/toor dal, mirroring the "Everyday Thali" pattern for a cuisine where any dal is an authentic roti pairing.'),

  -- punjabi
  ('punjabi_rajma_chawal_meal', 'Rajma Chawal Meal', 'punjabi', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'The default Punjabi lunch.'),
  ('punjabi_chole_chawal_meal', 'Chole Chawal Meal', 'punjabi', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.9, 'Kabuli chana curry with rice — a Punjabi-specific pulse.'),
  ('punjabi_kala_chana_chawal_meal', 'Kala Chana Chawal Meal', 'punjabi', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.7, 'Black chickpea curry with rice.'),
  ('punjabi_roti_dal_meal', 'Roti Dal Meal', 'punjabi', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype: rotates among chana/masoor/moong/toor dal.'),
  ('punjabi_makki_roti_sarson_saag_meal', 'Makki Roti Sarson Saag Meal', 'punjabi', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6,
    'The single most iconic Punjabi winter pairing. No pulse role by design, same pattern as South Indian''s Vegetable Kurma Meal — Sarson saag (vegetable_a) is the defining component, not a dal.'),

  -- gujarati (no region-specific pulse/dinner-cereal food in this data — reuses the generic pool honestly rather than inventing a name)
  ('gujarati_rajma_chawal_meal', 'Rajma Chawal Meal', 'gujarati', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'The default lunch.'),
  ('gujarati_kala_chana_chawal_meal', 'Kala Chana Chawal Meal', 'gujarati', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.75, 'Black chickpea curry with rice.'),
  ('gujarati_roti_dal_meal', 'Roti Dal Meal', 'gujarati', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype: rotates among chana/masoor/moong/toor dal.'),

  -- bengali (rice-heavy at both meals — no bengali-tagged roti food exists, so dinner stays rice too, honestly reflecting the data rather than forcing roti)
  ('bengali_cholar_dal_rice_meal', 'Cholar Dal Rice Meal', 'bengali', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'Bengali chana dal with coconut and bay leaf, over rice.'),
  ('bengali_rajma_rice_meal', 'Rajma Rice Meal', 'bengali', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6, 'Rajma with rice.'),
  ('bengali_dal_rice_meal', 'Dal Rice Meal', 'bengali', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype: rotates among chana/masoor/moong/toor dal, over rice.'),

  -- maharashtrian (richest available region-specific data — Varan/Amti/Usal/Poli/Bhaat all verified real words in this data, see CLAUDE.md)
  ('maharashtrian_varan_bhaat_meal', 'Varan Bhaat Meal', 'maharashtrian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'The quintessential everyday Maharashtrian meal — plain dal (varan) with rice (bhaat).'),
  ('maharashtrian_amti_bhaat_meal', 'Amti Bhaat Meal', 'maharashtrian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.85, 'Tamarind-spiced masoor amti with rice (bhaat).'),
  ('maharashtrian_usal_poli_meal', 'Usal Poli Meal', 'maharashtrian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype: rotates among matki/vaal/chana/moong usal (sprouted-legume curries), with poli.'),

  -- rajasthani (Gatte + Bajra/Jowar bhakri are real, distinctly-tagged Rajasthani foods)
  ('rajasthani_gatte_rice_meal', 'Gatte Ki Sabzi Rice Meal', 'rajasthani', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 1.0, 'Besan dumplings in curd curry, with rice. Not vegan — curd-based.'),
  ('rajasthani_rajma_chawal_meal', 'Rajma Chawal Meal', 'rajasthani', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.7, 'Rajma with rice.'),
  ('rajasthani_bhakri_dal_meal', 'Bhakri Dal Meal', 'rajasthani', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype: rotates among chana/masoor/moong/toor dal, with millet bhakri (jowar or bajra).'),

  -- hyderabadi (no region-specific pulse/dinner-cereal food in this data — reuses the generic pool honestly)
  ('hyderabadi_rajma_chawal_meal', 'Rajma Chawal Meal', 'hyderabadi', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0, 'The default lunch.'),
  ('hyderabadi_kala_chana_chawal_meal', 'Kala Chana Chawal Meal', 'hyderabadi', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.75, 'Black chickpea curry with rice.'),
  ('hyderabadi_roti_dal_meal', 'Roti Dal Meal', 'hyderabadi', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 1.0,
    'Broad archetype: rotates among chana/masoor/moong/toor dal.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Components. Same shape throughout: a required cereal role, a required
-- pulse role (single family for narrow archetypes, a SET for broad
-- ones), and — for the two no-pulse pairings — a required vegetable_a
-- role instead.
-- ---------------------------------------------------------------------
insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)

-- north_indian
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_rajma_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'rajma')], 'pulse', 2, true
from public.meal_archetypes where code = 'north_indian_rajma_chawal_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_kala_chana_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'kadala_curry')], 'pulse', 2, true
from public.meal_archetypes where code = 'north_indian_kala_chana_chawal_meal'
union all
select id, 'roti_cereal', array[(select id from public.dish_families where code = 'roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_roti_dal_meal'
union all
select id, 'dal_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'north_indian_roti_dal_meal'

-- punjabi
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_rajma_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'rajma')], 'pulse', 2, true
from public.meal_archetypes where code = 'punjabi_rajma_chawal_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_chole_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'chole')], 'pulse', 2, true
from public.meal_archetypes where code = 'punjabi_chole_chawal_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_kala_chana_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'kadala_curry')], 'pulse', 2, true
from public.meal_archetypes where code = 'punjabi_kala_chana_chawal_meal'
union all
select id, 'roti_cereal', array[(select id from public.dish_families where code = 'roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_roti_dal_meal'
union all
select id, 'dal_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'punjabi_roti_dal_meal'
union all
select id, 'makki_roti_cereal', array[(select id from public.dish_families where code = 'makki_roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_makki_roti_sarson_saag_meal'
union all
select id, 'sarson_saag_vegetable', array[(select id from public.dish_families where code = 'sarson_saag')], 'vegetable_a', 2, true
from public.meal_archetypes where code = 'punjabi_makki_roti_sarson_saag_meal'

-- gujarati
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_rajma_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'rajma')], 'pulse', 2, true
from public.meal_archetypes where code = 'gujarati_rajma_chawal_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_kala_chana_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'kadala_curry')], 'pulse', 2, true
from public.meal_archetypes where code = 'gujarati_kala_chana_chawal_meal'
union all
select id, 'roti_cereal', array[(select id from public.dish_families where code = 'roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_roti_dal_meal'
union all
select id, 'dal_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'gujarati_roti_dal_meal'

-- bengali
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'bengali_cholar_dal_rice_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'cholar_dal')], 'pulse', 2, true
from public.meal_archetypes where code = 'bengali_cholar_dal_rice_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'bengali_rajma_rice_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'rajma')], 'pulse', 2, true
from public.meal_archetypes where code = 'bengali_rajma_rice_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'bengali_dal_rice_meal'
union all
select id, 'dal_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'bengali_dal_rice_meal'

-- maharashtrian
union all
select id, 'bhaat_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_varan_bhaat_meal'
union all
select id, 'varan_curry', array[(select id from public.dish_families where code = 'varan')], 'pulse', 2, true
from public.meal_archetypes where code = 'maharashtrian_varan_bhaat_meal'
union all
select id, 'bhaat_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_amti_bhaat_meal'
union all
select id, 'amti_curry', array[(select id from public.dish_families where code = 'masoor_amti')], 'pulse', 2, true
from public.meal_archetypes where code = 'maharashtrian_amti_bhaat_meal'
union all
select id, 'poli_cereal', array[(select id from public.dish_families where code = 'poli')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_usal_poli_meal'
union all
select id, 'usal_curry',
  array[
    (select id from public.dish_families where code = 'matki_usal'),
    (select id from public.dish_families where code = 'vaal_usal'),
    (select id from public.dish_families where code = 'chana_usal'),
    (select id from public.dish_families where code = 'moong_usal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'maharashtrian_usal_poli_meal'

-- rajasthani
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_gatte_rice_meal'
union all
select id, 'gatte_curry', array[(select id from public.dish_families where code = 'gatte')], 'pulse', 2, true
from public.meal_archetypes where code = 'rajasthani_gatte_rice_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_rajma_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'rajma')], 'pulse', 2, true
from public.meal_archetypes where code = 'rajasthani_rajma_chawal_meal'
union all
select id, 'bhakri_cereal', array[(select id from public.dish_families where code = 'bhakri')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_bhakri_dal_meal'
union all
select id, 'dal_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'rajasthani_bhakri_dal_meal'

-- hyderabadi
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_rajma_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'rajma')], 'pulse', 2, true
from public.meal_archetypes where code = 'hyderabadi_rajma_chawal_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_kala_chana_chawal_meal'
union all
select id, 'legume_curry', array[(select id from public.dish_families where code = 'kadala_curry')], 'pulse', 2, true
from public.meal_archetypes where code = 'hyderabadi_kala_chana_chawal_meal'
union all
select id, 'roti_cereal', array[(select id from public.dish_families where code = 'roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_roti_dal_meal'
union all
select id, 'dal_curry',
  array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'hyderabadi_roti_dal_meal'

on conflict (archetype_id, component_role) do nothing;
