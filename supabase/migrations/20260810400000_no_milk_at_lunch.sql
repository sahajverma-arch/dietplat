-- LEANR: hard rule, explicit dietitian instruction — milk_cow must never
-- be allocated to the lunch slot, for any region, any diet type.
--
-- This has to live in meal_templates.allowed_exchange_types, not as a
-- food-eligibility filter: the exchange solver + meal distributor decide
-- HOW MANY milk_cow exchanges go into each slot before any specific food
-- is ever chosen (see exchange-solver.ts / meal-distributor.ts, both
-- unchanged by this migration). If milk_cow stayed in lunch's allowed
-- list while foods.ts filtered out every milk_cow food there instead, the
-- solver would still allocate a milk_cow exchange to lunch with nothing
-- left eligible to fill it — a NoEligibleFoodsError, not a clean fix.
-- Removing it here means the solver never considers lunch for milk_cow in
-- the first place; the same daily total simply redistributes across the
-- OTHER slots that still allow it (breakfast, mid_morning, evening,
-- bedtime, weighted by their own kcal_share) — the day's total kcal and
-- macros are unaffected, only which slot the milk exchange lands in.
--
-- dinner already excludes milk_cow (unchanged since
-- 20260808200000_classic_table41_exchange_system.sql) — this migration
-- only touches lunch, the one slot that still had it.

update public.meal_templates
set allowed_exchange_types = array_remove(allowed_exchange_types, 'milk_cow')
where slot = 'lunch';
