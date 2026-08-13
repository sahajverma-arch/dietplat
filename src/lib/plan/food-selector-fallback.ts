/**
 * Deterministic round-robin selector used after 3 failed LLM attempts. No
 * randomness (Math.random would make plan_generation_runs unreproducible) —
 * rotation comes from a stable hash of (slot, exchangeType) so different
 * slots don't all start at the same food, plus the day index.
 *
 * Real plans (Deepak/Anjali) use ONE food per (slot, exchangeType) even at
 * high exchange counts (5 cereal exchanges = one "Roti" line). vegetable_a
 * and vegetable_b USED to be an exception, splitting into 2 distinct items
 * whenever 2+ exchanges were needed — reverted (see the conversation this
 * accompanies): real everyday Indian sabzi is overwhelmingly single-
 * vegetable (Lauki Sabzi, Karela Sabzi, Bhindi Masala — confirmed via web
 * research, not just the original Deepak/Anjali dinner observation), with
 * a 2-vegetable dish almost always meaning a specific named "Aloo + X"
 * pairing (Aloo Gobi, Aloo Baingan, Tinda Aloo, Aloo Methi), not two
 * arbitrary vegetable_a foods thrown together. One food per (slot,
 * vegetable_a) and one per (slot, vegetable_b) already produces exactly
 * that shape on its own: vegetable_b is Potato on the days the fallback
 * rotation lands there, which vegetable-dish-naming.ts can then name
 * ("Aloo Gobi") — see supabase/migrations for the seeded combos. `fruit`
 * keeps its 2-item split; that part of the original observation stands.
 *
 * "Mixed veg" day, vegetable_a only: meal-distributor.ts's
 * MEAT_CONFLICTING_TYPES excludes pulse/vegetable_a/vegetable_b from
 * whichever slot carries meat/meat_lean that day. A dietitian confirmed a
 * real constraint this pool must respect: a meal can never carry two
 * separate cooked-vegetable dishes, even at a realistic serving size each —
 * an earlier attempt at solving oversized single dishes by splitting a
 * concentrated count into 2+ different foods WITHIN one meal was rejected
 * for exactly this reason and reverted (see the conversation this
 * accompanies). The actual fix for portion size lives upstream, in
 * exchange-solver.ts (capping non_vegetarian's vegetable_a ceiling to what
 * one meal can hold) and meal-distributor.ts (meat_lean always anchors
 * dinner, so lunch is the day's one stable vegetable meal) — this file's
 * only remaining vegetable-variety mechanism is the deliberate, occasional
 * "mixed veg" DAY (not a portion-size escape hatch): `isMixedVegDay()`, a
 * `stableHash`-gated ~1-in-7 rotation, independent of how large the slot's
 * count is that day. On that one day, 2 vegetable_a foods share the count
 * for variety; every other day stays single-vegetable, at whatever count
 * the day needs — a big bowl of one favourite sabzi reads as normal; an
 * arbitrary mix of unrelated vegetables does not, which is what this
 * mechanism is about.
 *
 * `SOLO_ONLY_TAG` foods (Karela, Lauki, Brinjal, Tori and their regional
 * aliases — see table41_foods.json) are excluded from the mixed-veg
 * candidate pool entirely, even on a mixed-veg day: these are real,
 * always-solo dishes (Karela Sabzi, Lauki Sabzi, Baingan Bharta), never
 * randomly combined with an unrelated vegetable in practice. They can
 * still appear alone (any day, any count) and can still pair with
 * vegetable_b for a curated combo (Aloo Baingan) — that's a completely
 * different mechanism (two different exchange types naturally co-occurring
 * in a slot), not this same-exchange-type mixing pool.
 *
 * `isMixedVegDay()` lives in mixed-veg-day.ts, shared with
 * vegetable-dish-naming.ts: that file gates a DIFFERENT source of the same
 * symptom — vegetable_a's single food pooling with vegetable_b's single
 * food at DISPLAY time into an uncurated "Mixed Vegetable {word}" (e.g.
 * Capsicum + Sweet corn, neither one a duplicate exchange type, so this
 * file's own combo pool never touches it). Both gates must agree on which
 * day is "the" mixed-veg day, hence the shared function instead of two
 * independently-hashed ones.
 *
 * vegetable_b never mixes at all: its smaller 50 g/exchange size means
 * even the same concentration (3 exchanges/150 g) still reads as a normal
 * single-dish portion, so there's nothing to fix there.
 *
 * vegetable_b co-occurring with vegetable_a in the SAME slot is a second,
 * independent source of the "two sabzi dishes in one meal" problem — e.g.
 * Tinda (vegetable_a) + Sweet corn (vegetable_b), neither salad-tagged and
 * no curated dish_combinations match, renders as two separate lines at
 * DISPLAY time (vegetable-dish-naming.ts's `!allowGenericMixedVeg` split-
 * back-apart branch). A dietitian confirmed the fix: vegetable_a and
 * vegetable_b may still land in the same slot when it forms a REAL named
 * dish (Aloo Gobi, Aloo Baingan, Tinda Aloo, Aloo Methi — see
 * curatedVegetableFamilyPairs, computed from vegetable_dish_combinations),
 * but otherwise vegetable_b's pool for that slot is restricted to
 * salad-tagged foods only (Carrot, Onion, Beetroot, Radish — always
 * rendered as a separate "Salad" line, never a competing sabzi). This is a
 * pool restriction, not a fabricated macro: whichever salad-tagged food
 * wins the rotation is a real, honestly-labelled food actually served —
 * never a hidden or invented quantity. Degrades to the unfiltered pool
 * (same graceful pattern as PROTEIN_EXCHANGE_TYPES) only if NO salad-tagged
 * or curated-matching food is eligible at all, an edge case this project's
 * seeded data doesn't currently produce (most regions' vegetable_b pools
 * are majority salad-tagged).
 *
 * Same-day protein exclusion: without this, whether e.g. lunch and dinner
 * land on the same pulse is pure chance — stableHash(slot, "pulse") happens
 * to be congruent mod several common pool sizes, so most regions saw the
 * identical pulse at both meals on every single day (see the meal-variety
 * design conversation this accompanies). PROTEIN_EXCHANGE_TYPES tracks, per
 * day, which dish family (or bare food, when untagged) each protein-bearing
 * slot already used, and excludes it from later same-day slots' pool —
 * falling back to the unfiltered pool whenever exclusion would empty it, so
 * this can never throw or leave a slot unfilled. Purely a same-day ordering
 * preference over an already-eligible pool: never changes exchange counts,
 * pool membership, or quantities.
 *
 * No cooking fat alongside a plain porridge cereal (e.g. "we cannot add ghee
 * with oats"): the Meal Archetype layer's dish-family union (route.ts) is a
 * WEEKLY union per (slot, exchangeType) across all 7 days' assigned
 * archetypes, but meal-distributor.ts's skeleton is identical every day —
 * breakfast always carries a nonzero `fat` count regardless of which
 * archetype that specific day landed on. Giving "Oats Meal" no fat
 * component at all (see the conversation this accompanies) only meant it
 * added nothing new to that union; it never REMOVED Ghee, which the
 * region's paratha archetypes' own `ghee_fat` components already put there
 * for the whole week — so on the days Oats was actually selected, Ghee
 * remained the only eligible `fat` food. Fixed one level below the
 * archetype system, at plain food tags, which this file can check per-item
 * within a single slot regardless of which archetype (if any) applies that
 * day: `no_cooking_fat` on a cereal (Oats) means whatever `fat` food fills
 * the same slot should avoid `cooking_fat`-tagged foods (Ghee, Mustard oil,
 * and other actual cooking oils/ghee across regions) — degrading to the
 * unfiltered pool, same graceful pattern as everywhere else in this file,
 * when no non-cooking-fat alternative (e.g. Almonds, Walnut) is eligible.
 *
 * Same-day fat exclusion: caught by inspecting a real generated PDF — Ghee
 * (or Mustard oil) showed up at BOTH lunch and dinner, every single day of
 * the week, with no exception, and Almonds/Walnut repeated across
 * breakfast and mid-morning on several days too. `fat` was simply never
 * added to PROTEIN_EXCHANGE_TYPES's same-day tracking when that mechanism
 * was built for pulse/meat/meat_lean — an oversight, not a deliberate
 * choice, since `fat` is exactly as prone to the same stableHash-collision
 * repetition those types already guard against. Folded into the
 * `no_cooking_fat` branch above rather than added to
 * PROTEIN_EXCHANGE_TYPES directly, since that would skip the
 * cooking-fat-tag restriction entirely (an `else if` chain only runs one
 * branch) — the fat branch now applies BOTH restrictions in cascade:
 * (cooking-fat-appropriate AND not used yet today), falling back to just
 * (cooking-fat-appropriate) if that empties the pool, then to fully
 * unrestricted — same three-tier graceful degrade already established for
 * every other same-day preference in this file, never a hard rule.
 *
 * Nuts consolidated to mid_morning: a dietitian looked at a real generated
 * PDF and didn't want the day's "snack" nut serving fragmenting into small,
 * awkward gram amounts across breakfast/mid_morning/evening (e.g. "Almonds
 * (3 g)") — one clean serving, one slot, every day. Evening's own `fat`
 * need was removed entirely at the meal_templates level (see
 * 20260811050000), so this file never even sees a `fat` item for evening
 * anymore. Breakfast is the one place nuts couldn't just disappear too:
 * Oats (and any other `no_cooking_fat` cereal) still needs a real
 * non-cooking-fat option there, or it would silently fall back to Ghee —
 * exactly the bug already fixed once this session. So breakfast's `fat`
 * pool is now cooking-fat-ONLY when the cereal is a regular (non-Oats)
 * one, and nut-preferring (the pre-existing `no_cooking_fat` behavior,
 * unchanged) only for the Oats-style carve-out — Almonds/Walnut keep
 * `breakfast` in their own `meal_slots` specifically so that carve-out has
 * something real to select, even though a regular Paratha morning will
 * never actually pick one.
 *
 * Omelette pairs with plain Paratha: a direct, specific, and repeated user
 * instruction — whenever a slot's `meat` exchange resolves to Omelette,
 * that slot's `cereal` should be the literal food Paratha, every time, not
 * a region-specific substitute. `meat` resolves before `cereal` in this
 * loop (see ZERO_COUNTS's field order in table-4-1.ts, which
 * `Object.keys(counts)` follows, same ordering fact `MEAT_CONFLICTING_TYPES`
 * in meal-distributor.ts already relies on) — so by the time a slot's
 * `cereal` item is reached, `selectedItems` already reflects whichever
 * `meat` food actually got picked, no lookahead needed.
 *
 * Matched via a tag (`omelette_pairing_cereal`, currently on Paratha only)
 * rather than a hardcoded name, so the rule survives Paratha ever gaining a
 * regional alias row — but this is genuinely just "the tag Paratha
 * happens to carry", not a per-region "each region's own plain analog"
 * design. That per-region design was tried first and reverted: a real
 * Rajasthani plan initially showed Bajra bhakri alongside Omelette instead
 * of Paratha, which looked plausible (Bajra bhakri is Rajasthan's own
 * plain, unstuffed flatbread) but was explicitly rejected — the user
 * clarified that "plain Paratha" means literally that food, everywhere it
 * can be made eligible, not a regional stand-in. The real root cause
 * wasn't the pairing logic at all — Paratha simply was never ELIGIBLE for
 * rajasthani, on two independent layers (see 20260811080000): its
 * `regions` array was `{north_indian}` only, and even past that,
 * rajasthani's own two breakfast archetypes didn't declare the
 * `plain_paratha` dish family in their cereal role, so the Meal Archetype
 * layer's weekly union would have excluded it regardless. Both are now
 * fixed for rajasthani, mirroring the north_indian fix (20260811060000)
 * exactly. Once eligible, Paratha also becomes a normal (non-Omelette-
 * gated) rotation option there, same as it already was for north_indian —
 * this rule only ever FORCES Paratha when Omelette is present, it never
 * excludes Paratha the rest of the time.
 *
 * Any other region (punjabi, gujarati, bengali, south_indian, hyderabadi,
 * maharashtrian) still has no food tagged `omelette_pairing_cereal` and no
 * archetype declaring `plain_paratha` — an Omelette there gracefully
 * degrades to the unrestricted cereal pool, same as everywhere else in
 * this file, until Paratha is confirmed and made eligible there too.
 * Scoped to Omelette only, not Egg/Egg curry/Egg bhurji — the instruction
 * named Omelette specifically.
 */

import type { ExchangeCode } from "./table-4-1"
import type { Food } from "@/db/schema"
import type { FoodSelectorInput, Selection, SelectedDay, SelectedItem, SelectedMeal } from "./food-selector-types"
import { isMixedVegDay } from "./mixed-veg-day"

const SPLITTABLE_TYPES = new Set<ExchangeCode>(["fruit"])
// mid_morning is deliberately excluded from the fruit split below — a
// dietitian directive: only ONE fruit at mid_morning, ever, regardless of
// how many fruit exchanges land there; a bigger mid_morning fruit need is
// covered by a bigger serving of that same fruit, not a second fruit
// alongside it. breakfast/evening keep the normal 2-fruit split.
const NO_FRUIT_SPLIT_SLOTS = new Set(["mid_morning"])
const PROTEIN_EXCHANGE_TYPES = new Set<ExchangeCode>(["pulse", "meat", "meat_lean"])
const MIXED_VEG_TYPES = new Set<ExchangeCode>(["vegetable_a"])
const SOLO_ONLY_TAG = "solo_only"
const SALAD_TAG = "salad"
const NO_COOKING_FAT_TAG = "no_cooking_fat"
const COOKING_FAT_TAG = "cooking_fat"
const PAIRS_WITH_PLAIN_PARATHA_TAG = "pairs_with_plain_paratha"
const OMELETTE_PAIRING_CEREAL_TAG = "omelette_pairing_cereal"

/** Dish family when tagged, else the food's own id — the same granularity used to exclude "no repeat" across a day. */
function familyKey(food: Food): string {
  return food.dishFamilyId ?? food.id
}

/** Same sorted-pair convention curatedVegetableFamilyPairs (route.ts) is built with — order-independent, so Aloo+Gobi matches regardless of which side is which. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|")
}

function stableHash(...parts: string[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

export function fallbackSelection(input: FoodSelectorInput): Selection {
  const days: SelectedDay[] = []
  const weekOffset = input.dayIndexOffset ?? 0

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const rotationDay = dayIndex + weekOffset
    const meals: SelectedMeal[] = []
    // Reset per day — see PROTEIN_EXCHANGE_TYPES above. Populated as slots
    // are resolved below, in skeleton order (breakfast..dinner), so a later
    // slot the same day always sees what an earlier one already used.
    const usedFamilyKeysToday = new Map<ExchangeCode, Set<string>>()
    // fat-only: a second, food-id-level tracker alongside the family-level
    // one above. Almonds/Walnut share ONE dish family (nuts_topping) with
    // only 2 members and no other same-slot alternative for a region like
    // punjabi — the moment either is used, family-level exclusion empties
    // the pool entirely and falls all the way back to fully unrestricted,
    // which is how "Almonds at breakfast, Almonds again at mid-morning"
    // still slipped through even with same-day family exclusion in place.
    // This lets the fat branch try "at least the literal OTHER food" (e.g.
    // Walnut) as an intermediate tier before giving up on variety entirely.
    const usedFoodIdsToday = new Map<ExchangeCode, Set<string>>()

    for (const [slot, items] of Object.entries(input.skeletonsByDay[dayIndex])) {
      const selectedItems: SelectedItem[] = []

      for (const item of items) {
        const eligible = input.eligibleFoodsBySlot[slot]?.[item.exchangeType] ?? []
        if (eligible.length === 0) {
          throw new Error(
            `Fallback selector: no eligible foods for ${item.exchangeType} at ${slot} — this should have been caught by eligible-foods.ts.`
          )
        }

        const offset = stableHash(slot, item.exchangeType)

        const isFruitSplit =
          SPLITTABLE_TYPES.has(item.exchangeType) && item.count >= 2 && eligible.length >= 2 && !NO_FRUIT_SPLIT_SLOTS.has(slot)

        const comboEligible =
          MIXED_VEG_TYPES.has(item.exchangeType) && item.count >= 2 && isMixedVegDay(rotationDay)
            ? eligible.filter((f) => !f.tags.includes(SOLO_ONLY_TAG))
            : []
        const isMixedVegSplit = comboEligible.length >= 2

        const splitPool = isMixedVegSplit ? comboEligible : eligible

        if (isFruitSplit || isMixedVegSplit) {
          const idxA = (rotationDay + offset) % splitPool.length
          const idxB = (idxA + 1) % splitPool.length
          const totalHalfUnits = Math.round(item.count * 2)
          const halfUnitsA = Math.ceil(totalHalfUnits / 2)
          const halfUnitsB = totalHalfUnits - halfUnitsA

          selectedItems.push({ foodId: splitPool[idxA].id, exchangeType: item.exchangeType, exchangeCount: halfUnitsA / 2 })
          selectedItems.push({ foodId: splitPool[idxB].id, exchangeType: item.exchangeType, exchangeCount: halfUnitsB / 2 })
        } else if (PROTEIN_EXCHANGE_TYPES.has(item.exchangeType)) {
          const usedFamilyKeys = usedFamilyKeysToday.get(item.exchangeType) ?? new Set<string>()
          const unused = eligible.filter((f) => !usedFamilyKeys.has(familyKey(f)))
          // "unless no alternatives exist" — degrade to the full pool rather
          // than force a NoEligibleFoodsError-shaped outcome for what is
          // only ever a same-day repetition preference, never a hard rule.
          const pool = unused.length > 0 ? unused : eligible

          const idx = (rotationDay + offset) % pool.length
          const chosen = pool[idx]
          selectedItems.push({ foodId: chosen.id, exchangeType: item.exchangeType, exchangeCount: item.count })

          usedFamilyKeys.add(familyKey(chosen))
          usedFamilyKeysToday.set(item.exchangeType, usedFamilyKeys)
        } else if (item.exchangeType === "vegetable_b" && selectedItems.some((i) => i.exchangeType === "vegetable_a")) {
          const vegAPool = input.eligibleFoodsBySlot[slot]?.vegetable_a ?? []
          const vegAFamilyIds = selectedItems
            .filter((i) => i.exchangeType === "vegetable_a")
            .map((i) => vegAPool.find((f) => f.id === i.foodId)?.dishFamilyId)
            .filter((id): id is string => !!id)

          const restricted = eligible.filter(
            (f) =>
              f.tags.includes(SALAD_TAG) ||
              (!!f.dishFamilyId && vegAFamilyIds.some((fam) => input.curatedVegetableFamilyPairs?.has(pairKey(fam, f.dishFamilyId!))))
          )
          const pool = restricted.length > 0 ? restricted : eligible

          const idx = (rotationDay + offset) % pool.length
          selectedItems.push({ foodId: pool[idx].id, exchangeType: item.exchangeType, exchangeCount: item.count })
        } else if (item.exchangeType === "fat") {
          const cerealPool = input.eligibleFoodsBySlot[slot]?.cereal ?? []
          const cerealNeedsNoCookingFat = selectedItems
            .filter((i) => i.exchangeType === "cereal")
            .some((i) => cerealPool.find((f) => f.id === i.foodId)?.tags.includes(NO_COOKING_FAT_TAG))

          let cookingFatFiltered: Food[]
          if (cerealNeedsNoCookingFat) {
            // Oats-style cereal: the one carve-out. Nuts are otherwise
            // consolidated to mid_morning, but a no_cooking_fat cereal at
            // breakfast still needs a real non-cooking-fat option there —
            // removing this would just reintroduce "ghee with oats".
            cookingFatFiltered = eligible.filter((f) => !f.tags.includes(COOKING_FAT_TAG))
          } else if (slot === "breakfast") {
            // Regular (non-Oats) breakfast cereal: nuts are consolidated to
            // mid_morning, so breakfast's fat should be cooking-fat only
            // (Ghee/Mustard oil with Paratha) — not a fragment of nuts too.
            cookingFatFiltered = eligible.filter((f) => f.tags.includes(COOKING_FAT_TAG))
          } else {
            cookingFatFiltered = eligible
          }
          cookingFatFiltered = cookingFatFiltered.length > 0 ? cookingFatFiltered : eligible

          const usedFamilyKeys = usedFamilyKeysToday.get(item.exchangeType) ?? new Set<string>()
          const usedFoodIds = usedFoodIdsToday.get(item.exchangeType) ?? new Set<string>()
          const unusedByFamily = cookingFatFiltered.filter((f) => !usedFamilyKeys.has(familyKey(f)))
          const unusedById = cookingFatFiltered.filter((f) => !usedFoodIds.has(f.id))
          // Four-tier cascade, each falling back only when the stricter one
          // empties: (1) cooking-fat-appropriate AND a genuinely different
          // dish family — the ideal case; (2) cooking-fat-appropriate AND at
          // least a different literal food — real variety even within a
          // thin, shared family (e.g. Walnut instead of Almonds), which tier
          // 1 alone can't offer once a 2-member family's only other member
          // is the one already used; (3) just cooking-fat-appropriate,
          // ignoring repetition; (4) fully unrestricted. Never throws, never
          // leaves the slot unfilled.
          const pool =
            unusedByFamily.length > 0
              ? unusedByFamily
              : unusedById.length > 0
                ? unusedById
                : cookingFatFiltered.length > 0
                  ? cookingFatFiltered
                  : eligible

          const idx = (rotationDay + offset) % pool.length
          const chosen = pool[idx]
          selectedItems.push({ foodId: chosen.id, exchangeType: item.exchangeType, exchangeCount: item.count })

          usedFamilyKeys.add(familyKey(chosen))
          usedFamilyKeysToday.set(item.exchangeType, usedFamilyKeys)
          usedFoodIds.add(chosen.id)
          usedFoodIdsToday.set(item.exchangeType, usedFoodIds)
        } else if (item.exchangeType === "cereal") {
          const meatPool = input.eligibleFoodsBySlot[slot]?.meat ?? []
          const needsPlainCereal = selectedItems
            .filter((i) => i.exchangeType === "meat")
            .some((i) => meatPool.find((f) => f.id === i.foodId)?.tags.includes(PAIRS_WITH_PLAIN_PARATHA_TAG))

          const restricted = needsPlainCereal ? eligible.filter((f) => f.tags.includes(OMELETTE_PAIRING_CEREAL_TAG)) : eligible
          // Graceful degrade, same pattern as everywhere else in this file:
          // only north_indian (Paratha) and rajasthani (Bajra bhakri) have a
          // food tagged omelette_pairing_cereal today, so an Omelette
          // selected for any other region simply falls back to the normal
          // cereal pool rather than forcing a food that was never eligible
          // there.
          const pool = restricted.length > 0 ? restricted : eligible

          const idx = (rotationDay + offset) % pool.length
          selectedItems.push({ foodId: pool[idx].id, exchangeType: item.exchangeType, exchangeCount: item.count })
        } else {
          const idx = (rotationDay + offset) % eligible.length
          selectedItems.push({ foodId: eligible[idx].id, exchangeType: item.exchangeType, exchangeCount: item.count })
        }
      }

      meals.push({ slot, items: selectedItems })
    }

    days.push({ dayIndex, meals })
  }

  return { days }
}
