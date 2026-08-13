import { describe, expect, it } from "vitest"

import { composeMealDisplay, formatComposedGroupPlainText } from "./meal-composition"
import type { PlanViewItem } from "./plan-guidelines"
import type { ExchangeCode } from "./table-4-1"

let counter = 0
function makeItem(overrides: Partial<PlanViewItem> & { nameEn: string; exchangeType: ExchangeCode }): PlanViewItem {
  counter += 1
  return {
    id: overrides.id ?? `item-${counter}`,
    foodId: overrides.foodId ?? `food-${counter}`,
    householdMeasure: null,
    servingRawG: 100,
    exchangeCount: 1,
    kcal: 40,
    proteinG: 1,
    carbsG: 3.5,
    fatG: 0,
    dishFamilyId: null,
    tags: [],
    ...overrides,
  }
}

describe("composeMealDisplay — the exact examples from the spec", () => {
  it("Rajma + Matta Rice + Cabbage + Cauliflower + Potato -> Rajma Curry / Mixed Vegetable Sabzi (...) / Matta Rice", () => {
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", servingRawG: 15 })
    const mattaRice = makeItem({ nameEn: "Matta Rice", exchangeType: "cereal", servingRawG: 60 })
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", servingRawG: 100 })
    const cauliflower = makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a", servingRawG: 100 })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", servingRawG: 75 })

    const groups = composeMealDisplay([rajma, mattaRice, cabbage, cauliflower, potato], "north_indian")
    const labels = groups.map(formatComposedGroupPlainText)

    expect(labels).toEqual(["Rajma Curry (15 g)", "Matta Rice (60 g)", "Mixed Vegetable Sabzi (275 g)"])
  })

  it("Kala Chana + Capsicum + Ash Gourd + Yam + Roti -> Kala Chana Curry / Mixed Vegetable Sabzi (...) / Roti", () => {
    const kalaChana = makeItem({ nameEn: "Kala Chana", exchangeType: "pulse", servingRawG: 15 })
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a", servingRawG: 100 })
    const ashGourd = makeItem({ nameEn: "Ash Gourd", exchangeType: "vegetable_a", servingRawG: 100 })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", servingRawG: 75 })
    const roti = makeItem({ nameEn: "Roti", exchangeType: "cereal", servingRawG: 60 })

    const groups = composeMealDisplay([kalaChana, capsicum, ashGourd, yam, roti], "north_indian")
    expect(groups.map((g) => g.dishName ?? formatComposedGroupPlainText(g))).toEqual([
      "Kala Chana Curry",
      "Mixed Vegetable Sabzi",
      formatComposedGroupPlainText(groups[2]),
    ])
    // Generic "Mixed Vegetable" label: total grams only, no per-vegetable breakdown (see GENERIC_MIXED_VEG_PREFIX).
    expect(formatComposedGroupPlainText(groups[1])).toBe("Mixed Vegetable Sabzi (275 g)")
  })

  it("Moong Dal + Drumstick + Bitter Gourd + Potato + Matta Rice -> Moong Dal Curry / Mixed Vegetable Sabzi (...) / Matta Rice", () => {
    const moongDal = makeItem({ nameEn: "Moong Dal", exchangeType: "pulse", servingRawG: 15 })
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", servingRawG: 100 })
    const bitterGourd = makeItem({ nameEn: "Bitter Gourd", exchangeType: "vegetable_a", servingRawG: 100 })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", servingRawG: 75 })
    const mattaRice = makeItem({ nameEn: "Matta Rice", exchangeType: "cereal", servingRawG: 60 })

    const groups = composeMealDisplay([moongDal, drumstick, bitterGourd, potato, mattaRice], "north_indian")
    expect(formatComposedGroupPlainText(groups[0])).toBe("Moong Dal Curry (15 g)")
    expect(formatComposedGroupPlainText(groups[1])).toBe("Mixed Vegetable Sabzi (275 g)")
    expect(formatComposedGroupPlainText(groups[2])).toBe("Matta Rice (60 g)")
  })
})

describe("composeMealDisplay — single vegetable (no mixed dish)", () => {
  it("a single vegetable becomes '{Name} Sabzi', not a mixed dish with brackets", () => {
    const bhindi = makeItem({ nameEn: "Bhindi", exchangeType: "vegetable_a", servingRawG: 100 })
    const groups = composeMealDisplay([bhindi], "north_indian")
    expect(groups).toEqual([{ kind: "single_dish", dishName: "Bhindi Sabzi", items: [bhindi] }])
    expect(formatComposedGroupPlainText(groups[0])).toBe("Bhindi Sabzi (100 g)")
  })

  it("a single vegetable_b item alone also becomes a single_dish, not a mixed_dish", () => {
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", servingRawG: 75 })
    const groups = composeMealDisplay([potato], "north_indian")
    expect(groups[0].kind).toBe("single_dish")
    expect(groups[0].dishName).toBe("Potato Sabzi")
  })
})

describe("composeMealDisplay — regional naming", () => {
  const cabbage = () => makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a" })
  const cauliflower = () => makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a" })
  const potato = () => makeItem({ nameEn: "Potato", exchangeType: "vegetable_b" })

  it("north_indian uses Sabzi", () => {
    const groups = composeMealDisplay([cabbage(), cauliflower(), potato()], "north_indian")
    expect(groups[0].dishName).toBe("Mixed Vegetable Sabzi")
  })

  it("south_indian uses Thoran", () => {
    const groups = composeMealDisplay([cabbage(), cauliflower(), potato()], "south_indian")
    expect(groups[0].dishName).toBe("Mixed Vegetable Thoran")
  })

  it("maharashtrian uses Bhaji (verified regional term)", () => {
    const groups = composeMealDisplay([cabbage(), cauliflower(), potato()], "maharashtrian")
    expect(groups[0].dishName).toBe("Mixed Vegetable Bhaji")
  })

  it("a region with no specific mapping (e.g. punjabi) falls back to Sabzi rather than an invented term", () => {
    const groups = composeMealDisplay([cabbage(), cauliflower(), potato()], "punjabi")
    expect(groups[0].dishName).toBe("Mixed Vegetable Sabzi")
  })

  it("the same region rule applies to a single-vegetable dish's suffix", () => {
    const bhindi = makeItem({ nameEn: "Bhindi", exchangeType: "vegetable_a" })
    const groups = composeMealDisplay([bhindi], "south_indian")
    expect(groups[0].dishName).toBe("Bhindi Thoran")
  })
})

describe("composeMealDisplay — pulses never merge with each other or with vegetables", () => {
  it("two distinct pulse foods in one meal each get their own Curry dish", () => {
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse" })
    const moongDal = makeItem({ nameEn: "Moong Dal", exchangeType: "pulse" })
    const groups = composeMealDisplay([rajma, moongDal], "north_indian")
    expect(groups).toHaveLength(2)
    expect(groups[0].dishName).toBe("Rajma Curry")
    expect(groups[1].dishName).toBe("Moong Dal Curry")
  })

  it("regional pulse naming falls out of the food's own nameEn for free (Parippu Curry, not a generic 'Dal Curry')", () => {
    const parippu = makeItem({ nameEn: "Parippu", exchangeType: "pulse", servingRawG: 15 })
    const groups = composeMealDisplay([parippu], "south_indian")
    expect(formatComposedGroupPlainText(groups[0])).toBe("Parippu Curry (15 g)")
  })

  it("a pulse food tagged already_named_dish keeps its bare name — no 'Curry' appended", () => {
    const besanCheela = makeItem({ nameEn: "Besan Cheela", exchangeType: "pulse", servingRawG: 30, tags: ["already_named_dish"] })
    const groups = composeMealDisplay([besanCheela], "punjabi")
    expect(groups[0].dishName).toBe("Besan Cheela")
    expect(formatComposedGroupPlainText(groups[0])).toBe("Besan Cheela (30 g)")
  })
})

describe("composeMealDisplay — items unaffected by composition pass through unchanged", () => {
  it("cereal, milk, fruit, fat, sugar, meat all render exactly as formatItemLabel would, one group each", () => {
    const milk = makeItem({ nameEn: "Milk", exchangeType: "milk_cow", servingRawG: 125 })
    const roti = makeItem({ nameEn: "Roti", exchangeType: "cereal", servingRawG: 60 })
    const orange = makeItem({ nameEn: "Orange", exchangeType: "fruit", servingRawG: null, householdMeasure: "1 medium" })
    const ghee = makeItem({ nameEn: "Ghee", exchangeType: "fat", servingRawG: 8 })
    const egg = makeItem({ nameEn: "Egg", exchangeType: "meat", servingRawG: 40 })

    const groups = composeMealDisplay([milk, roti, orange, ghee, egg], "north_indian")
    expect(groups.every((g) => g.kind === "plain")).toBe(true)
    expect(groups.map(formatComposedGroupPlainText)).toEqual([
      "Milk (125 g)",
      "Roti (60 g)",
      "Orange (1 medium)",
      "Ghee (8 g)",
      "Egg (1, 40 g)",
    ])
  })

  it("an empty meal produces an empty group list without throwing", () => {
    expect(composeMealDisplay([], "north_indian")).toEqual([])
  })
})

describe("composeMealDisplay — traceability and nutrition integrity", () => {
  it("every input item is represented in exactly one group's items array — nothing dropped, nothing duplicated", () => {
    const items = [
      makeItem({ nameEn: "Rajma", exchangeType: "pulse" }),
      makeItem({ nameEn: "Matta Rice", exchangeType: "cereal" }),
      makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a" }),
      makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a" }),
      makeItem({ nameEn: "Potato", exchangeType: "vegetable_b" }),
    ]
    const groups = composeMealDisplay(items, "north_indian")
    const allItemIdsInGroups = groups.flatMap((g) => g.items.map((i) => i.id))
    expect(allItemIdsInGroups.sort()).toEqual(items.map((i) => i.id).sort())
  })

  it("the sum of kcal/protein/carbs/fat across every item in every group equals the sum of the original items — grouping never touches nutrition numbers", () => {
    const items = [
      makeItem({ nameEn: "Rajma", exchangeType: "pulse", kcal: 96, proteinG: 7, carbsG: 17, fatG: 0 }),
      makeItem({ nameEn: "Matta Rice", exchangeType: "cereal", kcal: 68, proteinG: 2, carbsG: 15, fatG: 0 }),
      makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", kcal: 18, proteinG: 1, carbsG: 3.5, fatG: 0 }),
      makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a", kcal: 18, proteinG: 1, carbsG: 3.5, fatG: 0 }),
      makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", kcal: 36, proteinG: 2, carbsG: 7, fatG: 0 }),
    ]
    const sumField = (arr: PlanViewItem[], field: keyof PlanViewItem) => arr.reduce((s, i) => s + (i[field] as number), 0)
    const originalTotals = {
      kcal: sumField(items, "kcal"),
      proteinG: sumField(items, "proteinG"),
      carbsG: sumField(items, "carbsG"),
      fatG: sumField(items, "fatG"),
    }

    const groups = composeMealDisplay(items, "north_indian")
    const groupedItems = groups.flatMap((g) => g.items)
    const groupedTotals = {
      kcal: sumField(groupedItems, "kcal"),
      proteinG: sumField(groupedItems, "proteinG"),
      carbsG: sumField(groupedItems, "carbsG"),
      fatG: sumField(groupedItems, "fatG"),
    }

    expect(groupedTotals).toEqual(originalTotals)
  })

  it("each grouped item's own kcal/protein/carbs/fat values are untouched (not recomputed, not scaled)", () => {
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", kcal: 18, proteinG: 1, carbsG: 3.5, fatG: 0 })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", kcal: 36, proteinG: 2, carbsG: 7, fatG: 0 })
    const groups = composeMealDisplay([cabbage, potato], "north_indian")
    expect(groups[0].items).toEqual([cabbage, potato])
  })
})

describe("composeMealDisplay — salad-tagged vegetables are kept out of the cooked sabzi pool", () => {
  it("the reported case: Beetroot no longer gets lumped into Capsicum/Tomato/Onion/Potato", () => {
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a" })
    const tomato = makeItem({ nameEn: "Tomato", exchangeType: "vegetable_a" })
    const onion = makeItem({ nameEn: "Onion", exchangeType: "vegetable_b", tags: ["salad"] })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b" })
    const beetroot = makeItem({ nameEn: "Beetroot", exchangeType: "vegetable_b", tags: ["requires_cooking", "salad"] })

    const groups = composeMealDisplay([capsicum, tomato, onion, potato, beetroot], "punjabi")
    const labels = groups.map((g) => g.dishName)

    expect(labels).toEqual(["Mixed Vegetable Sabzi", "Salad"])
    expect(groups[0].items.map((i) => i.nameEn)).toEqual(["Capsicum", "Tomato", "Potato"])
    expect(groups[1].items.map((i) => i.nameEn)).toEqual(["Onion", "Beetroot"])
  })

  it("a single salad item becomes '{Name} Salad', not '{Name} Sabzi'", () => {
    const cucumber = makeItem({ nameEn: "Cucumber", exchangeType: "vegetable_a", tags: ["salad"] })
    const groups = composeMealDisplay([cucumber], "punjabi")
    expect(groups).toEqual([{ kind: "single_dish", dishName: "Cucumber Salad", items: [cucumber] }])
  })

  it("multiple salad items become one 'Salad (...)' mixed_dish, not 'Mixed Vegetable Sabzi'", () => {
    const cucumber = makeItem({ nameEn: "Cucumber", exchangeType: "vegetable_a", tags: ["salad"], servingRawG: 100 })
    const onion = makeItem({ nameEn: "Onion", exchangeType: "vegetable_b", tags: ["salad"], servingRawG: 50 })
    const groups = composeMealDisplay([cucumber, onion], "punjabi")
    expect(groups).toEqual([{ kind: "mixed_dish", dishName: "Salad", items: [cucumber, onion] }])
    expect(formatComposedGroupPlainText(groups[0])).toBe("Salad (Cucumber 100 g, Onion 50 g)")
  })

  it("a day with only salad vegetables (no cooked ones) emits just the salad group", () => {
    const beetroot = makeItem({ nameEn: "Beetroot", exchangeType: "vegetable_b", tags: ["salad"] })
    const groups = composeMealDisplay([beetroot], "punjabi")
    expect(groups).toEqual([{ kind: "single_dish", dishName: "Beetroot Salad", items: [beetroot] }])
  })

  it("a day with only cooked vegetables (no salad ones) is unaffected — same as before this change", () => {
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a" })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b" })
    const groups = composeMealDisplay([capsicum, potato], "punjabi")
    expect(groups).toEqual([{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [capsicum, potato] }])
  })

  it("salad items never merge with pulse or other exchange types", () => {
    const dal = makeItem({ nameEn: "Moong Dal", exchangeType: "pulse" })
    const cucumber = makeItem({ nameEn: "Cucumber", exchangeType: "vegetable_a", tags: ["salad"] })
    const groups = composeMealDisplay([dal, cucumber], "punjabi")
    expect(groups).toHaveLength(2)
    expect(groups[0].dishName).toBe("Moong Dal Curry")
    expect(groups[1].dishName).toBe("Cucumber Salad")
  })
})

describe("composeMealDisplay — order preservation", () => {
  it("emits each group at the position of the first item it consumes, preserving original left-to-right order", () => {
    const milk = makeItem({ nameEn: "Milk", exchangeType: "milk_cow" })
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse" })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b" })
    const roti = makeItem({ nameEn: "Roti", exchangeType: "cereal" })

    // Milk, [vegetable group starts here], Rajma, [vegetable group continues], Roti
    const groups = composeMealDisplay([milk, cabbage, rajma, potato, roti], "north_indian")
    const kinds = groups.map((g) => g.dishName ?? g.items[0].nameEn)
    expect(kinds).toEqual(["Milk", "Mixed Vegetable Sabzi", "Rajma Curry", "Roti"])
  })
})

describe("formatComposedGroupPlainText — generic 'Mixed Vegetable' shows total grams only, no per-vegetable breakdown", () => {
  it("collapses a generic Mixed Vegetable Sabzi group to '{dishName} ({totalGrams} g)'", () => {
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a", servingRawG: 100 })
    const tomato = makeItem({ nameEn: "Tomato", exchangeType: "vegetable_a", servingRawG: 100 })
    const group = { kind: "mixed_dish" as const, dishName: "Mixed Vegetable Sabzi", items: [capsicum, tomato] }
    expect(formatComposedGroupPlainText(group)).toBe("Mixed Vegetable Sabzi (200 g)")
  })

  it("still shows the per-vegetable breakdown for a curated named combo (e.g. Aloo Gobi) — only the generic label collapses", () => {
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", servingRawG: 75 })
    const gobi = makeItem({ nameEn: "Gobi", exchangeType: "vegetable_a", servingRawG: 100 })
    const group = { kind: "mixed_dish" as const, dishName: "Aloo Gobi", items: [potato, gobi] }
    expect(formatComposedGroupPlainText(group)).toBe("Aloo Gobi (Potato 75 g, Gobi 100 g)")
  })

  it("regional 'Mixed Vegetable {word}' labels (Bhaji, Thoran) also collapse — the rule is prefix-based, not English-only", () => {
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", servingRawG: 100 })
    const cauliflower = makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a", servingRawG: 100 })
    const group = { kind: "mixed_dish" as const, dishName: "Mixed Vegetable Bhaji", items: [cabbage, cauliflower] }
    expect(formatComposedGroupPlainText(group)).toBe("Mixed Vegetable Bhaji (200 g)")
  })
})
