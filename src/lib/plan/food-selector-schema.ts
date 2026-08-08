import { z } from "zod"

const llmItemSchema = z.object({
  foodId: z.string().min(1),
  exchangeType: z.string().min(1),
  exchangeCount: z.number().positive(),
})

const llmMealSchema = z.object({
  slot: z.string().min(1),
  items: z.array(llmItemSchema).min(1),
})

const llmDaySchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  meals: z.array(llmMealSchema).min(1),
})

export const llmSelectionSchema = z.object({
  days: z.array(llmDaySchema).length(7),
})

export type LlmSelection = z.infer<typeof llmSelectionSchema>
