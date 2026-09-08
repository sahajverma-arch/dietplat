/**
 * Dev tool: renders a week produced by scripts/compose-plan.ts to PDF.
 *
 * Deliberately does NOT reuse PlanPdfDocument — that component's header
 * renders roadmap-derived clinical figures (weight, BMI, TDEE, goal
 * category) which don't exist for a client supplied as bare macro targets,
 * and fabricating them to fill the layout would put invented clinical data
 * in front of a dietitian. This renders only what is actually known.
 *
 * Quantities come from the production formatRecipeQuantity(), so the
 * portion-size reference reads identically to a product-generated plan.
 *
 *   npx tsx --env-file=.env.local scripts/render-plan-pdf.tsx <week-export.json> <out.pdf>
 *
 * Never imported by production code.
 */
import * as fs from "fs"

import * as React from "react"
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import { formatRecipeQuantity, portionSizeReferenceText } from "../src/lib/plan/recipe-quantity-display"

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  header: { backgroundColor: "#0a0a0a", color: "#fff", borderRadius: 8, padding: 14, marginBottom: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  headerLeft: { flex: 1, paddingRight: 10 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  hLine: { fontSize: 9, color: "#d4d4d4", marginTop: 2 },
  brand: { fontSize: 18, fontFamily: "Helvetica-BoldOblique", color: "#facc15" },
  brandSub: { fontSize: 7, color: "#a3a3a3" },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tile: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 8 },
  tLabel: { fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  tValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tSub: { fontSize: 7, color: "#6b7280", marginTop: 1 },
  narrative: { fontSize: 8.5, color: "#4b5563", marginBottom: 10, lineHeight: 1.4 },
  dayCard: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, marginBottom: 8, overflow: "hidden" },
  dayHead: { backgroundColor: "#0a0a0a", color: "#fff", padding: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 8.5 },
  dayHeadNv: { backgroundColor: "#7c2d12" },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  trNv: { backgroundColor: "#fff7ed" },
  tf: { flexDirection: "row", backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  cTime: { width: "9%", padding: 4 },
  cMeal: { width: "12%", padding: 4, fontFamily: "Helvetica-Bold" },
  cFoods: { width: "43%", padding: 4 },
  cNum: { width: "9%", padding: 4, textAlign: "right" },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase" },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 10, marginBottom: 10 },
  cardTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  gItem: { flexDirection: "row", marginBottom: 3 },
  bullet: { width: 8 },
  statusBanner: { borderWidth: 1.5, borderColor: "#b91c1c", backgroundColor: "#fef2f2", borderRadius: 6, padding: 8, marginBottom: 10 },
  statusBannerWarn: { borderColor: "#b45309", backgroundColor: "#fffbeb" },
  statusTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#b91c1c" },
  statusTitleWarn: { color: "#b45309" },
  statusBody: { fontSize: 8, color: "#7f1d1d", marginTop: 2, lineHeight: 1.35 },
  statusBodyWarn: { color: "#78350f" },
  footer: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6, textAlign: "center", fontSize: 7, color: "#6b7280" },
})

const SLOT_LABEL: Record<string, string> = { breakfast: "Breakfast", mid_morning: "Mid-Morning", lunch: "Lunch", evening: "Evening", dinner: "Dinner" }
const SLOT_TIME: Record<string, string> = { breakfast: "08:00", mid_morning: "11:00", lunch: "13:30", evening: "16:30", dinner: "20:00" }
const DAYS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]

interface It { name: string; grams: number; category: string; unitLabel: string | null; perUnitGrams: number | null; isNonVeg: boolean; kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }
interface Ml { slot: string; slotOrder: number; items: It[] }
interface Dy { dayIndex: number; totals: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }; meals: Ml[] }
interface Payload { cuisine: string; dietType: string; target: Dy["totals"]; weeklyAverage: Dy["totals"]; days: Dy[]; clientName?: string; statusNote?: string; statusTitle?: string; statusLevel?: "error" | "warn"; provenanceNote?: string }

const r = (n: number) => Math.round(n)
const label = (i: It) => `${i.name} (${formatRecipeQuantity({ name: i.name, category: i.category, unitLabel: i.unitLabel, perUnitGrams: i.perUnitGrams }, i.grams)})`

function Pdf({ d }: { d: Payload }) {
  const { target: t, weeklyAverage: avg, days, cuisine, dietType } = d
  const worst = Math.max(
    Math.abs(avg.kcal - t.kcal) / t.kcal, Math.abs(avg.proteinG - t.proteinG) / t.proteinG,
    Math.abs(avg.carbsG - t.carbsG) / t.carbsG, Math.abs(avg.fatG - t.fatG) / t.fatG
  )
  const dietLabel = dietType.replace(/_/g, "-")
  const nvDays = days.filter((x) => x.meals.some((m) => m.items.some((i) => i.isNonVeg))).map((x) => DAYS[x.dayIndex])
  const eggWord = dietType === "eggetarian" ? "Egg" : "Non-veg"

  const guidelines = [
    "Every recipe is drawn from a verified nutrition database, with realistic portion sizes computed for your targets — never a rough estimate.",
    "Five meals, fixed times. Skipping a meal doesn't lower the day's total — it just makes the remaining meals harder to finish.",
    ...(nvDays.length > 0 ? [`${eggWord} dishes appear on ${nvDays.length} of 7 days — the days shaded below.`] : []),
    "Portion sizes shown are as-served/cooked weight, ready to plate — not raw ingredient weight.",
    portionSizeReferenceText(),
    "Fibre is tracked alongside calories and macros and shown on the plan, but — unlike calories, protein, carbs and fat — it is not a hard pass/fail target.",
    "Hydration: 3.5+ litres of water per day. Dinner is the last meal of the day.",
  ]
  const avoid = [
    "Sweetened drinks, packaged juice, cold drinks",
    "Deep-fried snacks: samosa, pakora, kachori, namkeen, chips, puri",
    "Bakery and refined-flour items: biscuits, rusk, cake, white bread, maida-based food",
    "Any oil or ghee beyond what's already cooked into the listed recipes",
  ]

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <Text style={s.h1}>Weekly Diet Plan</Text>
              <Text style={s.hLine}>{d.clientName ? `${d.clientName} · ` : ""}Week 1 · 7-day plan · Prepared by —</Text>
              <Text style={s.hLine}>Diet: {dietLabel} | Cuisine: {cuisine} | 5 meals/day</Text>
              <Text style={s.hLine}>Prescribed target: {r(t.kcal)} kcal · P {r(t.proteinG)} g · C {r(t.carbsG)} g · F {r(t.fatG)} g</Text>
            </View>
            <View><Text style={s.brand}>LEANR</Text><Text style={s.brandSub}>by Fitelo</Text></View>
          </View>
        </View>

        {d.statusNote ? (
          <View style={[s.statusBanner, ...(d.statusLevel === "warn" ? [s.statusBannerWarn] : [])]}>
            <Text style={[s.statusTitle, ...(d.statusLevel === "warn" ? [s.statusTitleWarn] : [])]}>
              {d.statusTitle ?? "NOT VALIDATED — DO NOT ISSUE TO A CLIENT"}
            </Text>
            <Text style={[s.statusBody, ...(d.statusLevel === "warn" ? [s.statusBodyWarn] : [])]}>{d.statusNote}</Text>
          </View>
        ) : null}

        <View style={s.tiles}>
          <View style={s.tile}><Text style={s.tLabel}>Avg Daily Calories</Text><Text style={s.tValue}>{r(avg.kcal).toLocaleString("en-IN")} kcal</Text><Text style={s.tSub}>target {r(t.kcal)}</Text></View>
          <View style={s.tile}><Text style={s.tLabel}>Avg Protein</Text><Text style={s.tValue}>{r(avg.proteinG)} g</Text><Text style={s.tSub}>target {r(t.proteinG)} g</Text></View>
          <View style={s.tile}><Text style={s.tLabel}>Avg Carbohydrates</Text><Text style={s.tValue}>{r(avg.carbsG)} g</Text><Text style={s.tSub}>target {r(t.carbsG)} g</Text></View>
          <View style={s.tile}><Text style={s.tLabel}>Avg Fat</Text><Text style={s.tValue}>{r(avg.fatG)} g</Text><Text style={s.tSub}>target {r(t.fatG)} g</Text></View>
        </View>

        <Text style={s.narrative}>
          {cuisine} {dietLabel} plan with every portion computed in code against the prescribed macro target — the week&apos;s
          average lands within {(worst * 100).toFixed(2)}% of target on the worst macro, and each day independently clears the 8%
          per-day gate on calories, protein, carbs and fat.
          {nvDays.length > 0 ? ` ${eggWord} dishes fall on ${nvDays.join(", ")} (shaded below).` : ""}
          {" "}Calories are Atwater-derived from the three prescribed macros ({r(t.proteinG)}x4 + {r(t.carbsG)}x4 + {r(t.fatG)}x9 ={" "}
          {r(t.kcal)} kcal); the {r(t.fiberG)} g fibre figure is this platform&apos;s standard adult reference and is a soft target only.
        </Text>

        {days.map((day) => {
          const meals = [...day.meals].sort((a, b) => a.slotOrder - b.slotOrder)
          const isNv = meals.some((m) => m.items.some((i) => i.isNonVeg))
          return (
            <View key={day.dayIndex} style={s.dayCard} wrap={false}>
              <View style={[s.dayHead, ...(isNv ? [s.dayHeadNv] : [])]}>
                <Text>{DAYS[day.dayIndex]}{isNv ? `  ·  ${eggWord.toUpperCase()} DAY` : ""}</Text>
                <Text>{r(day.totals.kcal).toLocaleString("en-IN")} kcal | P {r(day.totals.proteinG)}g | C {r(day.totals.carbsG)}g | F {r(day.totals.fatG)}g</Text>
              </View>
              <View style={s.thRow}>
                <Text style={[s.cTime, s.th]}>Time</Text><Text style={[s.cMeal, s.th]}>Meal</Text><Text style={[s.cFoods, s.th]}>Foods</Text>
                <Text style={[s.cNum, s.th]}>Cal</Text><Text style={[s.cNum, s.th]}>Pro</Text><Text style={[s.cNum, s.th]}>Carb</Text><Text style={[s.cNum, s.th]}>Fat</Text>
              </View>
              {meals.map((m) => {
                const nv = m.items.some((i) => i.isNonVeg)
                const k = m.items.reduce((a, i) => a + i.kcal, 0), p = m.items.reduce((a, i) => a + i.proteinG, 0)
                const c = m.items.reduce((a, i) => a + i.carbsG, 0), f = m.items.reduce((a, i) => a + i.fatG, 0)
                return (
                  <View key={m.slot} style={[s.tr, ...(nv ? [s.trNv] : [])]}>
                    <Text style={s.cTime}>{SLOT_TIME[m.slot] ?? ""}</Text>
                    <Text style={s.cMeal}>{SLOT_LABEL[m.slot] ?? m.slot}</Text>
                    <Text style={s.cFoods}>{m.items.map(label).join(", ")}</Text>
                    <Text style={s.cNum}>{r(k)}</Text><Text style={s.cNum}>{r(p)}g</Text><Text style={s.cNum}>{r(c)}g</Text><Text style={s.cNum}>{r(f)}g</Text>
                  </View>
                )
              })}
              <View style={s.tf}>
                <Text style={s.cTime} /><Text style={s.cMeal}>Total</Text><Text style={s.cFoods} />
                <Text style={s.cNum}>{r(day.totals.kcal).toLocaleString("en-IN")}</Text><Text style={s.cNum}>{r(day.totals.proteinG)}g</Text>
                <Text style={s.cNum}>{r(day.totals.carbsG)}g</Text><Text style={s.cNum}>{r(day.totals.fatG)}g</Text>
              </View>
            </View>
          )
        })}

        <View style={s.card} wrap={false}>
          <Text style={s.cardTitle}>WEEKLY SUMMARY</Text>
          <View style={s.thRow}>
            <Text style={[s.cMeal, s.th, { width: "28%" }]}>Day</Text><Text style={[s.cNum, s.th, { width: "18%" }]}>Cal</Text>
            <Text style={[s.cNum, s.th, { width: "18%" }]}>Pro</Text><Text style={[s.cNum, s.th, { width: "18%" }]}>Carb</Text><Text style={[s.cNum, s.th, { width: "18%" }]}>Fat</Text>
          </View>
          {days.map((x) => (
            <View key={x.dayIndex} style={s.tr}>
              <Text style={[s.cMeal, { width: "28%", fontFamily: "Helvetica" }]}>{DAYS[x.dayIndex]}</Text>
              <Text style={[s.cNum, { width: "18%" }]}>{r(x.totals.kcal).toLocaleString("en-IN")}</Text>
              <Text style={[s.cNum, { width: "18%" }]}>{r(x.totals.proteinG)}</Text>
              <Text style={[s.cNum, { width: "18%" }]}>{r(x.totals.carbsG)}</Text>
              <Text style={[s.cNum, { width: "18%" }]}>{r(x.totals.fatG)}</Text>
            </View>
          ))}
          <View style={s.tf}>
            <Text style={[s.cMeal, { width: "28%" }]}>Weekly Avg</Text>
            <Text style={[s.cNum, { width: "18%", fontFamily: "Helvetica-Bold" }]}>{r(avg.kcal).toLocaleString("en-IN")}</Text>
            <Text style={[s.cNum, { width: "18%", fontFamily: "Helvetica-Bold" }]}>{r(avg.proteinG)}</Text>
            <Text style={[s.cNum, { width: "18%", fontFamily: "Helvetica-Bold" }]}>{r(avg.carbsG)}</Text>
            <Text style={[s.cNum, { width: "18%", fontFamily: "Helvetica-Bold" }]}>{r(avg.fatG)}</Text>
          </View>
          <View style={s.tr}>
            <Text style={[s.cMeal, { width: "28%", fontFamily: "Helvetica" }]}>Target</Text>
            <Text style={[s.cNum, { width: "18%" }]}>{r(t.kcal).toLocaleString("en-IN")}</Text>
            <Text style={[s.cNum, { width: "18%" }]}>{r(t.proteinG)}</Text>
            <Text style={[s.cNum, { width: "18%" }]}>{r(t.carbsG)}</Text>
            <Text style={[s.cNum, { width: "18%" }]}>{r(t.fatG)}</Text>
          </View>
        </View>

        <View style={s.card} wrap={false}>
          <Text style={s.cardTitle}>GUIDELINES</Text>
          {guidelines.map((g, i) => (<View key={i} style={s.gItem}><Text style={s.bullet}>•</Text><Text style={{ flex: 1 }}>{g}</Text></View>))}
        </View>

        <View style={s.card} wrap={false}>
          <Text style={s.cardTitle}>FOODS TO AVOID</Text>
          {avoid.map((g, i) => (<View key={i} style={s.gItem}><Text style={s.bullet}>•</Text><Text style={{ flex: 1 }}>{g}</Text></View>))}
        </View>

        <Text style={s.footer}>
          Generated by LEANR Diet Platform | Diet Preference: {dietLabel} | Cuisine: {cuisine} | Prepared by —{"\n"}
          {d.provenanceNote ?? "Built to a directly-prescribed macro target (no counselling roadmap on file, so no BMI/TDEE is shown)."}
          Created with AI assistance and reviewed by your dietitian. Not a substitute for medical advice.
        </Text>
      </Page>
    </Document>
  )
}

async function main() {
  const data: Payload = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
  const buf = await renderToBuffer(<Pdf d={data} />)
  fs.writeFileSync(process.argv[3], buf)
  console.log(`Wrote ${process.argv[3]} (${buf.length} bytes)`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
