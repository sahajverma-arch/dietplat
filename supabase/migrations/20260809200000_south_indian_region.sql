-- LEANR: adds the south_indian region (see README "How to add a region").
-- Structurally identical to north_indian/maharashtrian (same 5-slot shape,
-- kcal shares, allowed exchange types) — only the foods that fill each
-- slot differ, which is exactly the design the exchange system is built
-- for. Malayali food data added separately via src/db/seed-data/table41_foods.json.

insert into public.meal_templates (region, meal_count, slot, slot_order, time_hint, kcal_share, allowed_exchange_types, min_items, max_items)
values
  ('south_indian', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22,
    array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('south_indian', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07,
    array['fruit','milk_cow','fat'], 1, 2),
  ('south_indian', 5, 'lunch', 3, '1:00–2:00 PM', 0.26,
    array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('south_indian', 5, 'evening', 4, '4:30–5:30 PM', 0.19,
    array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('south_indian', 5, 'dinner', 5, '8:00–9:00 PM', 0.26,
    array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6)
on conflict (region, meal_count, slot) do nothing;
