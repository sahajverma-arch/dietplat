# LEANR — Diet Platform

Internal dietitian tool for Fitelo. Staff-only. Counselling intake → deterministic roadmap → exchange-list diet plan.

## Stack
- Next.js 14 App Router + TypeScript (strict). Server Actions for mutations, Route Handlers for anything the AI touches.
- Supabase: Postgres + Auth (Google OAuth) + RLS. Drizzle ORM. No Prisma.
- Vercel deploy. Node runtime for AI routes (not edge — long timeouts needed).
- NVIDIA NIM for LLM calls, OpenAI-compatible: `baseURL: https://integrate.api.nvidia.com/v1`, key `NVIDIA_API_KEY`, model from `NVIDIA_MODEL` env var.
- Tailwind + shadcn/ui. No component library beyond that.

## THE ONE RULE THAT MATTERS

**The LLM never calculates nutrition. The LLM never sees a calorie or macro target.**

Numbers come from two deterministic places only:
1. `src/lib/counselling/` — energy, BMI, roadmap, macros, protein ramp. Pure functions, zero I/O, zero randomness.
2. `src/lib/plan/exchange-solver.ts` — converts week targets into integer/half-integer exchange counts using Table 4.1 constants.

The LLM does exactly one job: **given a list of exchange slots and a filtered list of eligible foods, pick which named food fills each slot.** It returns food IDs. Nothing else. Macros are then recomputed from exchange counts × Table 4.1 and validated.

If you ever find yourself writing a prompt that asks a model to "calculate calories", "estimate macros", or "make sure it adds up to 1775 kcal" — stop. That is the bug this architecture exists to prevent.

## The exchange system

`exchange_types` (11 rows, read-only at runtime) is the classic textbook Table 4.1 — the
Comprehensive Food Exchange List (Indian modified American exchange list):

`milk_cow · milk_skim · meat · meat_lean · pulse · cereal · vegetable_a · vegetable_b · fruit ·
fat · sugar`

This was briefly swapped for the sister `dietitian-platform` codebase's richer 12-group exchange
list during Prompt 3, on the theory that its "production-validated" data was more authoritative.
That was wrong — verified by reading three real generated diet plans (Deepak Sharma, Anjali Joshi,
Ritu Verma). Deepak's and Anjali's plans both explicitly cite "Table 4.1" and their arithmetic
proves it: `Roti (atta 100 g raw, 5 rotis)` = 5 cereal exchanges at 20 g each (not the 12-group
system's 30 g/roti), `Milk (250 ml)` = 1 exact milk_cow exchange, and the guidelines list swap
groups as "Vegetable A (100 g)" / "Vegetable B (50 g)" — a split the 12-group system doesn't have
at all. Ritu Verma's plan is a different, superseded architecture entirely (INDB/USDA
portion-matched, not exchange-solved — the sister codebase's own
`0017_remove_indb_usda_foods.sql` deleted that pipeline). Reverted to Table 4.1 for good.

Each exchange type carries protein_g/carbs_g/fat_g/fiber_g per 1 exchange; kcal is always
*computed* as `protein_g*4 + carbs_g*4 + fat_g*9`, never stored/sourced independently, so it can
never drift from the macros it summarises (this generated-kcal figure sits a few kcal off Table
4.1's own printed values in a couple of rows — e.g. fruit computes to 40 kcal against the table's
45 — an artifact of the textbook's own rounding, not a bug). Two Vegetable A exchanges = one
Vegetable B exchange. Eggs and lean meat/fish map onto the `meat` (1 whole egg = 1 exchange, 40 g)
and `meat_lean` (35 g chicken/fish = 1 exchange) types respectively — confirmed against Deepak's
plan's own non-veg swap line ("1 whole egg or 35 g chicken breast / fish").

Food *display names* vary by region even when the underlying exchange is identical — Anjali's
Maharashtrian plan calls the same wheat-flour cereal exchange "Poli" instead of "Roti", ghee is
"Toop", peanuts are "Shengdana", dal is "Varan/Amti/Usal" depending on prep, sabzi is "Bhaji". The
`foods` table carries region-specific alias rows for these (same exchange arithmetic, different
`name_en`) rather than a separate name-translation layer.

### Non-veg/eggetarian floors and indivisible exchanges

`exchange-solver.ts`'s `anchorVariantTiers()` originally let a non-vegetarian or eggetarian target
solve to **zero** eggs/meat whenever a milk-and-pulse-only combination fit the macro target as
well or better — "non-vegetarian" only meant meat/meat_lean were *permitted*, never *required*
(`cost()` only ever minimises macro deviation, with no preference for actually including animal
protein). Fixed by excluding the all-zero `{meat: 0, meat_lean: 0}` anchor from non-vegetarian's
candidate list, and the `meat: 0` anchor from eggetarian's, so the cost search can no longer land
on an animal-protein-free result — the same "hard floor" treatment vegan already got
(`VEGAN_PULSE_FLOOR`) and vegetarian already got (`meat: 0` unconditionally), just enforced from
the other direction.

A second pass raised the egg quantity from 1 to 2 (one `meat` exchange is one whole egg at ~40 g
raw, Table 4.1 — too small a serving to plate alone), and separately made non-vegetarian targets
prefer **real** meat (`meat_lean`, chicken/fish) over eggs — "non-vegetarian" already has
"eggetarian" as its own diet type for egg-only clients, so a non-vegetarian plan defaulting to
eggs-only defeats that distinction. Both are implemented as ordered **variant tiers**
(`anchorVariantTiers()`): `solveExchanges()` tries each tier's full search in order (base floors,
then widened floors) and returns the first that clears the 1.5% tolerance, only relaxing to a
looser tier when a stricter one can't fit the target.

- **eggetarian**: tier 0 requires 2 eggs; tier 1 allows a single egg — needed for Sneha (TEST-003)
  and Aadi (TEST-004), both golden worked examples, whose real targets push 2 eggs' fat to
  ~1.6–2.1% deviation, over tolerance.
- **non_vegetarian**: tier 0 requires 2 `meat_lean` exchanges (real chicken/fish, ~70 g), eggs
  optional; tier 1 drops that requirement back to "some egg or meat_lean, 0-2, never both zero"
  (the original floor, before real meat was preferred); tier 2 is the last-resort single-egg
  escape hatch. Verified against Rahul
  (TEST-002)'s real target, which lands exactly on tier 0 (2 eggs *and* 2 meat_lean, 0% deviation
  on every macro) — but tier 0 can still narrowly miss on a specific target purely from Table
  4.1's coarse 2.5 g fat-exchange grid (confirmed on a constructed case: `meat_lean=2`'s fixed 1 g
  fat shifts the remaining fat need off-grid enough to land at 1.66% deviation, just over
  tolerance), in which case it falls through to tier 1 like any other infeasible tier — an honest,
  non-silent fallback, not a bug.

Diet types with only one tier (vegetarian/jain/vegan) just run that tier once.

Getting the exchange *count* right upstream doesn't help if `meal-distributor.ts` then fractures
it across meals. The distributor proportionally splits every exchange type across all its allowed
meal slots by `kcal_share` — correct for continuously divisible foods (rice, dal, vegetables,
fruit, fat) but wrong for `meat`/`meat_lean` (a whole egg, a whole chicken/fish serving isn't a
fraction of a serving) and `milk_cow`/`milk_skim` (conventionally drunk in one sitting, not as a
125 ml glass at breakfast plus another 125 ml folded into evening chai). These four exchange types
are **indivisible**: the full day's count for each goes to a single meal slot — the earliest
`slot_order` that allows it — instead of being proportioned across every allowed one.

A meal built around `meat`/`meat_lean` also shouldn't carry `pulse` or `vegetable_a`/`vegetable_b`
alongside it — a non-veg dish is conventionally its own protein-and-side course, not an addition
to a dal-and-sabzi one. `meal-distributor.ts` resolves `meat`/`meat_lean` first (their field order
in `ZERO_COUNTS`, which `Object.keys(counts)` follows, puts them ahead of
`pulse`/`vegetable_a`/`vegetable_b` in the loop), then excludes whichever slot they landed in from
those three types' own apportionment — unless doing so would leave a type with nowhere to go, in
which case the exclusion is skipped rather than throwing. `cereal` and `fat` stay unrestricted (a
meat dish is still typically cooked in oil and served with a staple).

The "earliest allowed slot" rule above was originally day-invariant by construction —
`distributeMeals()` runs once for the whole week, not once per day, so `meat_lean` structurally
resolved to the same slot (lunch) every single day, all week, every week. A first fix
(`nonveg-slot-rotation.ts`'s `rotateNonVegSlot()`, **since removed**) relabelled the `lunch`↔`dinner`
pairing for a `stableHash`-selected ~half of the week's days, as a pure post-selection swap of both
the meal content and the archetype pairing together.

A dietitian directive replaced that mechanism entirely: real non-veg dishes (chicken/fish) belong
at dinner, always — never lunch, and never rotating between the two. Variety wasn't actually the
goal; a stable, predictable day structure was (lunch is always the vegetarian-style meal — cereal,
dal, sabzi; dinner is always the protein-and-side course). `meal-distributor.ts`'s
`LAST_SLOT_INDIVISIBLE_TYPES` now anchors `meat_lean` to the **last** allowed slot (dinner)
directly, instead of the first. `meat` (a whole egg) is unaffected — still the first allowed slot
(breakfast) — since eggs-for-breakfast was never part of this directive, only real
chicken/fish dishes. `nonveg-slot-rotation.ts` and its test file are gone; there is nothing left to
rotate.

`POST /api/plan/generate`'s DB-write loop derives `diet_plan_meals.slot_order` by looking up the
meal's `slot` name against `templates` (the real meal-template metadata) rather than trusting
`day.meals`'s array position — that array's order matches `slot_order` only incidentally (it falls
out of `Object.entries(skeleton)` at generation time, not a real ordering guarantee). This predates
and outlives the rotation mechanism above (which is what originally surfaced the gap, by relabelling
a meal's `slot` without moving it in the array) and stays in place as a defensive habit even now
that nothing relabels a meal's `slot` after generation.

### Milk, vegetable portion caps, and the one-dish-per-meal rule

Two more real dietitian constraints, both about what a single plated dish should actually look
like, not about the exchange math (which is untouched — only *which* combination of exchanges hits
the same target changes):

**Milk (`MILK_COW_CAP`, `exchange-solver.ts`)**: `milk_cow` is now fixed at exactly 1 exchange
(250 ml — Table 4.1's own standard serving) for *every* diet type, never 2. It was previously fixed
at 2 for vegetarian/eggetarian and searched `[1, 2]` for non_vegetarian; `milk_cow` being
**indivisible** (see above) meant a solved count of 2 put the *whole day's* milk in one glass at
breakfast — an unservable 500 ml pour. `milk_skim` (previously never used by the solver at all —
always 0) is now a real searched variable, so whatever dairy macro the capped `milk_cow` no longer
covers gets picked up there instead, plated as **Raita** or **Chaach** (`table41_foods.json`,
`milk_skim`, 200 g / 200 ml per exchange — deliberately *not* the 320 g/exchange every other
`milk_skim` food uses, since a thicker curd-based preparation is more calorie-dense per gram; a
dietitian-specified figure, not inferred) at **lunch only** — "people only take raita or chaach at
lunch," never breakfast or dinner. `milk_skim` was never an allowed exchange type at lunch in any
region until `20260810940000_milk_skim_at_lunch.sql` added it there, uniformly, the same way
`20260810400000_no_milk_at_lunch.sql` removed `milk_cow` from lunch earlier.

**Vegetable_a ceiling (`NON_VEGETARIAN_VEGETABLE_A_CAP`, `exchange-solver.ts`)**: `meat_lean`
anchoring permanently to dinner (above) means dinner *never* carries `vegetable_a`/`vegetable_b`
(the existing `MEAT_CONFLICTING_TYPES` exclusion), so for a non-vegetarian client, lunch is the
*only* slot that can ever hold a cooked vegetable — every single day, not just some. The textbook
4-exchange floor (400 g, and up to 6 on the solver's widened retry tier — see `attemptTier()`)
doesn't fit a single realistic ~200 g dish there. A dietitian confirmed capping `vegetable_a` at
exactly 2 exchanges (200 g) for `non_vegetarian` specifically is clinically fine, and that the
resulting carb shortfall should just be absorbed by more cereal — which needed no new code: cereal
is *already* solved as a residual against the exact carbs target, after every other exchange type
is chosen, so tightening `vegetable_a`'s ceiling automatically pulls in more rice/roti to
compensate. Every other diet type keeps the original 4-exchange floor (widened up to 8 across
`attemptTier()`'s base/widened pair) — they still split `vegetable_a` naturally across both lunch
*and* dinner, so nothing concentrates for them.

Two earlier attempts at this specific fix were tried and rejected before landing on the solver-level
cap above — worth recording so nobody re-tries them: (1) splitting the oversized single dish into
2+ *different* foods of the *same* exchange type within one meal (a `MAX_SINGLE_FOOD_RAW_G`-style
mechanism, briefly implemented and fully reverted) traded "one huge dish" for "two dishes in one
meal," which a dietitian ruled out categorically — a meal may never carry two separate
cooked-vegetable dishes, regardless of size. (2) Allowing `vegetable_a`/`vegetable_b` into the
meat_lean slot too (undoing part of `MEAT_CONFLICTING_TYPES`) was also rejected — non-veg meals
stay vegetable-free, full stop.

**vegetable_a + vegetable_b co-occurrence (`food-selector-fallback.ts`,
`curatedVegetableFamilyPairs`)**: a second, independent source of the same "two dishes in one meal"
symptom, unrelated to the cap above — whenever `vegetable_a` and a *non-salad-tagged* `vegetable_b`
food both land in the same slot (routine on any diet type, not just non-vegetarian) without forming
a genuine named dish (Aloo Gobi, Aloo Baingan, Tinda Aloo, Aloo Methi) or landing on the week's one
designated `isMixedVegDay` (see "Vegetable dish naming" below), `vegetable-dish-naming.ts` already
split an uncurated pairing back into two separately-labelled dishes at *display* time — which is
exactly the outcome being avoided, just arrived at from a different pairing (cross-type, not
same-type). Fixed at *selection* time instead: `route.ts` now loads `vegetable_dish_combinations` +
`vegetable_dish_combination_members` *before* calling `selectFoods` (previously this data was only
ever loaded at display time, in `plan-view-model.ts` — too late for the selector to use), reduces
it to a `Set` of sorted `dishFamilyId` pairs, and passes it through `FoodSelectorInput` as
`curatedVegetableFamilyPairs`. When resolving `vegetable_b` for a slot that already has
`vegetable_a`, the fallback selector restricts its pool to salad-tagged foods (Carrot, Onion,
Beetroot, Radish — always rendered as a separate "Salad" line, never a competing sabzi) *unless* a
candidate's `dishFamilyId` forms a genuine curated pair with that day's chosen `vegetable_a` food,
in which case the real named-dish pairing (e.g. Potato + Cauliflower → "Aloo Gobi") is preserved.
This is a pool restriction, not a fabricated macro or a hidden quantity — whichever salad-tagged
food wins the rotation is a real, honestly-labelled food actually served. Degrades to the
unfiltered pool (same graceful pattern as `PROTEIN_EXCHANGE_TYPES`'s same-day exclusion) only if no
salad-tagged or curated-matching food is eligible at all — an edge case this project's seeded data
doesn't currently produce, since most regions' `vegetable_b` pools are majority salad-tagged.

### Vegetable dish naming — salad vs. sabzi

`meal-composition.ts`'s `composeMealDisplay()` used to pool every `vegetable_a` + `vegetable_b`
item in a slot into one generic "Mixed Vegetable {RegionWord}" the moment there were 2+ — with no
culinary logic at all, so e.g. Beetroot could land in the same dish as Capsicum/Tomato/Onion/
Potato. A curated name (`vegetable-dish-naming.ts`, matching against `vegetable_dish_combinations`)
only ever covered the exact-set case, and only 2 such rows exist system-wide (Avial, Aloo Gobi) —
so almost every multi-vegetable day fell through to the generic label.

Fixed at the `foods.tags` level: a `"salad"` tag (Cucumber, Onion, Beetroot, Radish, Carrot — see
`table41_foods.json`) pulls a food out of the cooked-sabzi pool into its own separate "Salad" line,
built by `composeMealDisplay()` before the general pooling runs. A food's existing `seasons` tag
already governs *when* it's eligible at all, so a winter-only salad food (Radish, Carrot) is only
ever grouped as salad during the season it can appear in — no separate season-conditional salad
logic was needed, the two tags compose for free. This can now produce up to two `mixed_dish`
vegetable groups in one meal (sabzi + salad); `vegetable-dish-naming.ts`'s `applyVegetableDishNames`
was updated to check every such group independently rather than assuming at most one — the salad
group is expected to never match a curated combo (its foods carry no `dish_family_id` by design;
curated naming is for cooked combos like Aloo Gobi) and keeps its generic "Salad (...)" label,
which now falls out correctly regardless of which group happens to appear first.

`food-selector-fallback.ts`'s `SPLITTABLE_TYPES` used to include `vegetable_a`/`vegetable_b`,
forcing a 2+-exchange slot to split into 2 arbitrary DIFFERENT foods of that type (e.g. Cabbage +
Capsicum) — combined with meal-composition.ts's pooling, this meant "Mixed Vegetable Sabzi" was
close to the everyday default rather than the exception. Reverted: real everyday Indian sabzi is
overwhelmingly single-vegetable (Lauki Sabzi, Karela Sabzi, Bhindi Masala — confirmed via web
research), and a genuine 2-vegetable dish almost always means a specific named "Aloo + X" pairing
(Aloo Gobi, Aloo Baingan, Tinda Aloo, Aloo Methi), not two unrelated vegetable_a foods thrown
together. `vegetable_a`/`vegetable_b` now each resolve to ONE food per slot (like every other
non-splittable exchange type) — `fruit` keeps its 2-item split, that part of the original Deepak/
Anjali-grounded observation stands. This naturally produces mostly single-vegetable sabzi (or
single-vegetable + salad, once the salad-tagged `vegetable_b` item is pulled into its own line) —
a 2-item cooked pool only forms on the days `vegetable_b`'s rotation lands on Potato, which is
exactly when the newly-seeded Aloo Gobi/Aloo Baingan/Tinda Aloo/Aloo Methi combos (see
`20260810930000_more_vegetable_dish_combinations.sql`) can name it properly instead of falling
through to the generic label.

One side effect of the reversal above, caught by inspecting a real generated PDF: `vegetable_a`
resolving to one food per slot combines badly with `meal-distributor.ts`'s `MEAT_CONFLICTING_TYPES`
exclusion — on a non-vegetarian day, that exclusion routes pulse/vegetable_a/vegetable_b away from
whichever slot has meat/meat_lean, so the day's ENTIRE vegetable_a allocation (Table 4.1's own
floor: 4 exchanges/day) lands in the other slot alone — a 400 g single-vegetable dish, double the
~200 g a slot normally gets when no such exclusion applies. A first fix (`LARGE_PORTION_SPLIT`,
now removed) re-enabled a 2-food split once a slot's count cleared a threshold — this fixed the
oversized-single-dish *portion size* but not "mix veg" *frequency*: the concentration happens on
literally every non-vegetarian day (every such day has meat/meat_lean somewhere), so a count-based
threshold meant "mixed veg" itself showed up nearly every day too, just at realistic per-item sizes
instead of one huge one. Wrong layer to fix it at — the count threshold answers "is this dish too
big", not "should today be a mixed-veg day at all", and those are different questions.

That portion-*size* half of the problem stayed genuinely unsolved at the time this paragraph was
first written — `isMixedVegDay` below only ever fixed the *frequency* of the generic "Mixed
Vegetable" label, never the underlying 400 g concentration. It was finally fixed properly later,
one layer up: see "Milk, vegetable portion caps, and the one-dish-per-meal rule" above
(`NON_VEGETARIAN_VEGETABLE_A_CAP`, `meat_lean` anchored permanently to dinner). The two mechanisms
now operate on genuinely orthogonal axes — `isMixedVegDay` still decides which ~1-in-7 day is
allowed to show the generic multi-vegetable label at all; the portion cap independently guarantees
every day's single-vegetable dish stays within a realistic ~200 g regardless of which day that is.

Replaced with `mixed-veg-day.ts`'s `isMixedVegDay(rotationDay)`: a `stableHash`-gated function that
picks exactly ONE day per 7-day week block (`rotationDay % 7 === stableHash("mixed_veg_day",
weekBlock) % 7`), not an independent per-day coin flip — hashing each day on its own (the actual
first version of this function) can and did collide, producing 3+ "mixed veg" days in a single real
week, since 7 independent draws landing on residue 0 isn't the same as "exactly one of the 7 is
selected". `rotationDay` (`dayIndex + (weekNumber - 1) * 7`) is always a multiple-of-7-aligned
window, so every week's 7 days fall inside one block, and the specific weekday still varies week to
week since the hash input changes with the block. Shared between two call sites that both need the
exact same answer for a given day or they'd disagree about which day is "the" mixed-veg day:
- `food-selector-fallback.ts`'s `MIXED_VEG_TYPES` combo pool — gates whether 2 arbitrary
  `vegetable_a` foods combine at *selection* time. `SOLO_ONLY_TAG` foods (Karela, Lauki, Brinjal,
  Tori, and regional aliases — see `table41_foods.json`) are filtered out of this pool entirely,
  even on the designated day: these are real, always-solo dishes (Karela Sabzi, Baingan Bharta),
  never randomly combined with an unrelated vegetable in practice. They can still appear alone (any
  day, any count) and still pair with `vegetable_b` for a curated combo (Aloo Baingan) — a different
  mechanism (two distinct exchange types naturally co-occurring in a slot), not this same-type pool.
- `vegetable-dish-naming.ts`'s `applyVegetableDishNames` — gates a *second*, independent source of
  the same symptom that the selection-time fix alone didn't touch: `meal-composition.ts` pools a
  single `vegetable_a` food with a single `vegetable_b` food into one combined sabzi group whenever
  neither is salad-tagged, regardless of whether `vegetable_a` itself ever split. When that pairing
  doesn't match a curated `vegetable_dish_combinations` row (Aloo Gobi, Aloo Baingan, Tinda Aloo,
  Aloo Methi, Avial), it used to fall straight through to the generic "Mixed Vegetable {word}" label
  — with no day-gating at all, this alone put "Mixed Vegetable Sabzi" on 3-4 of 7 days in a real
  generated plan even after the selection-time fix. `applyVegetableDishNames` now takes an
  `allowGenericMixedVeg` boolean (the caller's `isMixedVegDay(rotationDay)`); when false, an
  uncurated generic group is split back into N separate `single_dish` entries (one per food, each
  named `"{Food} {word}"`, the word recovered from the generic label itself) instead of merging.
  A curated match always wins over this gate — Aloo Gobi is a real named dish and can show on any
  day, not just the designated one; only the *uncurated* fallthrough is day-limited. Call sites
  (`composed-meal-cell.tsx`, `plan-pdf-document.tsx`) compute `rotationDay` the same way route.ts
  computes `dayIndexOffset` (`dayIndex + (weekNumber - 1) * 7`), so the review page and the PDF
  always agree with each other and with the generator on which day is "the" mixed-veg day.

`vegetable_b` isn't included in the `vegetable_a`-vs-`vegetable_a` combo pool — its smaller 50
g/exchange size means even a concentrated count (3 exchanges/150 g) still reads as a normal
single-dish portion, so there's nothing to gate there; it only ever participates in the second
mechanism above (pairing with `vegetable_a`).

Display simplification (`meal-composition.ts`'s `formatComposedGroupPlainText`): even on the one day
a generic "Mixed Vegetable {word}" group is shown, it renders as `"{dishName} ({totalGrams} g)"` —
total grams only, no per-vegetable breakdown. Scoped narrowly via `GENERIC_MIXED_VEG_PREFIX`
("Mixed Vegetable ") so it doesn't affect a curated name (Aloo Gobi still lists its two components —
a named dish's own composition is useful information) or the separate "Salad" pool (dishName exactly
`"Salad"`, doesn't match the prefix).

Quantity display (`format-item.ts`) normally shows only the verified gram figure, deliberately
never inventing a piece count (see the file's own comment — the real reference PDF's richer
per-food phrasing, e.g. "5 rotis", comes from a data model this app didn't adopt). `meat`/
`meat_lean` are the one exception: `exchangeCount` is already the exact, verified count for these
— not derived or guessed from the gram figure — so it's shown alongside it, e.g. `"2, 80 g"` for 2
eggs, exactly as trustworthy as the gram number itself.

### Seasonal eligibility

`foods.seasons` (`text[]`, default `{all_year}`) is a seventh AND-combined eligibility filter in
`eligible-foods.ts`, sitting after `medical_tags` — same discipline as the Meal Archetype layer:
additive, narrows which foods can fill a slot the solver already decided the exchange counts for,
never touches a macro number. `"all_year"` always passes regardless of the derived season, so an
untagged/staple food (the default for every existing row) is never accidentally narrowed by this
migration alone — only an explicit retag can narrow a pool.

`season.ts`'s `seasonFor(weekStartISO, region)` derives the season from the plan's actual
`week_start` (not "today" — a plan's week can start in a different season than the day it's
generated on) via a fixed month→season table (`NORTH_CALENDAR`). Only one calendar exists today;
every region currently falls back to it. This is a known, deliberate limitation — real
`SOUTH_CALENDAR`/`WEST_CALENDAR`/`EAST_CALENDAR` tables need their own grounding (monsoon onset
genuinely differs by coast) rather than being guessed. `POST /api/plan/generate` accepts an
optional `season` override in its request body; when omitted it derives from `week_start` + region
automatically, so a dietitian never has to think about it unless overriding.

Seed data (`table41_foods.json`) is retagged only where grounded in a concrete claim — e.g. Sarson
saag/Methi/Palak/Carrot → `winter`, Lauki/Tinda/Guava → `monsoon`, Musk melon → `summer`. Every
region besides Punjab is left at the `all_year` default; fabricating seasonal claims for regions
with no source data to check them against would be worse than not tagging them at all.

### No cooking fat alongside a plain porridge cereal

A dietitian correction on a generated PDF: Oats — added specifically because Gobi/Mooli Paratha's
new seasonal tagging (above) could otherwise leave breakfast with too few eligible cereals in some
weeks, and given its own "Oats Meal" archetype with **no** fat component precisely because "plain
oats porridge doesn't conventionally need a ghee tempering the way a paratha does" (see the Meal
Archetype migration) — still showed up with Ghee plated next to it every time it was actually
selected.

Root cause: the Meal Archetype layer's dish-family narrowing is a **weekly union** per (slot,
exchangeType) across all 7 days' assigned archetypes (`route.ts`, see "Meal Archetype + Dish
Composition layer" above), while `meal-distributor.ts`'s skeleton is identical for every day of the
week — breakfast always carries a nonzero `fat` exchange count regardless of which archetype that
specific day landed on. Giving "Oats Meal" no fat component only meant it contributed nothing *new*
to that union; it never *removed* Ghee, which the region's paratha archetypes' own `ghee_fat`
components already put there for the whole week. So on the days Oats was actually selected, Ghee
remained the only eligible `fat` food for breakfast — the exact pairing the archetype was designed
to avoid. (This is a distinct, independently-discovered instance of the same architectural gap
already documented in `plan-view-model.ts`'s adherence comment — a day's archetype intent can drift
from the food actually plated — except this time the drift is visible in the rendered PDF, not just
in an internal label.)

Fixed one level below the archetype/dish-family system, at plain food tags, which
`food-selector-fallback.ts` (and, via a matching `ROTATION_RULES` entry, the LLM prompt path) can
check per-item within a single slot regardless of which archetype is nominally assigned that day —
the same mechanism already used for the `vegetable_a`/`vegetable_b` salad restriction above.
`cooking_fat` tags every fat-exchange food actually used to cook or temper a dish (Ghee, Toop,
Mustard oil, Groundnut oil, Til oil, Coconut oil, Sesame oil, Grated coconut) — inappropriate
spooned over a cold cereal porridge. `no_cooking_fat` on Oats means: whichever `fat` food fills the
same slot should avoid `cooking_fat`-tagged foods, degrading to the unfiltered pool (same graceful
pattern as everywhere else in this file) when no alternative is eligible. Almonds and Walnut
(already `generic` region, so eligible in every region including Punjabi) had their `meal_slots`
widened to include `breakfast` so a real alternative exists — chopped nuts over porridge is a
standard preparation, unlike ghee. Scoped to Oats only, not Dalia/Upma (also fat-component-free
breakfast archetypes) — those are legitimately still cooked with an oil tempering in real
preparation, so forcing the same restriction onto them would have been a fabricated rule, not a
correction.

## Rounding & precision
- All intermediate maths unrounded. Round only at display.
- kcal, protein/carb/fat grams → integer at display.
- BMI → 1 decimal. Weights → 1 decimal.
- Timeline divisors displayed at full precision (`20.2 ÷ 0.74`, never `÷ 0.7`).

## Testing
Every function in `src/lib/counselling/` and `src/lib/plan/` gets a Vitest unit test. The four worked examples (TEST-001 Priya, TEST-002 Rahul, TEST-003 Sneha, TEST-004 Aadi) are golden-file tests — if any figure drifts, the build fails. Do not change a golden file to make a test pass; fix the code or ask.

## Conventions
- No `any`. No `@ts-ignore`.
- Zod schema at every boundary: form input, LLM output, API response.
- Errors surface to the UI. Never silently fall back to a default number in a clinical calculation — throw, and let the review page show a blocked state.
- Server-only secrets in `src/lib/env.ts`, validated with Zod at boot.
- Migrations in `supabase/migrations/`, timestamped, forward-only.

## Auth
Google OAuth via Supabase. Access restricted to `@fitelo.co`. Enforced in three places — all three required:
1. `queryParams: { hd: 'fitelo.co' }` on sign-in (UX hint only, spoofable).
2. Postgres trigger on `auth.users` insert — reject non-fitelo.co emails.
3. Middleware + RLS policy checking `auth.jwt() ->> 'email' LIKE '%@fitelo.co'`.

## Do not
- Do not install a nutrition API or food database package. `exchange_types` + our own `foods` table is the entire source of truth.
- Do not let plan generation write to the DB until validation passes.
- Do not add a "regenerate with AI" button that bypasses the solver.
