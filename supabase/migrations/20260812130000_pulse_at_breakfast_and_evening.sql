-- LEANR: dietitian correction — "we can't leave breakfast and evening
-- blank." Root cause: evening's allowed_exchange_types was ['cereal']
-- only, and vegetarian breakfast's real options were ['cereal', 'fat',
-- 'sugar'] (meat=0 for veg clients). cereal is a pure carbs residual
-- (exchange-solver.ts) that can legitimately solve to exactly 0 for a real
-- client target — confirmed not just on riya (Punjabi vegetarian) but on
-- Sneha (TEST-003, the eggetarian golden client), whose own CORRECT
-- solution is also cereal=0. Whenever that happens, evening had literally
-- nowhere to put anything, and breakfast degraded to a single "Ghee 15g"
-- line — not a real meal, regardless of diet type.
--
-- This was flagged, not fixed, in an earlier pass (see CLAUDE.md's
-- "2026-08-12 regional food expansion" section): several newly-added
-- besan-pancake / roasted-legume foods (Besan Cheela, Moong Dal Chilla,
-- Pesarattu, Bhuna Chana, Misal) already carry breakfast/evening in their
-- own foods.mealSlots as a genuine real-world occasion, but meal_templates
-- never allowed 'pulse' at either slot, so they were unreachable there —
-- the same "eligible by every other check, invisible because a higher
-- layer never asks for it" shape already fixed three times over for
-- Omelette/Paratha, Oats/Ghee, and Rajasthani lunch pulse.
--
-- A dietitian confirmed the fix: widen breakfast and evening to also
-- allow 'pulse', system-wide, every region — NOT a cereal floor (which
-- would re-break Sneha's genuine zero-cereal case, already tried and
-- rejected once this session for exactly that reason). Cereal solving to
-- 0 stays a legitimate answer; it just no longer leaves either slot with
-- nothing real to serve. Same array_append technique as every other
-- allowed_exchange_types migration this session.

update public.meal_templates
set allowed_exchange_types = array_append(allowed_exchange_types, 'pulse')
where slot in ('breakfast', 'evening') and not ('pulse' = any(allowed_exchange_types));
