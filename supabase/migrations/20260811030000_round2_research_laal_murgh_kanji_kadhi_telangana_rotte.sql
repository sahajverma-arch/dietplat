-- LEANR: round 2 of the regional research pass — the items marked "ready
-- to add now" from the follow-up research round (Rajasthani non-veg gap
-- that was missed the first time; South Indian Kanji/non-veg-dinner
-- questions; besan's clinical exchange convention), plus the Hyderabadi
-- region-scope decision resolved as "broader Telangana catchment area,"
-- not narrowly Hyderabad-city Nizami cuisine.
--
-- 1. Laal Murgh (rajasthani, meat_lean) — a red-chili chicken curry using
-- the same Mathania-chili technique as Laal Maas (mutton isn't a modeled
-- exchange type here, so the chicken variant is what maps). Moderate-good
-- confidence: documented across multiple home-cooking sources including a
-- Hindi-language one, not just English food-blogger material. No new
-- archetype needed — meat_lean foods are never gated by archetype
-- components anywhere in this data (see Punjab's Chicken curry/Tandoori
-- chicken, added the same way); adding the food alone makes it part of
-- the region's normal dinner rotation.
--
-- 2. Kanji + Payar + Chammanthi (south_indian) — Kanji (rice gruel) maps
-- onto the existing cereal exchange with NO new gram math: research
-- confirmed the raw rice quantity is unchanged from regular cooked rice,
-- only the cooking water ratio differs, and Table 4.1 exchanges are
-- already defined on raw/dry weight, prep-method-agnostic. "Payar" is the
-- Malayalam name for moong dal — given its own dish_family (not reusing
-- 'moong_dal') for the same reason "Varan" (plain toor dal) got its own
-- family separate from 'toor_dal': the archetype needs to name a SPECIFIC
-- dish identity, not just constrain to "any food of this ingredient."
-- "Kanji + Payar + Chammanthi" (coconut chutney) is documented across
-- multiple independent sources as a genuine weekly Kerala dinner
-- tradition, not an occasional dish — reuses the EXISTING 'coconut_condiment'
-- family already seeded for Idli-Sambar's own condiment_fat role, same
-- optional/non-required treatment.
--
-- 3. Meen Curry + Nadan Kozhi Curry (south_indian, meat_lean) — real,
-- well-documented Kerala home dishes (fish curry and chicken curry
-- respectively), closing this region's previous zero-meat_lean gap. No
-- archetype: research found these pair best with PLAIN rice, not Kanji
-- specifically (the "Kanji + curry" pairing was far more weakly sourced
-- than "Kanji + Payar"), and dish-combination.ts's combineDishGroups()
-- only ever merges cereal+PULSE groups, never cereal+meat_lean, so there
-- would be no display benefit to a dedicated archetype here anyway — the
-- existing generic Rice/Matta rice pool already covers the cereal side.
--
-- 4. Kadhi (north_indian, pulse) + Kadhi Chawal Meal (lunch archetype) —
-- besan (gram flour) modeled as a pulse-type exchange at the same 30 g
-- raw basis as whole dal, per a recurring convention across several
-- independent Indian dietetics-course materials (an IGNOU-affiliated
-- exchange-list document among them) — corroborated across sources but
-- NOT primary-source-verified (the actual PDFs wouldn't load during
-- research), so this is flagged is_active = false pending a dietitian
-- confirming the exact macro figures, not just the category. Besan Pakora
-- was researched alongside this and explicitly NOT added — no Indian
-- clinical exchange-list convention exists anywhere for how much fat
-- exchange deep-frying adds, so it has nothing to build on yet.
--
-- 5. Jonna Rotte + Sajja Rotte (hyderabadi, cereal) — the Hyderabadi
-- region-scope question ("Hyderabad-city Nizami cuisine, correctly
-- rice-dominant" vs. "broader Telangana catchment area, genuinely
-- millet-roti-staple") was resolved by explicit direction: broader
-- Telangana scope. Jonna Rotte (jowar) and Sajja Rotte (bajra) are
-- well-documented Telangana staples, especially in dry-land-agriculture
-- rural households — the same millet-flatbread genre already modeled as
-- Jowar bhakri/Bajra bhakri for maharashtrian/rajasthani, given their own
-- Telugu-named food rows rather than just widening the bhakri rows' region
-- tags, since "rotte" and "bhakri" are named, distinct preparation styles
-- even from the same base grain. Jonna Rotte Dal Meal (dinner) mirrors the
-- exact shape of every other region's Roti Dal Meal/Bhakri Dal Meal —
-- reuses the same 4-family dal_curry set already used everywhere else, so
-- this inherits that same pre-existing, already-documented limitation
-- (the pulse role silently drops for non_vegetarian clients specifically,
-- since meat_lean is permanently anchored to dinner) rather than
-- introducing a new one. Sajja Rotte is seeded as a food only, no
-- dedicated archetype — kept deliberately minimal rather than inventing an
-- ungrounded fat-pairing claim for a second breakfast archetype.
--
-- DIETITIAN SIGN-OFF: NOT YET RECEIVED for this batch. Every new food and
-- archetype below is inserted with is_active = false, same structural
-- safety net as the two prior archetype migrations — nothing here can
-- influence a real generated plan (eligible-foods.ts's first filter step
-- excludes inactive foods entirely; route.ts's archetype query filters on
-- is_active = true) until a follow-up migration flips them live once
-- confirmed.

insert into public.dish_families (code, name, exchange_type, notes) values
  ('kanji', 'Kanji', 'cereal', 'Kerala rice gruel — same raw rice quantity as regular cooked rice, cooked with far more water.'),
  ('payar', 'Payar', 'pulse', 'Malayalam name for moong dal, prepared as Kanji''s traditional dinner accompaniment.'),
  ('kadhi', 'Kadhi', 'pulse', 'Besan (gram flour) and buttermilk curry, modeled as a pulse-type exchange — see this migration''s own header note on sourcing.'),
  ('jonna_rotte', 'Jonna Rotte', 'cereal', 'Telugu name for jowar (sorghum) roti — a traditional Telangana staple flatbread.'),
  ('sajja_rotte', 'Sajja Rotte', 'cereal', 'Telugu name for bajra (pearl millet) roti — same Telangana millet-staple tradition as Jonna Rotte.')
on conflict (code) do nothing;

insert into public.foods (name_en, exchange_type, exchange_units, serving_raw_g, household_measure, regions, diet_types, allergens, meal_slots, tags, dish_family_id, notes, is_active) values
  ('Laal Murgh', 'meat_lean', 1, 35, '35 g, in Mathania red-chili gravy',
    array['rajasthani'], array['non_vegetarian'], array[]::text[], array['lunch','dinner'], array['requires_cooking'],
    null,
    'Regional preparation of Chicken breast — identical exchange. Rajasthani red chicken curry, the same Mathania-chili technique as Laal Maas applied to chicken (mutton is not a modeled exchange type here). UNVERIFIED — pending dietitian confirmation.',
    false),
  ('Meen Curry', 'meat_lean', 1, 35, '35 g, in coconut-kudampuli gravy',
    array['south_indian'], array['non_vegetarian'], array['fish'], array['lunch','dinner'], array['requires_cooking'],
    null,
    'Regional preparation of Fish — identical exchange. Kerala fish curry, coconut and kudampuli (tamarind) base. UNVERIFIED — pending dietitian confirmation.',
    false),
  ('Nadan Kozhi Curry', 'meat_lean', 1, 35, '35 g, Malayali-style coconut oil & curry leaf curry',
    array['south_indian'], array['non_vegetarian'], array[]::text[], array['lunch','dinner'], array['requires_cooking'],
    null,
    'Regional preparation of Chicken breast — identical exchange. Malayali-style chicken curry, coconut oil and curry leaves, little/no tomato. UNVERIFIED — pending dietitian confirmation.',
    false),
  ('Kanji', 'cereal', 1, 20, 'rice gruel, ~3 tbsp raw rice',
    array['south_indian'], array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], array[]::text[], array['dinner'], array['requires_cooking'],
    (select id from public.dish_families where code = 'kanji'),
    'Kerala rice gruel, a genuine traditional dinner staple — same raw rice quantity as regular cooked rice, just more cooking water. UNVERIFIED — pending dietitian confirmation.',
    false),
  ('Payar', 'pulse', 1, 30, '3 tbsp raw / 1 katori cooked',
    array['south_indian'], array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], array[]::text[], array['dinner'], array['requires_cooking','high_fibre'],
    (select id from public.dish_families where code = 'payar'),
    'Malayalam name for moong dal, prepared as Kanji''s traditional dinner accompaniment. UNVERIFIED — pending dietitian confirmation.',
    false),
  ('Kadhi', 'pulse', 1, 30, '3 tbsp besan raw / 1 katori cooked curry',
    array['north_indian'], array['vegetarian','eggetarian','non_vegetarian','jain'], array['dairy'], array['lunch','dinner'], array['requires_cooking'],
    (select id from public.dish_families where code = 'kadhi'),
    'Besan (gram flour) and buttermilk curry — a genuine Haryana/Delhi everyday staple, eaten with rice (Kadhi Chawal). Besan modeled as a pulse-type exchange (~30 g raw, same basis as whole dal) per a recurring Indian dietetics-course convention, corroborated but NOT primary-source-verified — exact macro figures pending dietitian confirmation, not just the category. UNVERIFIED.',
    false),
  ('Jonna Rotte', 'cereal', 1, 20, '1 rotte (jowar/sorghum flour)',
    array['hyderabadi'], array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], array[]::text[], array['breakfast','lunch','dinner'], array['requires_cooking','high_fibre'],
    (select id from public.dish_families where code = 'jonna_rotte'),
    'Telugu name for jowar roti — a traditional Telangana staple flatbread, especially in dry-land-agriculture rural households (distinct from Hyderabad-city''s Nizami rice-forward tradition; this data models the broader Telangana catchment area). UNVERIFIED — pending dietitian confirmation.',
    false),
  ('Sajja Rotte', 'cereal', 1, 20, '1 rotte (bajra/pearl-millet flour)',
    array['hyderabadi'], array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], array[]::text[], array['breakfast','lunch','dinner'], array['requires_cooking','high_fibre'],
    (select id from public.dish_families where code = 'sajja_rotte'),
    'Telugu name for bajra roti — same Telangana millet-staple tradition as Jonna Rotte. UNVERIFIED — pending dietitian confirmation.',
    false)
on conflict do nothing;

insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, is_active, notes) values
  ('south_indian_kanji_payar_meal', 'Kanji with Payar', 'south_indian', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.85, false,
    'UNVERIFIED — pending dietitian confirmation. "Kanji + Payar + Chammanthi" is documented across multiple independent sources as a genuine weekly Kerala dinner tradition, directly analogous to Idli-Sambar.'),
  ('north_indian_kadhi_chawal_meal', 'Kadhi Chawal Meal', 'north_indian', 'lunch',
    array['vegetarian','eggetarian','non_vegetarian','jain'], 0.75, false,
    'UNVERIFIED — pending dietitian confirmation. "The everyday curry" in Haryana, a Delhi Sunday-lunch staple alongside the already-seeded Rajma Chawal. Scored below Kanji-Payar since besan''s own exchange figures aren''t primary-source-verified yet.'),
  ('hyderabadi_jonna_rotte_dal_meal', 'Jonna Rotte Dal Meal', 'hyderabadi', 'dinner',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.65, false,
    'UNVERIFIED — pending dietitian confirmation. Mirrors every other region''s Roti Dal Meal/Bhakri Dal Meal shape; the specific "millet roti + dal" pairing (vs. just "millet roti is a staple") is this project''s own extension of the research, not something explicitly confirmed, hence the more conservative score.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'kanji_cereal', array[(select id from public.dish_families where code = 'kanji')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_kanji_payar_meal'
union all
select id, 'payar_curry', array[(select id from public.dish_families where code = 'payar')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_kanji_payar_meal'
union all
select id, 'condiment_fat', array[(select id from public.dish_families where code = 'coconut_condiment')], 'fat', 3, false
from public.meal_archetypes where code = 'south_indian_kanji_payar_meal'
union all
select id, 'rice_cereal', array[(select id from public.dish_families where code = 'rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'north_indian_kadhi_chawal_meal'
union all
select id, 'kadhi_curry', array[(select id from public.dish_families where code = 'kadhi')], 'pulse', 2, true
from public.meal_archetypes where code = 'north_indian_kadhi_chawal_meal'
union all
select id, 'jonna_rotte_cereal', array[(select id from public.dish_families where code = 'jonna_rotte')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_jonna_rotte_dal_meal'
union all
select id, 'dal_curry', array[
    (select id from public.dish_families where code = 'chana_dal'),
    (select id from public.dish_families where code = 'masoor_dal'),
    (select id from public.dish_families where code = 'moong_dal'),
    (select id from public.dish_families where code = 'toor_dal')
  ], 'pulse', 2, true
from public.meal_archetypes where code = 'hyderabadi_jonna_rotte_dal_meal'
on conflict (archetype_id, component_role) do nothing;
