export const REGIONS = [
  "north_indian",
  "south_indian",
  "punjabi",
  "gujarati",
  "bengali",
  "maharashtrian",
  "rajasthani",
  "hyderabadi",
  "generic",
] as const

// Display labels for the regions a diet plan can actually be generated for
// — everything in REGIONS except "generic", which is a food-tag ("usable in
// any region's plan"), never a plan's own region. Which regions are
// SELECTABLE for generation is a runtime DB fact (meal_templates rows), not
// this list — see availableRegions in the review page. This map only
// supplies a human label once a region is known to be available, so a
// newly-seeded region degrades to its raw slug until someone adds one here
// instead of silently failing to appear.
export const REGION_LABELS: Partial<Record<(typeof REGIONS)[number], string>> = {
  north_indian: "North Indian",
  south_indian: "South Indian (Malayali)",
  punjabi: "Punjabi",
  gujarati: "Gujarati",
  bengali: "Bengali",
  maharashtrian: "Maharashtrian",
  rajasthani: "Rajasthani",
  hyderabadi: "Hyderabadi",
}

export const DIET_TYPES = ["vegetarian", "eggetarian", "non_vegetarian", "vegan", "jain"] as const

export const MEAL_SLOTS = ["breakfast", "mid_morning", "lunch", "evening", "dinner", "bedtime"] as const

export const ALLERGENS = ["peanut", "tree_nut", "dairy", "gluten", "soy", "egg", "fish", "shellfish"] as const

export const TAGS = [
  "high_fibre",
  "low_gi",
  "requires_cooking",
  "travel_friendly",
  "pcos_friendly",
  "thyroid_caution",
] as const
