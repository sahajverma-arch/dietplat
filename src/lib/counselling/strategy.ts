/**
 * Calorie strategy by q76 counselling category. Source: Diet Engine
 * Handbook v1.1 §4 + §6.4 (adaptation tests) and Worked Examples v1.2,
 * one worked category per section (§3 of each).
 */

import type { Category, RoadmapFlag } from "./types"

export interface StrategyPhase {
  label: string
  weekFrom: number
  /** null = this phase runs onward (no end week). */
  weekTo: number | null
  /** null = no numeric target yet for this phase (e.g. the weighed-logging gate). */
  kcal: number | null
  why: string
}

export interface StrategyInput {
  category: Category
  tdee: number
  bmr: number
  /** Omit if no measured food day exists yet. */
  currentIntakeKcal?: number
  /** Category 2 only. */
  weeksOnPlan?: number
  /** Category 2 only. */
  weeksStagnant?: number
}

export interface StrategyResult {
  phases: StrategyPhase[]
  flags: RoadmapFlag[]
  /** True only for Category 2 when an adaptation test fired. */
  adapted?: boolean
}

const CAT1_DEFICIT_SHARE = 0.175 // midpoint of the 15-20% band
const CAT1_TRANSITION_GAP_KCAL = 400
const CAT2_HOLD_SHARE = 0.2
const CAT2_REENTER_SHARE = 0.2
const CAT2_ADAPTATION_DEFICIT_SHARE = 0.25
const CAT2_ADAPTATION_WEEKS_ON_PLAN = 8
const CAT2_ADAPTATION_WEEKS_STAGNANT = 3
const CAT2_ADAPTATION_INTAKE_SHARE = 0.85
const CAT3_RAMP_SHARES = [0.1, 0.15, 0.2]
const CAT4_REVERSE_DIET_STEP_KCAL = 125
const CAT4_REVERSE_DIET_TRIGGER_GAP = 300

export function calorieStrategy(input: StrategyInput): StrategyResult {
  switch (input.category) {
    case "first_timer":
      return strategyFirstTimer(input)
    case "plateaued":
      return strategyPlateaued(input)
    case "re_starter":
      return strategyReStarter(input)
    case "maintenance":
      return strategyMaintenance(input)
  }
}

function strategyFirstTimer(input: StrategyInput): StrategyResult {
  const target = input.tdee * (1 - CAT1_DEFICIT_SHARE)
  const flags: RoadmapFlag[] = []

  if (input.currentIntakeKcal !== undefined && input.currentIntakeKcal <= target) {
    flags.push({
      level: "warn",
      code: "already-below-target",
      message:
        "Current intake is already at or below the computed deficit target. The target still applies — check whether this is a genuinely low intake or under-reporting before trusting the report.",
    })
    return {
      flags,
      phases: [
        {
          label: "Weighed-logging gate",
          weekFrom: 0,
          weekTo: 2,
          kcal: null,
          why: "14 days of WEIGHED (not estimated) logging before the target is trusted — the error being hunted is exactly the one estimation produces: cooking oil, portion size, unlogged tastings.",
        },
        {
          label: "From week 1 of the plan",
          weekFrom: 1,
          weekTo: null,
          kcal: target,
          why: "The midpoint of the 15–20% band. The gap from (verified) current intake is inside normal daily variation, so no transition phase is needed.",
        },
      ],
    }
  }

  if (
    input.currentIntakeKcal !== undefined &&
    input.currentIntakeKcal - target > CAT1_TRANSITION_GAP_KCAL
  ) {
    const midpoint = (input.currentIntakeKcal + target) / 2
    return {
      flags,
      phases: [
        {
          label: "Weeks 1–2 (transition)",
          weekFrom: 1,
          weekTo: 2,
          kcal: midpoint,
          why: "Current intake exceeds the target by more than 400 kcal — weeks 1–2 run at the midpoint of the two before the full target.",
        },
        {
          label: "From week 3",
          weekFrom: 3,
          weekTo: null,
          kcal: target,
          why: "The midpoint of the 15–20% deficit band.",
        },
      ],
    }
  }

  return {
    flags,
    phases: [
      {
        label: "From week 1",
        weekFrom: 1,
        weekTo: null,
        kcal: target,
        why: "The midpoint of the 15–20% deficit band.",
      },
    ],
  }
}

function strategyPlateaued(input: StrategyInput): StrategyResult {
  const current = input.currentIntakeKcal
  const weeksOnPlan = input.weeksOnPlan ?? 0
  const weeksStagnant = input.weeksStagnant ?? 0

  const testA = current !== undefined && current < input.bmr
  const deficitShare = current !== undefined ? (input.tdee - current) / input.tdee : 0
  const testB = deficitShare > CAT2_ADAPTATION_DEFICIT_SHARE && weeksOnPlan > CAT2_ADAPTATION_WEEKS_ON_PLAN
  const testC =
    weeksStagnant >= CAT2_ADAPTATION_WEEKS_STAGNANT &&
    current !== undefined &&
    current <= CAT2_ADAPTATION_INTAKE_SHARE * input.tdee

  const adapted = testA || testB || testC

  if (adapted) {
    return {
      adapted: true,
      flags: [],
      phases: [
        {
          label: "Diet break",
          weekFrom: 1,
          weekTo: 2,
          kcal: input.tdee,
          why: "10–14 days at TDEE (extra energy to carbohydrate, 1,500–2,000 extra steps a day) before re-entering at a deficit.",
        },
        {
          label: "Re-enter at 20% deficit",
          weekFrom: 3,
          weekTo: null,
          kcal: input.tdee * (1 - CAT2_REENTER_SHARE),
          why: "Adaptation confirmed — re-enter the deficit rather than continuing to hold.",
        },
      ],
    }
  }

  return {
    adapted: false,
    flags: [],
    phases: [
      {
        label: "14 days, no change to the target",
        weekFrom: 1,
        weekTo: null,
        kcal: input.tdee * (1 - CAT2_HOLD_SHARE),
        why: "Weighed logging for two weeks — weighed, not estimated, because the error being hunted is exactly the one estimation produces: cooking oil, portion size, unlogged tastings. Fix the measurement before touching the prescription.",
      },
    ],
  }
}

function strategyReStarter(input: StrategyInput): StrategyResult {
  const [w1, w2, w3] = CAT3_RAMP_SHARES
  return {
    flags: [],
    phases: [
      {
        label: "Week 1",
        weekFrom: 1,
        weekTo: 1,
        kcal: input.tdee * (1 - w1),
        why: "A real but nearly painless deficit. Its purpose is data and rhythm, not loss.",
      },
      {
        label: "Weeks 2–3",
        weekFrom: 2,
        weekTo: 3,
        kcal: input.tdee * (1 - w2),
        why: "Progression is gated on behaviour — 6 of 7 days logged — never on the scale, which is contaminated by water, salt and cycle.",
      },
      {
        label: "Week 4 onward",
        weekFrom: 4,
        weekTo: null,
        kcal: input.tdee * (1 - w3),
        why: "Progression is gated on behaviour — 6 of 7 days logged — never on the scale, which is contaminated by water, salt and cycle.",
      },
    ],
  }
}

function strategyMaintenance(input: StrategyInput): StrategyResult {
  const current = input.currentIntakeKcal

  if (current === undefined || current >= input.tdee) {
    return {
      flags: [],
      phases: [
        {
          label: "At maintenance",
          weekFrom: 1,
          weekTo: null,
          kcal: input.tdee,
          why: "At or above TDEE, or intake unmeasured — eat at maintenance.",
        },
      ],
    }
  }

  const gap = input.tdee - current
  if (gap < CAT4_REVERSE_DIET_TRIGGER_GAP) {
    return {
      flags: [],
      phases: [
        {
          label: "No protocol",
          weekFrom: 1,
          weekTo: null,
          kcal: null,
          why: "Gap to TDEE is under 300 kcal — no reverse-diet protocol needed. Eat to appetite.",
        },
      ],
    }
  }

  const phases: StrategyPhase[] = []
  let kcal = current
  let week = 1
  while (kcal < input.tdee) {
    const next = Math.min(kcal + CAT4_REVERSE_DIET_STEP_KCAL, input.tdee)
    if (next >= input.tdee) {
      phases.push({
        label: `Week ${week} onward`,
        weekFrom: week,
        weekTo: null,
        kcal: input.tdee,
        why: "Arrived at maintenance (TDEE). Hold here.",
      })
      break
    }
    phases.push({
      label: `Week ${week}`,
      weekFrom: week,
      weekTo: week,
      kcal: next,
      why: "+125 kcal into carbohydrate; protein holds at the maintenance band.",
    })
    kcal = next
    week += 1
  }

  return { flags: [], phases }
}
