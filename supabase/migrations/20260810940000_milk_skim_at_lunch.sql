-- LEANR: dietitian directive — milk_cow is now capped at 1 exchange (250 ml)
-- per day for every diet type (see exchange-solver.ts's MILK_COW_CAP), down
-- from up to 2. Whatever dairy macro that cap leaves uncovered is now
-- absorbed by milk_skim instead (see the same file's milk_skim search),
-- plated as Raita or Chaach — never a second glass of milk, and never at
-- breakfast/dinner, since "people only take raita or chaach at lunch."
--
-- milk_skim was never an allowed exchange type at lunch in any region (it
-- wasn't even searched by the solver until this same change — see
-- exchange-solver.ts), so this adds it there, uniformly across every
-- region, mirroring how 20260810400000_no_milk_at_lunch.sql scoped its own
-- milk_cow removal the same way (all regions, `where slot = 'lunch'`).
-- dinner and every other slot are untouched: dinner is meat_lean's fixed
-- slot now (see meal-distributor.ts) and stays free of any dairy exchange.

update public.meal_templates
set allowed_exchange_types = array_append(allowed_exchange_types, 'milk_skim')
where slot = 'lunch' and not ('milk_skim' = any(allowed_exchange_types));
