-- LEANR: dietitian directive — milk_cow is no longer served at all
-- (exchange-solver.ts's MILK_COW_CAP is now 0 for every diet type, down from
-- a fixed 1 exchange/day). Curd (milk_skim) is the default dairy exchange
-- instead, guaranteed present via the new MILK_SKIM_FLOOR, and it should be
-- served "generally in lunch and dinner" per the same directive — not
-- concentrated into a single meal.
--
-- milk_skim was only ever allowed at lunch (20260810940000_milk_skim_at_
-- lunch.sql, back when it just absorbed whatever milk_cow's old 1-exchange
-- cap left uncovered) and never at dinner, since dinner was meat_lean's
-- fixed slot and stayed free of any dairy exchange. That reasoning no longer
-- holds now that milk_skim is the day's ONLY dairy exchange rather than an
-- overflow — this adds it to dinner too, uniformly across every region,
-- mirroring how the lunch migration itself scoped its own addition (all
-- regions, `where slot = 'dinner'`). meat_lean's own anchoring to dinner is
-- untouched; the two exchange types simply now coexist there.

update public.meal_templates
set allowed_exchange_types = array_append(allowed_exchange_types, 'milk_skim')
where slot = 'dinner' and not ('milk_skim' = any(allowed_exchange_types));
