-- LEANR: Meal Archetype + Dish Composition coverage gap (§6.5 of the
-- technical doc) — Phase 3 draft from the punjabi/rajasthani/hyderabadi
-- evening + bengali breakfast audit. Four candidates, all reusing the
-- ALREADY-EXISTING 'puffed_rice' dish family (Murmura/Muri were already
-- tagged with it — see 20260810900000_breakfast_evening_archetypes.sql) —
-- no new dish_families, no new foods, no macro-math change of any kind:
-- the archetype layer only narrows which already-eligible cereal food fills
-- a slot the solver already sized, and Murmura/Poha/Muri all carry the
-- exact same Table 4.1 cereal exchange (20 g raw = 1 exchange) as every
-- other cereal food already in use.
--
-- 1-3. "{Region} Murmura Meal" (evening) — punjabi, rajasthani, hyderabadi
-- all currently have ZERO evening archetypes (confirmed via direct query
-- against meal_archetypes, not just the doc's vaguer "most of breakfast/
-- evening" phrasing). Murmura is already 'generic' region and already
-- eligible for evening everywhere, so this doesn't change what a client
-- could be served — only whether it renders as a named, intentional dish
-- rather than an arbitrary same-exchange-type fill.
--
-- A companion "{Region} Poha Meal" candidate was considered and DROPPED —
-- Poha's real regional association is Maharashtra/Gujarat specifically
-- (grounded there via maharashtrian_poha_meal, built from an actual real
-- generated plan), and extending it to three unrelated regions would
-- manufacture a cultural claim this layer has no data to back. Only the
-- Murmura candidates, which make no specific regional claim beyond "a
-- common pan-Indian tea-time snack," are seeded here.
--
-- 4. "Bengali Muri Meal" (breakfast) — Bengali breakfast currently has
-- exactly one archetype (Luchi), i.e. no real rotation at all. Muri is
-- already region-tagged 'bengali' specifically (not generic) — an existing
-- claim this migration doesn't invent, just extends from evening-only to
-- breakfast-eligible too, the same "widen rather than duplicate" technique
-- migration #16 (south_indian_breakfast_archetype_pilot.sql) used for Kala
-- chana/Grated coconut. The existing bengali_muri_meal_evening archetype
-- and its own dish-family link are untouched.
--
-- Hyderabadi breakfast (currently a single, non-native "Upma Meal" reused
-- from north_indian/maharashtrian) is deliberately left alone — the only
-- genuinely Hyderabadi-specific options (e.g. Pesarattu) aren't in the
-- foods table at all, and inventing a new food's exchange mapping is a
-- bigger, separate decision than seeding an archetype over already-existing
-- data. Not addressed in this migration.
--
-- GROUNDING: none of the four candidates below are grounded in real Fitelo
-- plan data — punjabi/rajasthani/bengali/hyderabadi never had a source PDF
-- the way north_indian (Deepak Sharma) and maharashtrian (Anjali Joshi)
-- did (see table41_foods.json's _source note and CLAUDE.md's "The exchange
-- system"). authenticity_score is set deliberately low (0.5-0.6) to
-- reflect that.
--
-- DIETITIAN SIGN-OFF: RECEIVED. A Fitelo dietitian reviewed this batch's
-- summary table (all 4 candidates, including the two lowest-confidence
-- ones) and approved all of them as listed. is_active is therefore set to
-- true below at authoring time — this migration was never applied while
-- is_active was false, so there is no separate pre-approval state to clean
-- up in a follow-up migration.

insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, is_active, notes) values
  ('punjabi_murmura_meal', 'Murmura Meal', 'punjabi', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.55, true,
    'Dietitian-approved. Puffed rice is a common pan-Indian tea-time snack; no Fitelo-specific source confirms it for Punjab. Closes punjabi/evening''s previous zero-archetype gap.'),
  ('rajasthani_murmura_meal', 'Murmura Meal', 'rajasthani', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.55, true,
    'Dietitian-approved. Puffed rice is a common pan-Indian tea-time snack; no Fitelo-specific source confirms it for Rajasthan. Closes rajasthani/evening''s previous zero-archetype gap.'),
  ('hyderabadi_murmura_meal', 'Murmura Meal', 'hyderabadi', 'evening',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.55, true,
    'Dietitian-approved. Puffed rice is a common pan-Indian tea-time snack; no Fitelo-specific source confirms it for Hyderabad. Closes hyderabadi/evening''s previous zero-archetype gap.'),
  ('bengali_muri_meal', 'Muri Meal', 'bengali', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.6, true,
    'Dietitian-approved. Muri (puffed rice) is already region-tagged bengali specifically and plain muri for breakfast is a real, common pattern, but no Fitelo-specific plan source confirms it. Gives Bengali breakfast a second option alongside the existing, fully-verified Luchi Meal (score 1.0).')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'puffed_rice_cereal', array[(select id from public.dish_families where code = 'puffed_rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'punjabi_murmura_meal'
union all
select id, 'puffed_rice_cereal', array[(select id from public.dish_families where code = 'puffed_rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'rajasthani_murmura_meal'
union all
select id, 'puffed_rice_cereal', array[(select id from public.dish_families where code = 'puffed_rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'hyderabadi_murmura_meal'
union all
select id, 'puffed_rice_cereal', array[(select id from public.dish_families where code = 'puffed_rice')], 'cereal', 1, true
from public.meal_archetypes where code = 'bengali_muri_meal'
on conflict (archetype_id, component_role) do nothing;

-- Muri was only ever seeded for the evening slot (bengali_muri_meal_evening) —
-- widening to breakfast is what actually makes the archetype above reachable.
-- Guarded the same way migration #16 widened Kala chana/Grated coconut.
update public.foods set meal_slots = array_append(meal_slots, 'breakfast')
  where name_en = 'Muri' and not (meal_slots @> array['breakfast']);
