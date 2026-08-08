import { z } from "zod"

import { ALLERGENS, DIET_TYPES, MEAL_SLOTS, REGIONS, TAGS } from "@/lib/foods/vocab"

// Matches ExchangeCode in src/lib/plan/table-4-1.ts. exchange_types is
// "read-only at runtime" (CLAUDE.md "The exchange system"), so hardcoding
// these here isn't a maintenance hazard the way it would be for a table
// that actually changes — it mirrors table-4-1.ts's own hardcoded union.
const EXCHANGE_CODES = [
  "milk_cow",
  "milk_skim",
  "meat",
  "meat_lean",
  "pulse",
  "cereal",
  "vegetable_a",
  "vegetable_b",
  "fruit",
  "fat",
  "sugar",
] as const

/**
 * Loosely typed — this is the client form's working state, which
 * legitimately holds transient/incomplete values while a dietitian is
 * still filling it in (e.g. exchangeType: "" before a selection is made).
 * foodFormSchema below is the actual enforcement boundary, applied once in
 * the Server Action, not a type derived from it.
 */
export interface FoodFormInput {
  nameEn: string
  nameHi?: string
  exchangeType: string
  exchangeUnits: number
  /** Null for fruit — Table 4.1 defines fruit's raw amount as variable. */
  servingRawG: number | null
  householdMeasure?: string
  regions: string[]
  dietTypes: string[]
  mealSlots: string[]
  allergens: string[]
  tags: string[]
  isActive: boolean
  notes?: string
}

/**
 * The admin UI's own widgets (Select/ChipCheckboxGroup) are already
 * constrained to these vocabularies, so a well-behaved form submission
 * never trips this — but a Server Action is reachable directly, bypassing
 * the UI entirely (same reasoning as requireStaffUser's own doc comment),
 * so the boundary needs its own validation regardless of what the UI sends.
 */
export const foodFormSchema = z.object({
  nameEn: z.string().trim().min(1, "Name is required"),
  nameHi: z.string().trim().optional(),
  exchangeType: z.enum(EXCHANGE_CODES),
  exchangeUnits: z.number().positive(),
  servingRawG: z.number().positive().nullable(),
  householdMeasure: z.string().trim().optional(),
  regions: z.array(z.enum(REGIONS)).min(1, "At least one region is required"),
  dietTypes: z.array(z.enum(DIET_TYPES)).min(1, "At least one diet type is required"),
  mealSlots: z.array(z.enum(MEAL_SLOTS)).min(1, "At least one meal slot is required"),
  allergens: z.array(z.enum(ALLERGENS)),
  tags: z.array(z.enum(TAGS)),
  isActive: z.boolean(),
  notes: z.string().trim().optional(),
})

export type ValidatedFoodFormInput = z.infer<typeof foodFormSchema>
