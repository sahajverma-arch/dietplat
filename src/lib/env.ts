import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NVIDIA_API_KEY: z.string().min(1),
  NVIDIA_MODEL: z.string().min(1),
  // Global kill switch for the Meal Archetype layer (archetype-selector.ts).
  // Defaults enabled — set to "false" to force archetypeSelectorEnabled to
  // false everywhere, independent of what's seeded in meal_archetypes, as a
  // fast full-rollback path distinct from deleting archetype data.
  ARCHETYPE_SELECTION_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  // Rollout flag for the recipe engine (see CLAUDE.md "The recipe engine")
  // — defaults OFF, opposite polarity to ARCHETYPE_SELECTION_ENABLED
  // intentionally: this is a new, unproven pipeline, not an established one
  // being rolled back. Route.ts branches on this immediately after
  // weekTargets() is computed. Replaces the deleted dish-gram engine's own
  // DISH_ENGINE_ENABLED flag.
  RECIPE_ENGINE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Rollout flag for the Dietitian Knowledge RAG layer (see CLAUDE.md
  // "Dietitian knowledge layer") — defaults OFF, same polarity/reasoning as
  // RECIPE_ENGINE_ENABLED: a new, unproven layer on top of an already
  // convergence-fragile 8B model, not an established one being rolled back.
  // Independent of RECIPE_ENGINE_ENABLED — both must be on for knowledge
  // retrieval to actually run, since it only wires into the recipe engine.
  DIETITIAN_KNOWLEDGE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Rollout flag for the Diet Plan Examples RAG layer (see CLAUDE.md "Diet
  // plan examples layer") — defaults OFF, same reasoning as
  // DIETITIAN_KNOWLEDGE_ENABLED: a second, unproven layer on an already
  // convergence-fragile 8B model. Independent of DIETITIAN_KNOWLEDGE_ENABLED
  // so each layer's real impact can be isolated in testing — both still
  // require RECIPE_ENGINE_ENABLED to mean anything.
  DIET_PLAN_EXAMPLES_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
})

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  NVIDIA_MODEL: process.env.NVIDIA_MODEL,
  ARCHETYPE_SELECTION_ENABLED: process.env.ARCHETYPE_SELECTION_ENABLED,
  RECIPE_ENGINE_ENABLED: process.env.RECIPE_ENGINE_ENABLED,
  DIETITIAN_KNOWLEDGE_ENABLED: process.env.DIETITIAN_KNOWLEDGE_ENABLED,
  DIET_PLAN_EXAMPLES_ENABLED: process.env.DIET_PLAN_EXAMPLES_ENABLED,
})

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`
  )
}

export const env = parsed.data
