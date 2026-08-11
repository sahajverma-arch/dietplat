import type { Food } from "@/db/schema"
import type { ExchangeCode } from "./table-4-1"
import type { Skeleton } from "./meal-distributor"
import type { ArchetypeAssignment } from "./archetype-selector"

export interface PreviousWeekItem {
  exchangeType: ExchangeCode
  foodId: string
  nameEn: string
}

export interface FoodSelectorInput {
  region: string
  dietType: string
  mealCount: number
  skeleton: Skeleton
  /** From eligible-foods.ts's eligibleFoodsForSkeleton() — already region/diet/allergen/dislike/medical filtered, AND already archetype-narrowed wherever an archetype applied. */
  eligibleFoodsBySlot: Record<string, Partial<Record<ExchangeCode, Food[]>>>
  /**
   * Continues the fallback selector's day-based rotation across weeks
   * instead of resetting to 0 — week 2 day 0 picks up where week 1 day 6
   * left off, so a plan generated week-over-week doesn't cycle back to
   * week 1's exact food set. 0 for a first-ever generation.
   */
  dayIndexOffset?: number
  /** Previous week's last day (dayIndex 6), by slot — the LLM prompt asks day 0 not to repeat these; the fallback selector already avoids them via dayIndexOffset. */
  previousWeekLastDay?: Record<string, PreviousWeekItem[]>
  /**
   * From archetype-selector.ts's selectArchetypesForWeek() — index 0-6 =
   * dayIndex. Purely guidance: eligibleFoodsBySlot was already narrowed by
   * this before it got here, so the LLM path only needs this to describe
   * WHY a pool looks the way it does; the fallback path never reads it at
   * all (it just rotates the already-narrowed pool, unchanged). Omitted or
   * every entry null when no archetype applies — see archetype-selector.ts's
   * own null-when-disabled/no-data behaviour.
   */
  archetypeAssignmentsByDay?: ArchetypeAssignment[][]
  /**
   * Sorted `[dishFamilyIdA, dishFamilyIdB].join("|")` pairs from
   * vegetable_dish_combinations (Aloo Gobi, Aloo Baingan, Tinda Aloo, Aloo
   * Methi — see the migrations), computed by route.ts BEFORE food
   * selection runs. food-selector-fallback.ts uses this to let
   * vegetable_a/vegetable_b co-occur in one slot only when it forms one of
   * these real named dishes; otherwise vegetable_b's pool for that slot is
   * restricted to salad-tagged foods so the two never render as two
   * separate sabzi lines. Omitted (undefined) degrades to the salad-only
   * restriction with no curated exception — never throws either way.
   */
  curatedVegetableFamilyPairs?: ReadonlySet<string>
}

export interface SelectedItem {
  foodId: string
  exchangeType: ExchangeCode
  exchangeCount: number
}

export interface SelectedMeal {
  slot: string
  items: SelectedItem[]
}

export interface SelectedDay {
  dayIndex: number
  meals: SelectedMeal[]
}

export interface Selection {
  days: SelectedDay[]
}

export type GenerationMode = "ai" | "fallback"

export interface FoodSelectionResult {
  selection: Selection
  generationMode: GenerationMode
  modelUsed: string | null
  attempts: number
}
