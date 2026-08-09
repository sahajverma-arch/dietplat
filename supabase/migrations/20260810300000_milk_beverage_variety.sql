-- LEANR: milk_cow had exactly ONE food in the whole database ("Milk"),
-- and milk_cow is an allowed exchange type at breakfast, mid_morning,
-- lunch, evening AND bedtime for every region — so it was structurally
-- forced into the plan multiple times a day, every day, with zero
-- possible variation (there was nothing else to rotate to). This was
-- already flagged as a known gap in this project's own architecture
-- audit ("Phase 0: expand thin exchange-type food pools, milk_cow
-- especially").
--
-- Adds two real alternatives — Milk Coffee and Masala Chai — so the
-- EXISTING rotation logic (fallback selector's stableHash rotation, the
-- LLM's "prefer variety" instruction) has something to actually rotate
-- through. No code change needed: this is purely a food-data gap, same
-- category of fix as every other region/food addition in this project.
--
-- Scoped to breakfast/mid_morning/evening only (not lunch/bedtime) —
-- coffee/chai are natural there; a dietitian would not prescribe a cup of
-- coffee as part of a lunch thali or a bedtime wind-down, so plain Milk
-- stays the only option for those two slots, unchanged.
--
-- Deliberately kept at the SAME exchange_units/serving_raw_g ratio as
-- Milk (250 ml = 1 exchange), not a smaller "typical cup" amount: the
-- exchange system's macros come from a fixed Table 4.1 lookup by exchange
-- type, not from the food's own serving size — inventing a different
-- ratio (e.g. 200 ml = 1 exchange) would make the displayed quantity
-- nutritionally dishonest, showing "200 ml" while actually delivering
-- 250 ml worth of protein/fat. Real slots almost never call for a full
-- 1.0 exchange (the existing generated plans mostly show 0.5), so in
-- practice this already renders close to a normal cup size.

insert into public.foods (name_en, exchange_type, exchange_units, serving_raw_g, household_measure, regions, diet_types, meal_slots, allergens, notes)
values
  ('Milk Coffee', 'milk_cow', 1, 250, '1 large cup (250 ml milk basis)',
    array['generic'], array['vegetarian','eggetarian','non_vegetarian','jain'],
    array['breakfast','mid_morning','evening'], array['dairy'],
    'Same milk_cow exchange as plain Milk (250 ml/1 exchange) — a coffee-based way to take the same milk portion, added for rotation variety.'),
  ('Masala Chai', 'milk_cow', 1, 250, '1 large cup (250 ml milk basis)',
    array['generic'], array['vegetarian','eggetarian','non_vegetarian','jain'],
    array['breakfast','mid_morning','evening'], array['dairy'],
    'Same milk_cow exchange as plain Milk (250 ml/1 exchange) — a tea-based way to take the same milk portion, added for rotation variety.')
on conflict do nothing;
