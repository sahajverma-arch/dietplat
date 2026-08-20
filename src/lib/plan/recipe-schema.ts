import { z } from "zod"

/**
 * The LLM's entire output shape is names only — no grams field ever exists
 * anywhere in this schema, at either the initial-selection or day-retry
 * parse path. Every quantity is computed and optimized in code afterward
 * (recipe-balancer.ts) — see CLAUDE.md "THE ONE RULE THAT MATTERS".
 */
export const llmRecipeItemSchema = z.object({ name: z.string().min(1) })
export const llmRecipeMealSchema = z.object({ slot: z.string().min(1), items: z.array(llmRecipeItemSchema).min(1) })
export const llmRecipeDaySchema = z.object({ dayIndex: z.number().int().min(0).max(6), meals: z.array(llmRecipeMealSchema).min(1) })
export const llmRecipeSelectionSchema = z.object({ days: z.array(llmRecipeDaySchema).length(7) })

export type LlmRecipeItem = z.infer<typeof llmRecipeItemSchema>
export type LlmRecipeDay = z.infer<typeof llmRecipeDaySchema>
export type LlmRecipeSelection = z.infer<typeof llmRecipeSelectionSchema>
