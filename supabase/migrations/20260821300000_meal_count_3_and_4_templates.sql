-- 3-meal and 4-meal versions of every region's meal_templates, derived
-- from the existing 5-meal templates (see check-uniform diagnostic: every
-- region shares an identical per-slot shape) rather than hand-authored, so
-- the numbers are traceable back to the 5-meal source. mealCount was already
-- a real request parameter on both engines (route.ts) but only mealCount=5
-- rows ever existed, so 3/4 silently 422'd -- this is what actually makes
-- the parameter work.
--
-- mealCount=4 drops mid_morning; mealCount=3 drops mid_morning AND evening.
-- Each dropped slot's kcal_share is redistributed proportionally across the
-- surviving slots (e.g. 4-meal: 0.22/0.26/0.19/0.26 / 0.93), so the week's
-- macro solve is unaffected by the redistribution -- only how the same
-- daily total is split across fewer, bigger meals changes.
--
-- fruit was made mid_morning-EXCLUSIVE by
-- 20260811120000_fruit_only_at_mid_morning.sql (a deliberate "one fruit
-- food, one meal, per day" dietitian rule) -- dropping mid_morning here
-- would otherwise leave fruit with zero eligible slots, the same
-- structurally-unplaceable-exchange-type bug documented for cereal/pulse in
-- CLAUDE.md's "breakfast and evening can never be structurally empty"
-- section. Re-homed to breakfast+evening for mealCount=4 and breakfast alone
-- for mealCount=3 -- restoring fruit's own pre-that-migration two-slot home
-- rather than inventing a new placement. allowed_exchange_types/min_items/
-- max_items are otherwise copied verbatim from the surviving slot's
-- mealCount=5 row -- a slot's own composition rules don't change just
-- because fewer meals exist that day.

insert into public.meal_templates (region, meal_count, slot, slot_order, time_hint, kcal_share, allowed_exchange_types, min_items, max_items)
values
  ('bengali', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('bengali', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('bengali', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('bengali', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('gujarati', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('gujarati', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('gujarati', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('gujarati', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('hyderabadi', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('hyderabadi', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('hyderabadi', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('hyderabadi', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('maharashtrian', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('maharashtrian', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('maharashtrian', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('maharashtrian', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('north_indian', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('north_indian', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('north_indian', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('north_indian', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('punjabi', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('punjabi', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('punjabi', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('punjabi', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('rajasthani', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('rajasthani', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('rajasthani', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('rajasthani', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('south_indian', 4, 'breakfast', 1, '7:30–9:00 AM', 0.24, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('south_indian', 4, 'lunch', 2, '1:00–2:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('south_indian', 4, 'evening', 3, '4:30–5:30 PM', 0.2, array['cereal','pulse','fruit'], 1, 3),
  ('south_indian', 4, 'dinner', 4, '8:00–9:00 PM', 0.28, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6);

insert into public.meal_templates (region, meal_count, slot, slot_order, time_hint, kcal_share, allowed_exchange_types, min_items, max_items)
values
  ('bengali', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('bengali', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('bengali', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('gujarati', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('gujarati', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('gujarati', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('hyderabadi', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('hyderabadi', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('hyderabadi', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('maharashtrian', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('maharashtrian', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('maharashtrian', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('north_indian', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('north_indian', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('north_indian', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('punjabi', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('punjabi', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('punjabi', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('rajasthani', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('rajasthani', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('rajasthani', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6),
  ('south_indian', 3, 'breakfast', 1, '7:30–9:00 AM', 0.3, array['cereal','meat','fat','sugar','pulse','fruit'], 2, 5),
  ('south_indian', 3, 'lunch', 2, '1:00–2:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_skim'], 3, 6),
  ('south_indian', 3, 'dinner', 3, '8:00–9:00 PM', 0.35, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow','milk_skim'], 3, 6);
