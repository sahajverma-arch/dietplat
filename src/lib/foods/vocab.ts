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

// Four buckets, deliberately not finer — India's diet-relevant seasonal
// shift doesn't need more granularity than this for eligibility purposes.
// "all_year" always passes the eligibility filter regardless of the
// calendar (see eligible-foods.ts) — it's the default every food gets
// unless explicitly retagged.
export const SEASONS = ["summer", "monsoon", "winter", "all_year"] as const
export type Season = (typeof SEASONS)[number]

export const TAGS = [
  "high_fibre",
  "low_gi",
  "requires_cooking",
  "travel_friendly",
  "pcos_friendly",
  "thyroid_caution",
  // Raw/salad-style vegetable, kept out of the cooked "Mixed Vegetable
  // Sabzi" pool at display time — see meal-composition.ts. A food's
  // existing `seasons` tag already governs WHEN it's eligible at all, so a
  // winter-only food tagged salad (e.g. Radish, Carrot) is only ever
  // treated as a salad item during the season it can appear in — no
  // separate season-conditional salad logic needed.
  "salad",
  // Gourd-family vegetables (Karela, Lauki, Brinjal, Tori and their
  // regional aliases) that are always their own single dish in real
  // cooking — Karela Sabzi, Lauki Sabzi, Baingan Bharta — never randomly
  // combined with an unrelated vegetable into a "mixed veg". Excluded from
  // the "mixed veg" combo pool in food-selector-fallback.ts; still free to
  // appear on its own, at whatever count the day needs, and still free to
  // pair with vegetable_b (e.g. Aloo Baingan) since that's a different,
  // curated-name mechanism, not the "mixed veg" pool this tag guards.
  "solo_only",
] as const
