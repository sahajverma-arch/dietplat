import { pgTable, uuid, text, timestamp, jsonb, numeric, integer, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default("dietitian"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

export const counsellingSessions = pgTable("counselling_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["quick", "full"] }).notNull(),
  status: text("status", { enum: ["draft", "submitted", "reviewed"] })
    .notNull()
    .default("draft"),
  answers: jsonb("answers").notNull().default({}),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
})

export type CounsellingSession = typeof counsellingSessions.$inferSelect
export type NewCounsellingSession = typeof counsellingSessions.$inferInsert

/** Roadmap snapshots are immutable — recomputation creates a new row, never an update. */
export const roadmaps = pgTable("roadmaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => counsellingSessions.id, { onDelete: "cascade" }),
  engineVersion: text("engine_version").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Roadmap = typeof roadmaps.$inferSelect
export type NewRoadmap = typeof roadmaps.$inferInsert

/** Records a dietitian's explicit override of a block-level roadmap flag. The roadmap row is never mutated. */
export const roadmapOverrides = pgTable("roadmap_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapId: uuid("roadmap_id")
    .notNull()
    .references(() => roadmaps.id, { onDelete: "cascade" }),
  flagCode: text("flag_code").notNull(),
  reason: text("reason").notNull(),
  dietitianName: text("dietitian_name").notNull(),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type RoadmapOverride = typeof roadmapOverrides.$inferSelect
export type NewRoadmapOverride = typeof roadmapOverrides.$inferInsert

/** Table 4.1 — Comprehensive Food Exchange List (11 rows). READ-ONLY at runtime. See CLAUDE.md "The exchange system". */
export const exchangeTypes = pgTable("exchange_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull(),
  proteinG: numeric("protein_g", { mode: "number" }).notNull(),
  carbsG: numeric("carbs_g", { mode: "number" }).notNull(),
  fatG: numeric("fat_g", { mode: "number" }).notNull(),
  fiberG: numeric("fiber_g", { mode: "number" }).notNull().default(0),
  // Postgres-generated column (protein_g*4 + carbs_g*4 + fat_g*9) — never
  // written to directly, so Drizzle must be told it's generated or it will
  // try to INSERT a value into it and Postgres will reject the query.
  kcal: numeric("kcal", { mode: "number" }).generatedAlwaysAs(
    sql`round(protein_g * 4 + carbs_g * 4 + fat_g * 9, 1)`
  ),
  standardServing: text("standard_serving").notNull(),
  notes: text("notes"),
})

export type ExchangeType = typeof exchangeTypes.$inferSelect

export const foods = pgTable("foods", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameEn: text("name_en").notNull(),
  nameHi: text("name_hi"),
  exchangeType: text("exchange_type")
    .notNull()
    .references(() => exchangeTypes.code),
  exchangeUnits: numeric("exchange_units", { mode: "number" }).notNull().default(1),
  // Nullable: Table 4.1 defines fruit's raw amount as variable — the
  // household_measure ("1 medium") carries the real-world portion instead.
  servingRawG: numeric("serving_raw_g", { mode: "number" }),
  householdMeasure: text("household_measure"),
  regions: text("regions").array().notNull().default([]),
  dietTypes: text("diet_types").array().notNull().default([]),
  mealSlots: text("meal_slots").array().notNull().default([]),
  allergens: text("allergens").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Nullable — most foods (generic sides, fruit, fat) never need one; only
  // foods that serve as a meal-archetype component do. See dish_families
  // below and CLAUDE.md-adjacent design doc "Meal Archetype + Dish
  // Composition layer". Postgres enforces at write time (a trigger) that
  // this can only reference a dish_family whose own exchange_type matches
  // this food's exchangeType.
  dishFamilyId: uuid("dish_family_id").references(() => dishFamilies.id),
})

export type Food = typeof foods.$inferSelect
export type NewFood = typeof foods.$inferInsert

/**
 * A small, closed vocabulary identifying a specific dish identity (e.g.
 * "sambar"), same pattern as exchangeTypes. archetype_components point at
 * a SET of these — never a raw exchange type, never a free-text tag — so
 * the eligible pool for one archetype's role can never silently admit an
 * unrelated dish of the same exchange type (Idli-Sambar's pulse role
 * pointing at the "sambar" family excludes Masoor Dal/Kala Chana/Moong Dal
 * structurally, not by curation discipline alone).
 */
export const dishFamilies = pgTable("dish_families", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  exchangeType: text("exchange_type")
    .notNull()
    .references(() => exchangeTypes.code),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type DishFamily = typeof dishFamilies.$inferSelect

/**
 * A named, curator-approved COMPLETE meal (e.g. "Idli-Sambar"), not a
 * single dish — see the "Complete Meal Identity" design decision. Region-
 * and slot-scoped; meal_templates (the exchange-count skeleton shape)
 * stays completely untouched by this — an archetype only narrows which
 * foods are eligible to fill a slot the existing pipeline already solved.
 */
export const mealArchetypes = pgTable("meal_archetypes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  slot: text("slot").notNull(),
  dietTypes: text("diet_types").array().notNull().default([]),
  // 0-1, curator-assigned — weights rotation frequency only, never a hard
  // eligibility filter. See archetype-selector.ts.
  authenticityScore: numeric("authenticity_score", { mode: "number" }).notNull().default(1.0),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type MealArchetype = typeof mealArchetypes.$inferSelect

/** The named roles within an archetype (e.g. "lentil curry"), each pointing at one or more dish_families. */
export const archetypeComponents = pgTable("archetype_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  archetypeId: uuid("archetype_id")
    .notNull()
    .references(() => mealArchetypes.id, { onDelete: "cascade" }),
  // Display label only (e.g. "Lentil curry") — NOT the matching key.
  componentRole: text("component_role").notNull(),
  // A SET of acceptable families, not one — lets one archetype (e.g.
  // "Everyday North Indian Thali") accept any of several dals for its
  // pulse role, while rigid-pairing cuisines keep this to a single family.
  dishFamilyIds: uuid("dish_family_ids").array().notNull().default([]),
  // Redundant with dishFamilies.exchangeType by construction — a second,
  // cheap integrity check at archetype-authoring time.
  exchangeType: text("exchange_type")
    .notNull()
    .references(() => exchangeTypes.code),
  componentOrder: integer("component_order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  notes: text("notes"),
})

export type ArchetypeComponent = typeof archetypeComponents.$inferSelect

/**
 * Dish Composition Layer, stage 2 — combines an already-composed cereal
 * group with an already-composed pulse dish into one named combo (e.g.
 * "Rajma Chawal") for meals with no meal_archetype driving the pairing.
 * Reuses dish_families as its matching key, same pattern as
 * archetype_components. See src/lib/plan/dish-combination.ts.
 */
export const dishCombinations = pgTable("dish_combinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  displayName: text("display_name").notNull(),
  primaryDishFamilyId: uuid("primary_dish_family_id")
    .notNull()
    .references(() => dishFamilies.id),
  secondaryDishFamilyId: uuid("secondary_dish_family_id")
    .notNull()
    .references(() => dishFamilies.id),
  region: text("region"),
  isActive: boolean("is_active").notNull().default(true),
})

export type DishCombination = typeof dishCombinations.$inferSelect

/**
 * Dish Composition Layer, stage 3 — names a curated SET of 2+ vegetables
 * (e.g. Drumstick + Ash gourd + Yam -> "Avial") that meal-composition.ts's
 * vegetable pooling would otherwise always render as the generic "Mixed
 * Vegetable {RegionWord}". Unlike dish_combinations (a fixed cereal+pulse
 * PAIR, two FK columns), a vegetable dish can have 2-4 members and the
 * pool of candidate vegetables varies day to day, so membership is a
 * separate join table (vegetable_dish_combination_members) rather than
 * fixed columns. See src/lib/plan/vegetable-dish-naming.ts.
 */
export const vegetableDishCombinations = pgTable("vegetable_dish_combinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  displayName: text("display_name").notNull(),
  region: text("region"),
  isActive: boolean("is_active").notNull().default(true),
})

export type VegetableDishCombination = typeof vegetableDishCombinations.$inferSelect

export const vegetableDishCombinationMembers = pgTable("vegetable_dish_combination_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  vegetableDishCombinationId: uuid("vegetable_dish_combination_id")
    .notNull()
    .references(() => vegetableDishCombinations.id, { onDelete: "cascade" }),
  dishFamilyId: uuid("dish_family_id")
    .notNull()
    .references(() => dishFamilies.id),
})

export type VegetableDishCombinationMember = typeof vegetableDishCombinationMembers.$inferSelect

export const mealTemplates = pgTable("meal_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  region: text("region").notNull(),
  mealCount: integer("meal_count").notNull(),
  slot: text("slot").notNull(),
  slotOrder: integer("slot_order").notNull(),
  timeHint: text("time_hint"),
  kcalShare: numeric("kcal_share", { mode: "number" }).notNull(),
  allowedExchangeTypes: text("allowed_exchange_types").array().notNull().default([]),
  minItems: integer("min_items").notNull().default(1),
  maxItems: integer("max_items").notNull().default(4),
})

export type MealTemplate = typeof mealTemplates.$inferSelect

/**
 * The AI (Prompt 7) only ever picks which food fills a slot — every number
 * here (exchange counts, grams, macros) is computed in code, never trusted
 * from the model.
 */
export const dietPlans = pgTable("diet_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  roadmapId: uuid("roadmap_id")
    .notNull()
    .references(() => roadmaps.id),
  weekNumber: integer("week_number").notNull(),
  weekStart: text("week_start").notNull(), // date, stored as ISO string
  weekEnd: text("week_end").notNull(),
  // Snapshotted, not re-derived: region has no other source (a dietitian
  // choice made at generation time), and dietType — though re-derivable from
  // counselling_sessions.answers — must not silently change if the client's
  // answers are edited after this plan was generated.
  region: text("region").notNull(),
  dietType: text("diet_type").notNull(),
  targets: jsonb("targets").notNull(),
  achieved: jsonb("achieved").notNull(),
  deviation: jsonb("deviation").notNull(),
  generationMode: text("generation_mode", { enum: ["ai", "fallback"] }).notNull(),
  modelUsed: text("model_used"),
  preparedBy: uuid("prepared_by").references(() => profiles.id),
  status: text("status", { enum: ["draft", "approved"] })
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type DietPlan = typeof dietPlans.$inferSelect
export type NewDietPlan = typeof dietPlans.$inferInsert

export const dietPlanDays = pgTable("diet_plan_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  dietPlanId: uuid("diet_plan_id")
    .notNull()
    .references(() => dietPlans.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index").notNull(),
  date: text("date").notNull(),
  achieved: jsonb("achieved").notNull(),
})

export type DietPlanDay = typeof dietPlanDays.$inferSelect
export type NewDietPlanDay = typeof dietPlanDays.$inferInsert

export const dietPlanMeals = pgTable("diet_plan_meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  dietPlanDayId: uuid("diet_plan_day_id")
    .notNull()
    .references(() => dietPlanDays.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  slotOrder: integer("slot_order").notNull(),
  // Observability only — never read by nutrition math. Nullable, set null
  // on archetype deletion so retiring an archetype can't corrupt history.
  archetypeId: uuid("archetype_id").references(() => mealArchetypes.id, { onDelete: "set null" }),
})

export type DietPlanMeal = typeof dietPlanMeals.$inferSelect
export type NewDietPlanMeal = typeof dietPlanMeals.$inferInsert

export const dietPlanItems = pgTable("diet_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  dietPlanMealId: uuid("diet_plan_meal_id")
    .notNull()
    .references(() => dietPlanMeals.id, { onDelete: "cascade" }),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id),
  exchangeType: text("exchange_type")
    .notNull()
    .references(() => exchangeTypes.code),
  exchangeCount: numeric("exchange_count", { mode: "number" }).notNull(),
  /** Null for fruit — Table 4.1 defines fruit's raw amount as variable. */
  servingRawG: numeric("serving_raw_g", { mode: "number" }),
})

export type DietPlanItem = typeof dietPlanItems.$inferSelect
export type NewDietPlanItem = typeof dietPlanItems.$inferInsert

/** Every generation attempt — you will need this the first time a dietitian says "the plan looks wrong". */
export const planGenerationRuns = pgTable("plan_generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  roadmapId: uuid("roadmap_id")
    .notNull()
    .references(() => roadmaps.id),
  weekNumber: integer("week_number").notNull(),
  dietPlanId: uuid("diet_plan_id").references(() => dietPlans.id, { onDelete: "set null" }),
  attemptNumber: integer("attempt_number").notNull(),
  model: text("model"),
  promptHash: text("prompt_hash").notNull(),
  rawResponse: text("raw_response"),
  validationResult: jsonb("validation_result").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type PlanGenerationRun = typeof planGenerationRuns.$inferSelect
export type NewPlanGenerationRun = typeof planGenerationRuns.$inferInsert

/** One row per POST /api/plan/generate call (not per LLM attempt) — backs the Postgres-counter rate limit. See rate-limit.ts. */
export const planGenerationRequests = pgTable("plan_generation_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type PlanGenerationRequest = typeof planGenerationRequests.$inferSelect
