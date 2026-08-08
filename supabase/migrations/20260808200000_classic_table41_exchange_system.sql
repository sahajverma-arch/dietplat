-- LEANR: replace the 12-group Fitelo exchange list with the classic
-- Table 4.1 (Comprehensive Food Exchange List, Indian modified American
-- exchange list). Verified against three real generated diet plans
-- (Deepak Sharma, Anjali Joshi) — both explicitly cite "Table 4.1" and
-- their arithmetic proves the classic 11-row system (20 g/cereal exchange,
-- 250 ml/milk exchange, Vegetable A/B split), not the 12-group system.
-- See CLAUDE.md "The exchange system".
--
-- foods and meal_templates are re-seeded from scratch (see
-- src/db/seed-foods.ts and the meal_templates insert below) since the old
-- rows reference exchange_type codes that no longer exist.

delete from public.foods;
delete from public.meal_templates;
delete from public.exchange_types;

insert into public.exchange_types (code, label, sort_order, protein_g, carbs_g, fat_g, fiber_g, standard_serving, notes)
values
  ('milk_cow',    'Milk (Cow)',    1, 8, 12,   10,  0, '1 C (250 ml)',    null),
  ('milk_skim',   'Skim Milk',     2, 8, 14.7, 0,   0, '1 1/3 C (320 ml)', null),
  ('meat',        'Meat',          3, 7, 0,    6,   0, '2 pcs / 1 egg (40 g)', null),
  ('meat_lean',   'Lean Meat',     4, 7, 0,    0.5, 0, '2 pcs (35 g)',    null),
  ('pulse',       'Pulse',         5, 7, 17,   0,   0, '3 T (30 g raw)',  null),
  ('cereal',      'Cereal/Starch', 6, 2, 15,   0,   0, '3 T (20 g raw)',  null),
  ('vegetable_a', 'Vegetable A',   7, 1, 3.5,  0,   0, '1/2 C (100 g)',   'Two Vegetable A exchanges = one Vegetable B exchange.'),
  ('vegetable_b', 'Vegetable B',   8, 2, 7,    0,   0, '50 g',            null),
  ('fruit',       'Fruit',         9, 0, 10,   0,   0, '1 portion',       'Raw amount is variable — lives on the individual food row, not this exchange.'),
  ('fat',         'Fat',          10, 0, 0,    5,   0, '1 t (5 g)',       null),
  ('sugar',       'Sugar',        11, 0, 5,    0,   0, '1 t (5 g)',       null)
;

-- 5-meal north_indian template, unchanged shape from the original seed,
-- codes updated to the classic exchange types.
insert into public.meal_templates (region, meal_count, slot, slot_order, time_hint, kcal_share, allowed_exchange_types, min_items, max_items)
values
  ('north_indian', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22,
    array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('north_indian', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07,
    array['fruit','milk_cow','fat'], 1, 2),
  ('north_indian', 5, 'lunch', 3, '1:00–2:00 PM', 0.26,
    array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('north_indian', 5, 'evening', 4, '4:30–5:30 PM', 0.19,
    array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('north_indian', 5, 'dinner', 5, '8:00–9:00 PM', 0.26,
    array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6),
  ('maharashtrian', 5, 'breakfast', 1, '7:30–9:00 AM', 0.22,
    array['cereal','milk_cow','milk_skim','meat','fruit','fat','sugar'], 2, 5),
  ('maharashtrian', 5, 'mid_morning', 2, '10:30–11:30 AM', 0.07,
    array['fruit','milk_cow','fat'], 1, 2),
  ('maharashtrian', 5, 'lunch', 3, '1:00–2:00 PM', 0.26,
    array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat','milk_cow'], 3, 6),
  ('maharashtrian', 5, 'evening', 4, '4:30–5:30 PM', 0.19,
    array['fruit','fat','milk_cow','cereal'], 1, 3),
  ('maharashtrian', 5, 'dinner', 5, '8:00–9:00 PM', 0.26,
    array['cereal','pulse','vegetable_a','vegetable_b','meat','meat_lean','fat'], 3, 6)
on conflict (region, meal_count, slot) do nothing;
