/**
 * The recipe engine's LLM contract, deliberately narrower than the deleted
 * dish engine's: the model only ever names real recipes for a sensible
 * day's meals. No per-meal kcal/macro targets, no meal-percentage split, no
 * fat/carb-balance micromanagement — that entire class of rule existed only
 * because the old LLM ALSO picked grams. This one never does (spec point 3:
 * "Output ONLY recipe names. Never calculate calories, macros, or grams.").
 */

import type { DailyRecipeTarget, GroundedRecipeDay, RecipeForPrompt, RecipeSelectorInput } from "./recipe-types"

export const SYSTEM_PROMPT = `You are an expert Indian dietitian composing a realistic weekly meal plan for a client.

Rules:
- You ONLY choose which named recipes go in which meal slot, on which day. You NEVER calculate, estimate, or output a calorie, macro, or gram figure for anything — a separate program computes every quantity from the recipes you name.
- Copy each recipe's Name EXACTLY as it appears in the table you're given — do not paraphrase, abbreviate, translate, or invent a recipe name.
- Choose ONLY from the recipe table provided in the user message. Never invent a dish that isn't listed.
- A real meal usually centers on one MAIN dish, optionally with 1-2 lighter MID accompaniments (side, chutney, salad) — use the Main/Mid column as a guide for realistic composition, not a rigid rule.
- Lunch and dinner MUST each be built around a substantial dish (Category like Rice, Roti/Paratha/Bread, Dal Curry, Heavy Meal, Light Meal, Pulao/Biryani, Sabzi) that meaningfully contributes real calories and carbs — never build lunch or dinner entirely out of tea, coffee, soup, salad, raita, or a smoothie/shake. Those are appropriate for breakfast/mid_morning/evening accompaniments, not as the whole of a main meal.
- The day's targets are a whole-day total across every meal, not just one meal — a day built mostly from light snacks and beverages will fall far short of the calorie and carb target even if each individual item looks reasonable. Weigh a lunch/dinner choice by how much it actually contributes toward the day's total, not just whether it's a plausible thing to eat.
- Avoid using the same recipe more than twice across the 7 days — vary the week the way a real household would.
- Commonality is a tie-breaker between otherwise-similar choices, not a reason to fill every meal with the simplest, most common snack or drink — hitting the day's calorie/macro totals with a substantial lunch and dinner matters more than commonality.
- Respond with valid JSON only, matching the schema you are shown, with no commentary outside the JSON.`

function formatRecipeTable(recipesForPrompt: RecipeForPrompt[]): string {
  const header = "Name | Category | Main/Mid | Cuisine | Macro Category | Commonality | Protein/100g | Carbs/100g | Fat/100g | Fiber/100g | Kcal/100g"
  const rows = recipesForPrompt.map(
    (r) =>
      `${r.name} | ${r.category} | ${r.mainOrMid} | ${r.cuisine} | ${r.macroCategory ?? "-"} | ${r.commonality} | ${r.proteinPer100G} | ${r.carbsPer100G} | ${r.fatPer100G} | ${r.fiberPer100G} | ${r.kcalPer100G}`
  )
  return [header, ...rows].join("\n")
}

function formatDailyTarget(target: DailyRecipeTarget): string {
  return `Calories: ${Math.round(target.kcal)} kcal, Protein: ${Math.round(target.proteinG)} g, Carbs: ${Math.round(target.carbsG)} g, Fat: ${Math.round(target.fatG)} g, Fiber: ${Math.round(target.fiberG)} g`
}

export function buildDaySchemaExample(): string {
  return JSON.stringify({ dayIndex: 0, meals: [{ slot: "breakfast", items: [{ name: "Exact Recipe Name" }] }] }, null, 2)
}

function buildFullWeekSchemaExample(): string {
  return JSON.stringify({ days: [{ dayIndex: 0, meals: [{ slot: "breakfast", items: [{ name: "Exact Recipe Name" }] }] }] }, null, 2)
}

export interface PromptMessage {
  role: "system" | "user"
  content: string
}

export function buildInitialMessages(input: RecipeSelectorInput): PromptMessage[] {
  const slotsLine = input.slots.map((s) => `${s.slot}${s.timeHint ? ` (${s.timeHint})` : ""}`).join(", ")
  const previousDayNote = input.previousWeekLastDayRecipeNames
    ? `\nAvoid repeating these recipes from the previous week's final day where possible: ${Object.values(input.previousWeekLastDayRecipeNames).flat().join(", ")}.`
    : ""

  const userContent = `Client profile: diet type "${input.dietType}", cuisine "${input.cuisine}", ${input.mealCount} meals/day.
Meal slots, in order: ${slotsLine}.
Daily targets (average across the week): ${formatDailyTarget(input.dailyTarget)}.${previousDayNote}

Available recipes (choose ONLY from this list, copying the Name column EXACTLY):
${formatRecipeTable(input.eligibleRecipesForPrompt)}

Compose a full 7-day plan (dayIndex 0 through 6). For each day, assign recipes to every meal slot listed above.

Respond with JSON matching this schema exactly:
${buildFullWeekSchemaExample()}`

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]
}

export function buildDayRetryMessages(input: RecipeSelectorInput, day: GroundedRecipeDay, diagnoses: string[]): PromptMessage[] {
  const slotsLine = input.slots.map((s) => s.slot).join(", ")
  const currentDayDescription = day.meals
    .map((m) => `  ${m.slot}: ${m.items.map((i) => i.recipe.name).join(", ") || "(empty)"}`)
    .join("\n")

  const userContent = `Day ${day.dayIndex} of the plan needs to be regenerated. Here is what was chosen last time and what's wrong with it:
${currentDayDescription}

Problems:
${diagnoses.map((d) => `- ${d}`).join("\n")}

Daily targets: ${formatDailyTarget(input.dailyTarget)}
Meal slots, in order: ${slotsLine}.

Available recipes (choose ONLY from this list, copying the Name column EXACTLY):
${formatRecipeTable(input.eligibleRecipesForPrompt)}

Choose DIFFERENT recipes for day ${day.dayIndex} that address the problems above — a different dish, not a different amount (you never specify amounts).

Respond with JSON matching this schema exactly:
${buildDaySchemaExample()}`

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]
}
