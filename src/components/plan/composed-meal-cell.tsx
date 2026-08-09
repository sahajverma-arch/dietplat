import { Fragment } from "react"

import { SwapItemButton } from "./swap-item-button"
import { formatItemQuantity } from "@/lib/plan/format-item"
import { composeMealDisplay } from "@/lib/plan/meal-composition"
import { combineDishGroups } from "@/lib/plan/dish-combination"
import { applyVegetableDishNames } from "@/lib/plan/vegetable-dish-naming"
import type { PlanViewItem } from "@/lib/plan/plan-view-model"
import type { ExchangeCode } from "@/lib/plan/table-4-1"
import type { DishCombination, VegetableDishCombination, VegetableDishCombinationMember } from "@/db/schema"

/**
 * Renders one meal's items grouped into human-readable dishes (see
 * meal-composition.ts, then dish-combination.ts, then
 * vegetable-dish-naming.ts) while keeping every underlying food
 * individually swappable — grouping only changes the surrounding
 * label/brackets, never which item a click targets or what it's swapped
 * against.
 */
export function ComposedMealCell({
  items,
  region,
  editable,
  archetypeName,
  archetypeDishFamilyIdsByExchangeType,
  dishCombinations,
  vegetableDishCombinations,
  vegetableDishCombinationMembers,
}: {
  items: PlanViewItem[]
  region: string
  editable: boolean
  /** Meal's archetypeName from PlanViewMeal — null for meals not generated from a meal_archetype. */
  archetypeName: string | null
  /** Meal's archetypeDishFamilyIdsByExchangeType from PlanViewMeal — see dish-combination.ts's merge gate. */
  archetypeDishFamilyIdsByExchangeType: Partial<Record<ExchangeCode, string[]>>
  dishCombinations: DishCombination[]
  vegetableDishCombinations: VegetableDishCombination[]
  vegetableDishCombinationMembers: VegetableDishCombinationMember[]
}) {
  const groups = applyVegetableDishNames(
    combineDishGroups(
      composeMealDisplay(items, region),
      archetypeName,
      archetypeDishFamilyIdsByExchangeType,
      dishCombinations,
      region
    ),
    vegetableDishCombinations,
    vegetableDishCombinationMembers,
    region
  )

  return (
    <>
      {groups.map((group, gi) => (
        <Fragment key={group.items[0].id}>
          {group.kind === "plain" && <SwapItemButton item={group.items[0]} editable={editable} />}

          {group.kind === "single_dish" && (
            <SwapItemButton
              item={group.items[0]}
              editable={editable}
              label={`${group.dishName} (${formatItemQuantity(group.items[0])})`}
            />
          )}

          {group.kind === "mixed_dish" && (
            <>
              {group.dishName} (
              {group.items.map((item, i) => (
                <Fragment key={item.id}>
                  <SwapItemButton item={item} editable={editable} label={`${item.nameEn} ${formatItemQuantity(item)}`} />
                  {i < group.items.length - 1 ? ", " : ""}
                </Fragment>
              ))}
              )
            </>
          )}

          {gi < groups.length - 1 ? ", " : ""}
        </Fragment>
      ))}
    </>
  )
}
