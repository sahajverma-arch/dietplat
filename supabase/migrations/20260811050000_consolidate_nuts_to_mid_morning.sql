-- LEANR: dietitian directive — consolidate the day's "snack" nut serving
-- (Almonds/Walnut/Peanuts/Shengdana) into a single slot, mid_morning, every
-- day, instead of letting it fragment across breakfast/mid_morning/evening
-- as small, awkward gram amounts (e.g. "Almonds (3 g)") that don't read as
-- a real serving.
--
-- `fat` was never INDIVISIBLE (meal-distributor.ts's INDIVISIBLE_TYPES) —
-- the day's total fat exchanges split proportionally by kcal_share across
-- every allowed slot. Nuts only ever showed up at mid_morning/evening (and,
-- since 20260810990000's Oats fix, breakfast too) because those are the
-- only slots where a nut food's OWN meal_slots made it eligible — cooking
-- fats (Ghee, Mustard oil, ...) were never eligible there in the first
-- place (their meal_slots is breakfast/lunch/dinner only). Removing 'fat'
-- from evening's allowed_exchange_types here means evening no longer needs
-- a fat exchange at all, so nothing is left to fragment there. Breakfast
-- and lunch/dinner's cooking-fat pairing (Ghee/Mustard oil with Paratha,
-- 10 g each) is explicitly UNCHANGED by this migration — only the nut/
-- snack portion moves.
--
-- Evening's remaining allowed types (fruit, cereal) are untouched — the
-- Murmura/Khakhra/Dhokla-family evening archetypes seeded earlier this
-- session are cereal-exchange, not fat-exchange, and are completely
-- unaffected by fat leaving evening.
--
-- Removed 'evening' from all four nut/peanut foods' own meal_slots too
-- (Almonds, Walnut already generic; Peanuts/Shengdana region-specific) —
-- now genuinely unreachable there since evening no longer needs 'fat',
-- and leaving it would just be stale, inaccurate data. 'breakfast' stays
-- on Almonds/Walnut specifically: see the accompanying food-selector-
-- fallback.ts change — Oats (and any other no_cooking_fat cereal) still
-- needs a real non-cooking-fat option at breakfast, since consolidating
-- nuts to mid_morning can't remove that requirement without reintroducing
-- exactly the "ghee with oats" bug this session already fixed once.
-- Regular (non-Oats) breakfast cereals now get their `fat` slot restricted
-- to cooking-fat-tagged foods only, in code, not by removing Almonds/
-- Walnut's breakfast eligibility outright — see that file's own comment.

update public.meal_templates
set allowed_exchange_types = array_remove(allowed_exchange_types, 'fat')
where slot = 'evening' and 'fat' = any(allowed_exchange_types);

update public.foods
set meal_slots = array_remove(meal_slots, 'evening')
where name_en in ('Almonds', 'Walnut', 'Peanuts', 'Shengdana') and meal_slots @> array['evening'];
