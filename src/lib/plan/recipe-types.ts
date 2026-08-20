import type { Recipe } from "@/db/schema"
import type { RecipeCuisine } from "@/lib/foods/recipe-cuisine-mapping"

import type { DietType } from "./exchange-solver"
import type { AchievedMacros } from "./table-4-1"

/** AchievedMacros widened with fiber — a soft target, tracked and logged, never a hard reject-gate (see recipe-validate.ts). */
export interface RecipeAchievedMacros extends AchievedMacros {
  fiberG: number
}

export interface DailyRecipeTarget {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

export interface MealSlotInfo {
  slot: string
  slotOrder: number
  timeHint: string | null
}

/** Denormalized recipe row shape the LLM prompt table actually needs — no serving-limit columns, since the LLM never proposes grams. */
export interface RecipeForPrompt {
  id: string
  name: string
  category: string
  mainOrMid: "main" | "mid"
  cuisine: string
  macroCategory: string | null
  commonality: number
  proteinPer100G: number
  carbsPer100G: number
  fatPer100G: number
  fiberPer100G: number
  kcalPer100G: number
}

export interface RecipeSelectorInput {
  cuisine: RecipeCuisine
  dietType: DietType
  mealCount: number
  dailyTarget: DailyRecipeTarget
  slots: MealSlotInfo[]
  eligibleRecipesForPrompt: RecipeForPrompt[]
  allRecipesById: Map<string, Recipe>
  eligibleCuisines: RecipeCuisine[]
  clientAllergenTags: string[]
  /** recipe_aliases rows for the eligible pool — grounding's alias tier. */
  aliasRows: { recipeId: string; alias: string }[]
  dayIndexOffset?: number
  previousWeekLastDayRecipeNames?: Record<string, string[]>
}

// LLM-selected (name only, no grams ever)
export interface SelectedRecipeItem {
  name: string
}
export interface SelectedRecipeMeal {
  slot: string
  items: SelectedRecipeItem[]
}
export interface SelectedRecipeDay {
  dayIndex: number
  meals: SelectedRecipeMeal[]
}
export interface RecipeSelection {
  days: SelectedRecipeDay[]
}

// Grounded (resolved to a real Recipe row) — grams start at the recipe's
// own idealGrams and are only ever changed by recipe-balancer.ts.
export interface GroundedRecipeItem {
  recipe: Recipe
  grams: number
}
export interface GroundedRecipeMeal {
  slot: string
  items: GroundedRecipeItem[]
}
export interface GroundedRecipeDay {
  dayIndex: number
  meals: GroundedRecipeMeal[]
  totals: RecipeAchievedMacros
  cappedRecipeNames: string[]
  unknownRecipeNames: string[]
}
export interface GroundedRecipeSelection {
  days: GroundedRecipeDay[]
}

export interface RecipeSelectionResult {
  selection: GroundedRecipeSelection
  generationMode: "ai" | "fallback"
  modelUsed: string | null
  attempts: number
  warnings: string[]
}
