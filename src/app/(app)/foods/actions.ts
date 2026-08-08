"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { foods, type NewFood } from "@/db/schema"
import { requireStaffUser } from "@/lib/counselling/require-staff-user"
import { foodFormSchema, type FoodFormInput } from "./food-schema"

export type { FoodFormInput }

function toRow(input: FoodFormInput): NewFood {
  return {
    nameEn: input.nameEn,
    nameHi: input.nameHi || null,
    exchangeType: input.exchangeType,
    exchangeUnits: input.exchangeUnits,
    servingRawG: input.servingRawG,
    householdMeasure: input.householdMeasure || null,
    regions: input.regions,
    dietTypes: input.dietTypes,
    mealSlots: input.mealSlots,
    allergens: input.allergens,
    tags: input.tags,
    isActive: input.isActive,
    notes: input.notes || null,
  }
}

export async function createFood(input: FoodFormInput) {
  await requireStaffUser()
  const parsed = foodFormSchema.parse(input)
  await db.insert(foods).values(toRow(parsed))
  revalidatePath("/foods")
}

export async function updateFood(id: string, input: FoodFormInput) {
  await requireStaffUser()
  const parsed = foodFormSchema.parse(input)
  await db.update(foods).set(toRow(parsed)).where(eq(foods.id, id))
  revalidatePath("/foods")
}

export async function toggleFoodActive(id: string, isActive: boolean) {
  await requireStaffUser()
  await db.update(foods).set({ isActive }).where(eq(foods.id, id))
  revalidatePath("/foods")
}
