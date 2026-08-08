-- LEANR: adds punjabi, gujarati, bengali, rajasthani, hyderabadi — the
-- remaining regions already listed in src/lib/foods/vocab.ts's REGIONS
-- enum but never seeded. Same structure as every other region (see
-- README "How to add a region"): identical 5-slot shape, kcal shares and
-- allowed exchange types; only the foods that fill each slot differ.

insert into public.meal_templates (region, meal_count, slot, slot_order, time_hint, kcal_share, allowed_exchange_types, min_items, max_items)
values
  ('punjabi', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22, array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('punjabi', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07, array['fruit','milk_cow','fat'], 1, 2),
  ('punjabi', 5, 'lunch', 3, '1:00–2:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('punjabi', 5, 'evening', 4, '4:30–5:30 PM', 0.19, array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('punjabi', 5, 'dinner', 5, '8:00–9:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6),

  ('gujarati', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22, array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('gujarati', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07, array['fruit','milk_cow','fat'], 1, 2),
  ('gujarati', 5, 'lunch', 3, '1:00–2:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('gujarati', 5, 'evening', 4, '4:30–5:30 PM', 0.19, array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('gujarati', 5, 'dinner', 5, '8:00–9:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6),

  ('bengali', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22, array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('bengali', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07, array['fruit','milk_cow','fat'], 1, 2),
  ('bengali', 5, 'lunch', 3, '1:00–2:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('bengali', 5, 'evening', 4, '4:30–5:30 PM', 0.19, array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('bengali', 5, 'dinner', 5, '8:00–9:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6),

  ('rajasthani', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22, array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('rajasthani', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07, array['fruit','milk_cow','fat'], 1, 2),
  ('rajasthani', 5, 'lunch', 3, '1:00–2:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('rajasthani', 5, 'evening', 4, '4:30–5:30 PM', 0.19, array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('rajasthani', 5, 'dinner', 5, '8:00–9:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6),

  ('hyderabadi', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22, array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('hyderabadi', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07, array['fruit','milk_cow','fat'], 1, 2),
  ('hyderabadi', 5, 'lunch', 3, '1:00–2:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('hyderabadi', 5, 'evening', 4, '4:30–5:30 PM', 0.19, array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('hyderabadi', 5, 'dinner', 5, '8:00–9:00 PM', 0.26, array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6)
on conflict (region, meal_count, slot) do nothing;
