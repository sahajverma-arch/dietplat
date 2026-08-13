-- LEANR: dietitian directive — curd should be served "generally in lunch
-- and dinner," not breakfast. milk_skim (curd) was allowed at breakfast
-- since the original exchange_types/meal_templates design (back when
-- breakfast's own milk_skim slot mattered little — milk_cow covered
-- breakfast dairy, and milk_skim's only real foods were Raita/Chaach,
-- lunch-only anyway). Now that milk_cow defaults to 0 (exchange-solver.ts's
-- MILK_COW_CAP) and curd is the day's primary dairy exchange, leaving
-- breakfast eligible let the solver's earliest-allowed-slot indivisible
-- routing (meal-distributor.ts, before this same change removed milk_skim
-- from that list) put the WHOLE day's curd at breakfast — confirmed on a
-- real generated plan. Removing milk_skim from breakfast here, alongside
-- meal-distributor.ts no longer treating milk_skim as indivisible, means
-- the day's curd now genuinely proportions across lunch and dinner instead.
--
-- Same technique as 20260810400000_no_milk_at_lunch.sql and
-- 20260811040000_shift_milk_cow_to_dinner.sql: array_remove, not a
-- from-scratch rewrite, scoped to every region uniformly.

update public.meal_templates
set allowed_exchange_types = array_remove(allowed_exchange_types, 'milk_skim')
where slot = 'breakfast';
