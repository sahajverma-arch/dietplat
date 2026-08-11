-- LEANR: Meal Archetype coverage — thin-dinner-set follow-up to the
-- Phase 1 re-audit (10 cells with exactly 1 active archetype: no. real
-- day-to-day rotation despite not being technically "empty"). Reads
-- archetype_components for each of the 6 thin dinner archetypes first:
-- 5 of them already declare their pulse role as a SET of 4 dal families
-- (chana_dal/masoor_dal/moong_dal/toor_dal, or maharashtrian's usal
-- equivalents), so vegetarian clients already get real dal rotation —
-- the actual gap is a missing CEREAL alternative (only one of Roti/Rice/
-- Bhakri declared per region) and the lack of a second named identity for
-- the slot, not a pulse problem.
--
-- Non-vegetarian dinner protein variety: NOT addressed here, deliberately.
-- Checked every meat_lean food in the system before drafting anything —
-- Chicken curry/Tandoori chicken/Tandoori fish (the only named protein
-- preparations that exist anywhere) are punjabi-only; every other region's
-- meat_lean pool is the plain generic Chicken breast/Fish with no
-- dish_family_id at all. An archetype component pointing at "the meat_lean
-- family" in these regions would just re-point at the same single food
-- already in use — zero real rotation, pure label padding. Would also
-- repeat, at the protein level, the exact manufactured-authenticity
-- mistake already avoided at the cereal level (see the dropped Poha
-- candidates in 20260811000000). Flagged as a separate food-data follow-up
-- item, not attempted here.
--
-- All 6 candidates below reuse an EXISTING dish family/food — no new
-- dish_families, no new foods except one meal_slots widening (Khakhra),
-- and therefore no macro-math change: same "already-eligible food, just
-- narrowing which one" guarantee as every prior archetype migration.
--
-- 1. Varan Bhaat Meal (dinner, maharashtrian) — the EXACT same varan+rice
-- dish families as the already-seeded, already-1.0-scored LUNCH archetype
-- of the same name (whose own notes call it "the quintessential EVERYDAY
-- Maharashtrian meal"). Only the "also eaten at dinner" time-of-day claim
-- is new; the dish itself is already the most confidently-grounded thing
-- in this migration, hence the highest score below.
--
-- 2-4. Dal Rice Meal (north_indian, hyderabadi) / Dal Bhat Meal (gujarati)
-- (all dinner) — a second, rice-based cereal option alongside each
-- region's existing roti-based dal archetype, reusing the same dal_curry
-- family set already declared there. north_indian already has 2 rice+dal
-- LUNCH archetypes (Rajma Chawal, Kala Chana Chawal) establishing the
-- pattern for that region specifically; hyderabadi/Telugu cuisine is
-- traditionally MORE rice-centric than wheat roti, arguably a better fit
-- than its existing Roti Dal Meal; gujarati's "Dal Bhat" is a real, common
-- everyday-meal term but the weakest-grounded of the three.
--
-- 5. Dal Roti Meal (dinner, rajasthani) — confirmed against
-- rajasthani_bhakri_dal_meal's own archetype_components first: its cereal
-- role is bhakri_cereal -> [bhakri] (Bajra bhakri), NOT roti, so a
-- roti-based second option is genuine new rotation, not a duplicate.
-- Lowest score of the dinner set — wheat roti is eaten in Rajasthan but is
-- meaningfully less central than the region's own bhakri.
--
-- 6. Khakhra Meal (evening, gujarati) — Khakhra is a shelf-stable savory
-- cracker commonly eaten any time of day, not just breakfast, but its
-- meal_slots was only ever seeded as breakfast-only. Widened the same
-- "widen rather than duplicate" way migration #16 widened Kala chana, and
-- this batch's sibling migration widened Muri.
--
-- Dropped, not included here (see the accompanying proposal for reasons):
-- bengali/dinner (no confident second cereal — Bengal's existing rice-dal
-- archetype already uses the region's real staple; a roti-based
-- alternative would be weaker than any candidate above), bengali/evening
-- (stretching Luchi, a heavy fried breakfast item, into a light evening
-- snack had nothing to back it), bengali/breakfast (already has a pending,
-- separate candidate in 20260811000000 — not duplicating it here), and
-- hyderabadi/breakfast (still no genuinely native option in existing food
-- data; a real replacement needs new food data, not just an archetype).
--
-- GROUNDING — same treatment as 20260811000000: none of these six are
-- grounded in real Fitelo plan data, authenticity_score is set low/mid to
-- reflect that. Deliberately kept in its own file rather than merged into
-- the Murmura/Muri migration so the two batches could be reviewed and
-- approved independently.
--
-- DIETITIAN SIGN-OFF: RECEIVED. A Fitelo dietitian reviewed this batch's
-- summary table (all 6 candidates, including the two lowest-confidence
-- ones — Rajasthani Dal Roti at 0.5 and Gujarati Dal Bhat at 0.55) and
-- approved all of them as listed. is_active is therefore set to true
-- below at authoring time — this migration was never applied while
-- is_active was false, so there is no separate pre-approval state to
-- clean up in a follow-up migration.

update public.foods set meal_slots = array_append(meal_slots, 'evening')
  where name_en = 'Khakhra' and not (meal_slots @> array['evening']);

insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, is_active, notes) values
  ('maharashtrian_varan_bhaat_meal_dinner', 'Varan Bhaat Meal', 'maharashtrian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.75, true,
    'Dietitian-approved. Same varan+rice dish families as the already-verified (1.0) lunch archetype of the same name; only the "also eaten at dinner" claim is new.'),
  ('north_indian_dal_rice_meal', 'Dal Rice Meal', 'north_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.65, true,
    'Dietitian-approved. Rice+dal alternative to the existing Roti Dal Meal; this region already has 2 rice+dal lunch archetypes (Rajma Chawal, Kala Chana Chawal) but none at dinner yet.'),
  ('hyderabadi_dal_rice_meal', 'Dal Rice Meal', 'hyderabadi', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6, true,
    'Dietitian-approved. Telugu/Hyderabadi cuisine is traditionally rice-centric, arguably a better fit than the existing Roti Dal Meal, but no Fitelo-specific source confirms it.'),
  ('gujarati_dal_bhat_meal', 'Dal Bhat Meal', 'gujarati', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.55, true,
    'Dietitian-approved. "Dal Bhat" is a real, common Gujarati/Kathiyawadi everyday-meal term; weakest-grounded of the three Dal Rice/Bhat candidates in this migration.'),
  ('rajasthani_dal_roti_meal', 'Dal Roti Meal', 'rajasthani', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.5, true,
    'Dietitian-approved. Confirmed the existing rajasthani_bhakri_dal_meal uses bhakri, not roti, so this is genuine new rotation, not a duplicate — but wheat roti is meaningfully less central to Rajasthani identity than the region''s own bajra bhakri, hence the lowest score in this batch.'),
  ('gujarati_khakhra_meal_evening', 'Khakhra Meal', 'gujarati', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.55, true,
    'Dietitian-approved. Khakhra is a shelf-stable savory cracker commonly eaten any time of day, not just breakfast; meal_slots widened accordingly in this same migration.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'bhaat_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'maharashtrian_varan_bhaat_meal_dinner'
union all
select id, 'varan_curry', array[(select id from public.dish_families where code = 'varan')], 'pulse', 2, true
from public.meal_archetypes where code = 'maharashtrian_varan_bhaat_meal_dinner'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_dal_rice_meal'
union all
select id, 'dal_curry', array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'north_indian_dal_rice_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_dal_rice_meal'
union all
select id, 'dal_curry', array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'hyderabadi_dal_rice_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_dal_bhat_meal'
union all
select id, 'dal_curry', array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'gujarati_dal_bhat_meal'
union all
select id, 'roti_cereal', array[(select id from public.dish_families where code = 'roti')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_dal_roti_meal'
union all
select id, 'dal_curry', array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'rajasthani_dal_roti_meal'
union all
select id, 'khakhra_cereal', array[(select id from public.dish_families where code = 'khakhra')], 'cereal', 1, true
from public.meal_archetypes where code = 'gujarati_khakhra_meal_evening'
on conflict (archetype_id, component_role) do nothing;
