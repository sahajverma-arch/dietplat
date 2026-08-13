-- LEANR: dietitian hard rule — a client should see exactly ONE fruit food,
-- in exactly ONE meal, per day (mid_morning), never a second, different
-- fruit alongside it and never fruit appearing again in a different meal
-- that same day. Confirmed as a real bug on a generated plan: fruit was
-- allowed at breakfast, mid_morning, AND evening (allowed_exchange_types),
-- so distributeMeals() proportionally split the day's fruit exchanges
-- across all three, then food-selector-fallback.ts's own 2-item fruit split
-- (for a slot needing 2+ exchanges) put two DIFFERENT fruits at breakfast on
-- top of that — a client saw fruit three separate times in one day (Apple +
-- Papaya at breakfast, Guava at mid_morning, Papaya again at evening).
--
-- mid_morning already got its own "never split within the slot" fix
-- earlier this session (food-selector-fallback.ts's NO_FRUIT_SPLIT_SLOTS) —
-- that fix alone wasn't sufficient because it only stopped the WITHIN-SLOT
-- split, not fruit ALSO appearing in breakfast/evening. This migration
-- removes 'fruit' from breakfast's and evening's allowed_exchange_types,
-- leaving mid_morning as the sole fruit-eligible slot system-wide — the
-- solver's existing proportional split then trivially puts 100% of the
-- day's fruit there, and the earlier NO_FRUIT_SPLIT_SLOTS fix ensures it
-- lands as ONE food, not two. See format-item.ts's fruit-count display fix
-- (same session) for why a consolidated, larger fruit count now needs to
-- show its real exchange count instead of a silent "1 medium" regardless
-- of quantity.
--
-- Same array_remove technique as 20260810400000_no_milk_at_lunch.sql /
-- 20260811040000_shift_milk_cow_to_dinner.sql / 20260811110000_remove_milk_
-- skim_from_breakfast.sql, scoped to every region uniformly.

update public.meal_templates
set allowed_exchange_types = array_remove(allowed_exchange_types, 'fruit')
where slot in ('breakfast', 'evening');
