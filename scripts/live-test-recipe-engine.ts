/**
 * Dev-only tool: exercises selectRecipes() end-to-end against a real
 * roadmap and real NVIDIA calls, without going through the HTTP route (no
 * auth/session plumbing needed). Useful for the real prompt/model tuning
 * work CLAUDE.md's "The recipe engine" section flags as still open — run
 * with a roadmap id and optionally a cuisine:
 *   npx tsx --env-file=.env.local scripts/live-test-recipe-engine.ts <roadmapId> ["North Indian"]
 * Never imported by production code.
 */
import { eq, and, inArray } from "drizzle-orm"

import { db } from "../src/db"
import { clients, counsellingSessions, mealTemplates, recipeAliases, recipes, roadmaps } from "../src/db/schema"
import type { Answers } from "../src/lib/counselling/questions"
import { weekTargets, type RoadmapResult } from "../src/lib/counselling/roadmap"
import { clientRecipeAllergenTagsFromAnswers, dietTypeFromAnswers } from "../src/lib/plan/client-profile-from-answers"
import { eligibleCuisinesFor, templateRegionForCuisine, type RecipeCuisine } from "../src/lib/foods/recipe-cuisine-mapping"
import { selectRecipes, RecipeSelectionRejectedError } from "../src/lib/plan/recipe-selector"
import type { ClientRecipeConstraints } from "../src/lib/plan/recipe-plausibility-validate"
import type { DailyRecipeTarget, MealSlotInfo, RecipeForPrompt, RecipeSelectorInput } from "../src/lib/plan/recipe-types"
import { seasonFor } from "../src/lib/plan/season"

async function main() {
  const roadmapId = process.argv[2]
  const cuisine = (process.argv[3] ?? "North Indian") as RecipeCuisine
  const mealCount = 5

  const [roadmapRow] = await db.select().from(roadmaps).where(eq(roadmaps.id, roadmapId)).limit(1)
  if (!roadmapRow) throw new Error("roadmap not found")
  const [sessionRow] = await db
    .select({ session: counsellingSessions, client: clients })
    .from(counsellingSessions)
    .innerJoin(clients, eq(counsellingSessions.clientId, clients.id))
    .where(eq(counsellingSessions.id, roadmapRow.sessionId))
    .limit(1)
  if (!sessionRow) throw new Error("session not found")
  const { session, client } = sessionRow

  console.log(`Client: ${client.name}`)

  const roadmapOutput = roadmapRow.output as RoadmapResult
  const dailyTarget = weekTargets(roadmapOutput, 1)
  const dietType = dietTypeFromAnswers(session.answers as Answers)
  console.log(`Diet type: ${dietType}`)
  console.log(`Daily target: kcal=${dailyTarget.kcal.toFixed(0)} protein=${dailyTarget.proteinG.toFixed(1)} carbs=${dailyTarget.carbsG.toFixed(1)} fat=${dailyTarget.fatG.toFixed(1)} fibre=${dailyTarget.fibreG.toFixed(1)}`)

  const templateRegion = templateRegionForCuisine(cuisine)
  const season = seasonFor(new Date().toISOString().slice(0, 10), cuisine)
  const slotRows = await db
    .select({ slot: mealTemplates.slot, slotOrder: mealTemplates.slotOrder, timeHint: mealTemplates.timeHint })
    .from(mealTemplates)
    .where(and(eq(mealTemplates.region, templateRegion), eq(mealTemplates.mealCount, mealCount)))
  const slots: MealSlotInfo[] = slotRows.map((r) => ({ slot: r.slot, slotOrder: r.slotOrder, timeHint: r.timeHint }))
  console.log(`Slots: ${slots.map((s) => s.slot).join(", ")}`)
  console.log(`Season: ${season}`)

  const eligibleCuisines = eligibleCuisinesFor(cuisine)
  const cuisineRows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.isActive, true), inArray(recipes.cuisine, eligibleCuisines)))
  const clientRecipeAllergenTags = clientRecipeAllergenTagsFromAnswers(session.answers as Answers)
  const filtered = cuisineRows.filter(
    (r) =>
      r.dietTypes.includes(dietType) &&
      (r.season === "all_year" || r.season === season) &&
      !r.allergenTags.some((t) => clientRecipeAllergenTags.includes(t))
  )
  console.log(`Eligible recipe pool: ${filtered.length} / ${cuisineRows.length} cuisine-matched / ${await db.$count(recipes)} total`)

  const eligibleRecipesForPrompt: RecipeForPrompt[] = filtered.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    mainOrMid: r.mainOrMid as "main" | "mid",
    cuisine: r.cuisine,
    macroCategory: r.macroCategory,
    commonality: r.commonality,
    proteinPer100G: r.proteinPer100G,
    carbsPer100G: r.carbsPer100G,
    fatPer100G: r.fatPer100G,
    fiberPer100G: r.fiberPer100G,
    kcalPer100G: r.kcalPer100G,
  }))

  const aliasRows = await db
    .select({ recipeId: recipeAliases.recipeId, alias: recipeAliases.alias })
    .from(recipeAliases)
    .where(
      inArray(
        recipeAliases.recipeId,
        filtered.map((r) => r.id)
      )
    )

  const dailyRecipeTarget: DailyRecipeTarget = {
    kcal: dailyTarget.kcal,
    proteinG: dailyTarget.proteinG,
    carbsG: dailyTarget.carbsG,
    fatG: dailyTarget.fatG,
    fiberG: dailyTarget.fibreG,
  }

  const input: RecipeSelectorInput = {
    cuisine,
    dietType,
    mealCount,
    dailyTarget: dailyRecipeTarget,
    slots,
    eligibleRecipesForPrompt,
    allRecipesById: new Map(filtered.map((r) => [r.id, r])),
    eligibleCuisines,
    clientAllergenTags: clientRecipeAllergenTags,
    aliasRows,
  }
  const constraints: ClientRecipeConstraints = { dietType, eligibleCuisines, allergenTags: clientRecipeAllergenTags }

  console.log("\nCalling selectRecipes()...")
  const startedAt = Date.now()
  try {
    const result = await selectRecipes(input, constraints, {
      onAttempt: (log) => console.log(`  attempt#${log.attemptNumber} day=${log.dayIndex ?? "week"} ok=${log.validationResult.ok} errors=${JSON.stringify(log.validationResult.errors).slice(0, 200)} latency=${log.latencyMs}ms`),
    })
    console.log(`\nDone in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
    console.log(`generationMode=${result.generationMode} modelUsed=${result.modelUsed} attempts=${result.attempts}`)
    console.log(`warnings: ${JSON.stringify(result.warnings)}`)

    const days = result.selection.days
    const weeklyAvg = {
      kcal: days.reduce((s, d) => s + d.totals.kcal, 0) / days.length,
      proteinG: days.reduce((s, d) => s + d.totals.proteinG, 0) / days.length,
      carbsG: days.reduce((s, d) => s + d.totals.carbsG, 0) / days.length,
      fatG: days.reduce((s, d) => s + d.totals.fatG, 0) / days.length,
      fiberG: days.reduce((s, d) => s + d.totals.fiberG, 0) / days.length,
    }
    console.log(`\nWeekly average achieved: kcal=${weeklyAvg.kcal.toFixed(0)} protein=${weeklyAvg.proteinG.toFixed(1)} carbs=${weeklyAvg.carbsG.toFixed(1)} fat=${weeklyAvg.fatG.toFixed(1)} fiber=${weeklyAvg.fiberG.toFixed(1)}`)
    console.log(`Target:                  kcal=${dailyRecipeTarget.kcal.toFixed(0)} protein=${dailyRecipeTarget.proteinG.toFixed(1)} carbs=${dailyRecipeTarget.carbsG.toFixed(1)} fat=${dailyRecipeTarget.fatG.toFixed(1)} fiber=${dailyRecipeTarget.fiberG.toFixed(1)}`)
    console.log(
      `Deviation %: kcal=${((Math.abs(weeklyAvg.kcal - dailyRecipeTarget.kcal) / dailyRecipeTarget.kcal) * 100).toFixed(1)} protein=${((Math.abs(weeklyAvg.proteinG - dailyRecipeTarget.proteinG) / dailyRecipeTarget.proteinG) * 100).toFixed(1)} carbs=${((Math.abs(weeklyAvg.carbsG - dailyRecipeTarget.carbsG) / dailyRecipeTarget.carbsG) * 100).toFixed(1)} fat=${((Math.abs(weeklyAvg.fatG - dailyRecipeTarget.fatG) / dailyRecipeTarget.fatG) * 100).toFixed(1)}`
    )

    console.log("\n=== Day 0 sample ===")
    for (const meal of days[0].meals) {
      console.log(`  ${meal.slot}: ${meal.items.map((i) => `${i.recipe.name} (${i.grams}g)`).join(", ") || "(empty)"}`)
    }
  } catch (err) {
    if (err instanceof RecipeSelectionRejectedError) {
      console.log(`\nREJECTED: ${err.message}`)
      for (const dp of err.dayProblems) {
        console.log(`  Day ${dp.dayIndex}:`)
        dp.problems.forEach((p) => console.log(`    - ${p}`))
      }
    } else {
      throw err
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
