-- LEANR: dietitian directive — shift milk_cow from breakfast to dinner,
-- system-wide (every region, every client), a single relocated 250 ml
-- serving, not an additional one.
--
-- milk_cow is INDIVISIBLE (meal-distributor.ts's INDIVISIBLE_TYPES) and
-- resolves to the EARLIEST allowed slot for the whole day's 1-exchange
-- total (MILK_COW_CAP, exchange-solver.ts). Before this migration,
-- breakfast/mid_morning/evening all nominally allowed milk_cow — with
-- slot_order breakfast(1) < mid_morning(2) < evening(4), milk always
-- resolved to breakfast specifically, never the other two, regardless of
-- what a generated plan's own guideline text implied. Making dinner the
-- SOLE allowed slot (removed from breakfast/mid_morning/evening, added to
-- dinner) is what actually relocates it there — leaving milk_cow allowed
-- at any earlier slot would have kept resolving to that earlier slot
-- instead, per the same "earliest allowed slot" rule that made breakfast
-- win before.
--
-- This reverses part of an earlier design note (see CLAUDE.md's "Milk,
-- vegetable portion caps" section, written when milk_skim was added at
-- lunch specifically: "dinner... stays free of any dairy exchange") —
-- that was correct for milk_skim (Raita/Chaach, still lunch-only,
-- unchanged by this migration) but is now explicitly superseded for
-- milk_cow by direct dietitian instruction. No conflict with meat_lean
-- anchoring permanently to dinner too (LAST_SLOT_INDIVISIBLE_TYPES) —
-- they're independent exchange types, each resolved within its own
-- needed-slots set; MEAT_CONFLICTING_TYPES only ever excluded pulse/
-- vegetable_a/vegetable_b from meat_lean's slot, never milk_cow.
--
-- milk_skim is untouched — still lunch-only (Raita/Chaach), unrelated to
-- this change.
--
-- meal_templates.allowed_exchange_types is only half of the eligibility
-- picture — eligible-foods.ts's own meal_slots filter is a second,
-- independent check against each FOOD's own meal_slots array, and none of
-- the three milk_cow foods (Milk, Milk Coffee, Masala Chai) had 'dinner'
-- in theirs. Without also widening these, milk_cow would have nothing
-- eligible to fill it at its new (and only) allowed slot at all —
-- NoEligibleFoodsError, caught empirically by actually regenerating a plan
-- after applying the meal_templates change above, not assumed. Widening
-- all three (not just plain Milk) rather than letting Milk Coffee/Masala
-- Chai become permanently unselectable dead foods — their exchange type
-- would never be needed at any slot they were still eligible for
-- otherwise, silently orphaning both foods added specifically for milk
-- variety.

update public.meal_templates
set allowed_exchange_types = array_remove(allowed_exchange_types, 'milk_cow')
where slot in ('breakfast', 'mid_morning', 'evening') and 'milk_cow' = any(allowed_exchange_types);

update public.meal_templates
set allowed_exchange_types = array_append(allowed_exchange_types, 'milk_cow')
where slot = 'dinner' and not ('milk_cow' = any(allowed_exchange_types));

update public.foods
set meal_slots = array_append(meal_slots, 'dinner')
where exchange_type = 'milk_cow' and not (meal_slots @> array['dinner']);
