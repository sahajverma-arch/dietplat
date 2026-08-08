/**
 * LeanR full counselling question bank — 15 sections, 332 questions.
 * Source of truth: the client's exported full-counselling-questions.pdf
 * ("LeanR Premium Final New Client First Counselling"). Every id, label,
 * option list, required/conditional flag below is transcribed from that
 * export, section by section, and the count of every section matches the
 * PDF's own per-section total (they sum to exactly 332).
 *
 * The quick-intake form (see quick-intake.ts) is NOT a separate bank — it
 * is a curated list of ids resolved against this same array via
 * findQuestion(). Never hardcode a question a second time somewhere else.
 *
 * Deliberate addition beyond the PDF (q29b_*, Section 6): q29a's own note
 * already instructs "estimate calories from the habitual pattern", but the
 * PDF never provided a field to record that estimate as a number. Without
 * one, roadmap-input.ts had nothing to build RoadmapInput.currentIntake
 * from, which silently disabled the protein ramp, the chronic-under-eating
 * flag, and the already-below-target calorie-strategy branch for every
 * real client (they only ever ran in the golden-file tests, which hardcode
 * currentIntake directly). See roadmap.ts's CurrentIntake type.
 */

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "single"
  | "multi"
  | "height"
  | "date"
  | "time"
  | "scale10"
  | "portions"
  | "mealVariants"

export type QuestionTheme =
  | "Client"
  | "Goals"
  | "Clinical"
  | "Diet"
  | "Lifestyle"
  | "Fitness"
  | "Behaviour"
  | "Assessment"

export type QuestionTag = "core" | "clinical" | "fitness" | "planning"

export type Answers = Record<string, unknown>

export interface Question {
  id: string
  label: string
  type: QuestionType
  section: string
  tag?: QuestionTag
  options?: string[]
  maxSelect?: number
  required?: boolean
  requiredIf?: (answers: Answers) => boolean
  showIf?: (answers: Answers) => boolean
  placeholder?: string
  help?: string
  note?: string
}

export interface SectionMeta {
  id: string
  title: string
  theme: QuestionTheme
  estimatedMinutes: string
  intro?: string
}

export const SECTIONS: SectionMeta[] = [
  { id: "client", title: "Client details", theme: "Client", estimatedMinutes: "1–2 min" },
  {
    id: "1",
    title: "Introduction, rapport & goal discovery",
    theme: "Goals",
    estimatedMinutes: "8–10 min",
    intro:
      "Introduce yourself and the purpose first. The opening is a conversation, not a form — let the client describe their day and fill the fields below from what they say.",
  },
  {
    id: "2",
    title: "Body profile & transformation history",
    theme: "Goals",
    estimatedMinutes: "8–10 min",
  },
  {
    id: "3",
    title: "Body composition & objective baseline",
    theme: "Clinical",
    estimatedMinutes: "5–6 min",
    intro:
      "Baseline weight, waist, hip, body fat, sleep, stress and fluids are captured in the body-profile and lifestyle sections — they are not re-asked here. Record only what the client has actually been measured with, and how: the counselling date itself is the baseline every future review trends against.",
  },
  {
    id: "4",
    title: "Medical, clinical & safety assessment",
    theme: "Clinical",
    estimatedMinutes: "10–12 min",
    intro:
      "Blood-report flow: report upload → AI extraction → dietitian verification. Nothing in this stage is optional for safety, but nothing may be pushed either — record what the client volunteers.",
  },
  {
    id: "5",
    title: "Digestion, allergies & food tolerance",
    theme: "Clinical",
    estimatedMinutes: "5–6 min",
  },
  {
    id: "6",
    title: "Dietary intake, food pattern & protein",
    theme: "Diet",
    estimatedMinutes: "18–22 min",
    intro:
      "One food conversation, in the order the client thinks about it: the pattern they follow, yesterday occasion by occasion, then a normal week — and only then the protein count, ticked off from the day already described rather than asked again from scratch. The recall is yesterday; the weekday description is what happens most days. One recalled day is not habitual intake and must not be treated as the client's usual calories.",
  },
  {
    id: "7",
    title: "Food preferences, cultural habits & household feasibility",
    theme: "Diet",
    estimatedMinutes: "8–10 min",
    intro:
      "Household food first: the plan improves what is already cooked at home rather than introducing a second kitchen. Food pattern and protein intake are already recorded in the previous section — this is about what the household will actually cook and eat.",
  },
  { id: "8", title: "Daily activity & NEAT", theme: "Lifestyle", estimatedMinutes: "5–6 min" },
  {
    id: "9",
    title: "Exercise, training & recovery",
    theme: "Fitness",
    estimatedMinutes: "8–10 min",
  },
  { id: "10", title: "Hunger & eating behaviour", theme: "Behaviour", estimatedMinutes: "6–8 min" },
  {
    id: "11",
    title: "Sleep, stress, hydration & lifestyle",
    theme: "Lifestyle",
    estimatedMinutes: "6–7 min",
  },
  {
    id: "12",
    title: "Adherence, mindset & success strategy",
    theme: "Behaviour",
    estimatedMinutes: "5–6 min",
    intro: "This stage decides how the plan is written, not what is in it: structure, portion language, how much change lands in week one and what support the client gets.",
  },
  {
    id: "13",
    title: "Dietitian professional assessment",
    theme: "Assessment",
    estimatedMinutes: "3–4 min",
    intro:
      "IMPORTANT: these answers are your professional hypothesis, not automatically the final LeanR nutrition strategy. The AI independently analyses the complete client data before accepting, modifying or replacing it — the one exception is the hard constraints, which it must obey.",
  },
  {
    id: "14",
    title: "Physical assessment (coach)",
    theme: "Fitness",
    estimatedMinutes: "10–15 min",
    intro:
      "Run by a coach with the client in front of them: six tests, each scored 1-4. ENTIRELY OPTIONAL and not part of the diet plan — a client counselled today may not be assessed until a coach sees them, so nothing here is required and none of it blocks plan generation. Enter what you measured and the points fill themselves in; change them if you disagree.",
  },
]

// ---------------------------------------------------------------------------
// Shared predicate helpers for conditional show/require logic
// ---------------------------------------------------------------------------

function includesValue(id: string, value: string) {
  return (a: Answers) => Array.isArray(a[id]) && (a[id] as string[]).includes(value)
}

function includesOtherThan(id: string, excluded: string[]) {
  return (a: Answers) =>
    Array.isArray(a[id]) && (a[id] as string[]).some((v) => !excluded.includes(v))
}

function equalsValue(id: string, value: string) {
  return (a: Answers) => a[id] === value
}

function isTruthy(id: string) {
  return (a: Answers) => {
    const v = a[id]
    return Array.isArray(v) ? v.length > 0 : !!v
  }
}

// ---------------------------------------------------------------------------
// Shared option lists
// ---------------------------------------------------------------------------

const DRINK_OPTIONS = [
  "Tea with sugar",
  "Tea without sugar",
  "Green or black tea",
  "Coffee with sugar",
  "Black coffee",
  "Milk",
  "Buttermilk or chaas",
  "Lassi",
  "Fresh juice",
  "Packaged juice",
  "Soft drink",
  "Diet soft drink",
  "Coconut water",
  "Protein shake",
  "Water only",
]

const ALLERGY_TYPE_OPTIONS = ["Allergy — never serve", "Intolerance — causes symptoms"]

const SUBSTANCE_FREQ_OPTIONS = [
  "Daily",
  "4–6 times weekly",
  "2–3 times weekly",
  "Weekly",
  "Monthly",
  "Occasionally",
]

const SUBSTANCE_CONTEXT_OPTIONS = ["Routine use", "Social", "Weekend", "Stress-related", "Travel", "Other"]

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

// ---------------------------------------------------------------------------
// Client details (5)
// ---------------------------------------------------------------------------

const CLIENT_QUESTIONS: Question[] = [
  { id: "name", label: "Client full name", type: "text", section: "client", required: true, placeholder: "Anita Verma" },
  { id: "clientCode", label: "Client code (from today's schedule)", type: "text", section: "client", placeholder: "493030768" },
  { id: "gender", label: "Gender", type: "single", section: "client", required: true, options: ["Female", "Male", "Other", "Prefer not to say"] },
  { id: "phone", label: "Phone", type: "text", section: "client", required: true, placeholder: "+91 98xxx xxxxx" },
  { id: "email", label: "Email", type: "text", section: "client", placeholder: "client@email.com" },
]

// ---------------------------------------------------------------------------
// Section 1 — Introduction, rapport & goal discovery (12)
// ---------------------------------------------------------------------------

const SECTION_1: Question[] = [
  { id: "q9_age", label: "Age (years)", type: "number", section: "1", tag: "core", required: true },
  { id: "q1_occupation", label: "Occupation", type: "text", section: "1", tag: "core", placeholder: "e.g. Software engineer, school teacher, business owner" },
  {
    id: "q54",
    label: "Work type",
    type: "single",
    section: "1",
    tag: "core",
    required: true,
    options: ["Desk-based", "Standing", "Physical work", "Field work", "Work from home", "Hybrid", "Student", "Homemaker", "Not working", "Other"],
  },
  { id: "q1_hours", label: "Working hours", type: "text", section: "1", tag: "core", placeholder: "e.g. 9:30 AM to 7 PM, 6 days" },
  {
    id: "q54a",
    label: "Shift pattern",
    type: "single",
    section: "1",
    tag: "core",
    options: ["Day", "Evening", "Night", "Rotational", "Split", "Flexible", "Not applicable"],
  },
  { id: "q34a", label: "Country", type: "text", section: "1", tag: "core", placeholder: "e.g. India" },
  { id: "q34d", label: "State", type: "text", section: "1", tag: "core", placeholder: "e.g. Punjab" },
  { id: "q34b", label: "City", type: "text", section: "1", tag: "core", placeholder: "e.g. Chandigarh" },
  {
    id: "q1",
    label: "What motivated you to begin your health journey with LeanR at this point in your life?",
    type: "multi",
    section: "1",
    tag: "core",
    required: true,
    maxSelect: 3,
    options: [
      "Recent weight gain", "Increased body fat", "Clothes fitting tighter", "Poor body shape", "Low confidence",
      "Low energy", "Reduced strength", "Poor stamina", "Poor workout performance", "Slow recovery", "Health reports",
      "Doctor recommendation", "Existing medical condition", "Wedding", "Special occasion", "Pregnancy planning",
      "Post-pregnancy transformation", "Sports goal", "Weight regain", "Previous failed attempts", "Plateau",
      "Family motivation", "Better lifestyle", "Want professional guidance", "Other",
    ],
    help: "Probe: Why now specifically, and why this month rather than last year?",
  },
  {
    id: "q2",
    label: "What would you most like to achieve through LeanR?",
    type: "single",
    section: "1",
    tag: "core",
    required: true,
    options: [
      "Fat Loss", "Weight Loss", "Body Recomposition", "Fat Loss With Muscle Preservation", "Muscle Gain",
      "Healthy Weight Gain", "Improved Fitness", "Sports/Performance Improvement", "Clinical Nutrition Improvement",
      "Lifestyle Improvement", "Maintenance", "Not Sure – Need Dietitian Guidance",
    ],
    help: "The single primary result — the whole energy and protein strategy hangs off it.",
  },
  {
    id: "q6",
    label: "What kind of physical transformation are you hoping to achieve?",
    type: "single",
    section: "1",
    tag: "core",
    options: [
      "Lean Physique", "Athletic Physique", "Toned Physique", "Muscular Physique", "Better Body Shape",
      "Smaller Waist", "Better Muscle Definition", "Body Recomposition", "Healthy Weight Gain",
      "No Specific Appearance Goal", "Need Dietitian Guidance",
    ],
  },
  {
    id: "q4",
    label: "Why is achieving this goal personally important to you?",
    type: "multi",
    section: "1",
    tag: "core",
    required: true,
    maxSelect: 3,
    options: [
      "Better confidence", "Better appearance", "Better health", "Better fitness", "Better mobility",
      "Better quality of life", "Better sports performance", "Better energy", "Future disease prevention",
      "Family responsibility", "Wedding/Event", "Pregnancy planning", "Doctor advised",
      "Better relationship with food", "Sustainable lifestyle", "Other",
    ],
    help: "The deeper reason is what coaching messages are written from when motivation drops.",
  },
]

// ---------------------------------------------------------------------------
// Section 2 — Body profile & transformation history (21)
// ---------------------------------------------------------------------------

const changedWeightAnswered = isTruthy("q10")

const SECTION_2: Question[] = [
  { id: "q9_height", label: "Height", type: "height", section: "2", tag: "core", required: true },
  { id: "q9_weight", label: "Current weight (kg)", type: "number", section: "2", tag: "core", required: true },
  { id: "q9_weight_high", label: "Highest adult weight (kg)", type: "number", section: "2", tag: "core", note: "Leave blank if unknown." },
  { id: "q9_weight_low", label: "Lowest adult weight (kg)", type: "number", section: "2", tag: "core", note: "Leave blank if unknown." },
  {
    id: "q9_weight_comfort",
    label: "Comfortable / preferred weight (kg)",
    type: "number",
    section: "2",
    tag: "core",
    help: "A weight the client has actually held before is a more defensible target than a round number.",
    note: "Leave blank if the client has never identified one.",
  },
  { id: "q9_weight_1y", label: "Weight one year ago (kg)", type: "number", section: "2", tag: "core", note: "Leave blank if unknown." },
  {
    id: "q10",
    label: "What changed in your weight or body shape, and over what period?",
    type: "multi",
    section: "2",
    tag: "core",
    required: true,
    options: [
      "Gradual Weight Gain", "Rapid Weight Gain", "Gradual Weight Loss", "Rapid Weight Loss", "Stable Weight",
      "Frequent Fluctuations", "Fat Gain", "Muscle Loss", "Stable Weight but Body Shape Changed", "Not Sure",
    ],
    note: "Record the change here, then how much and over how long in the two follow-ups.",
  },
  { id: "q10a", label: "How much did it change (kg)", type: "number", section: "2", showIf: changedWeightAnswered },
  {
    id: "q10b",
    label: "Over what period",
    type: "single",
    section: "2",
    showIf: changedWeightAnswered,
    options: ["Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "1–2 years", "More than 2 years", "Not sure"],
  },
  { id: "q10c", label: "Major body-shape changes", type: "text", section: "2", showIf: changedWeightAnswered, placeholder: "e.g. waist up two sizes, arms visibly thinner" },
  {
    id: "q11",
    label: "What do you feel contributed the most to these changes?",
    type: "multi",
    section: "2",
    tag: "core",
    maxSelect: 5,
    options: [
      "Job/Lifestyle Change", "Sedentary Lifestyle", "Exercise Stopped", "Exercise Increased", "Injury", "Illness",
      "Surgery", "Medication", "Pregnancy/Postpartum", "Hormonal Changes", "Menopause/Perimenopause", "Stress",
      "Poor Sleep", "Emotional Eating", "Outside Food", "Alcohol", "Travel", "Meal Skipping", "Restrictive Dieting",
      "Low Appetite", "Increased Appetite", "No Clear Reason", "Other",
    ],
  },
  {
    id: "q12",
    label: "What weight-loss, weight-gain, fitness or nutrition approaches have you tried previously, and what happened?",
    type: "multi",
    section: "2",
    tag: "core",
    required: true,
    options: [
      "Calorie Counting", "Dietitian Plan", "Gym", "Personal Trainer", "Intermittent Fasting", "Keto", "Low Carb",
      "Meal Skipping", "Portion Control", "Home Workouts", "Running", "Weight-Management Medicines", "Supplements",
      "Commercial Program", "Self-Planned Diet", "Never Tried", "Other",
    ],
  },
  {
    id: "q12c",
    label: "For each significant attempt — approach, duration, approximate weight/body change",
    type: "textarea",
    section: "2",
    showIf: includesOtherThan("q12", ["Never Tried"]),
    placeholder: "e.g. keto — 3 months, 7 kg; gym + self-planned diet — 6 weeks, no change",
  },
  {
    id: "q12a",
    label: "Result",
    type: "single",
    section: "2",
    showIf: includesOtherThan("q12", ["Never Tried"]),
    options: ["Successful and Maintained", "Successful but Regained", "Plateau", "Minimal Result", "No Result", "Gained Weight", "Could Not Continue"],
  },
  {
    id: "q12b",
    label: "Main reason for stopping",
    type: "multi",
    section: "2",
    maxSelect: 3,
    showIf: includesOtherThan("q12", ["Never Tried"]),
    options: ["Hunger", "Cravings", "Restrictive Diet", "Family Food", "Work", "Travel", "Poor Results", "Low Motivation", "Cost", "Digestive Problems", "Cooking Difficulty", "Other"],
    help: "The reason it stopped last time is the failure mode this plan has to design around.",
  },
  {
    id: "q16",
    label: "Looking back, when were you healthiest or most consistent, and what helped you succeed?",
    type: "multi",
    section: "2",
    tag: "core",
    options: [
      "Fixed Work Schedule", "Better Sleep", "Lower Stress", "Home-Cooked Food", "Regular Meals", "Family Support",
      "Workout Partner", "Gym Routine", "Walking", "Dietitian Support", "Personal Trainer", "Meal Preparation",
      "Less Travel", "Less Outside Food", "Better Motivation", "Weight Tracking", "Food Tracking", "Simpler Routine",
      "Never Had Such a Phase",
    ],
    help: "The client's own success pattern — rebuilding it is cheaper than inventing a new routine.",
  },
  {
    id: "q16a",
    label: "Rank the top 3 success factors (in order)",
    type: "text",
    section: "2",
    tag: "planning",
    showIf: isTruthy("q16"),
    placeholder: "e.g. 1) Meal preparation 2) Gym routine 3) Better sleep",
    note: "Click in priority order — first click = rank 1.",
  },
  {
    id: "q13",
    label: "Have you ever lost weight very quickly or followed a highly restrictive diet?",
    type: "single",
    section: "2",
    tag: "clinical",
    required: true,
    options: ["Yes", "No", "Not sure"],
    help: "Restriction–regain history changes the energy strategy (stabilise before deficit).",
  },
  { id: "q13a", label: "Approximate weight lost (kg)", type: "number", section: "2", showIf: equalsValue("q13", "Yes") },
  {
    id: "q13b",
    label: "Over what period?",
    type: "single",
    section: "2",
    showIf: equalsValue("q13", "Yes"),
    options: ["Less than 2 weeks", "2–4 weeks", "1–2 months", "2–3 months", "More than 3 months"],
  },
  {
    id: "q13c",
    label: "What happened during or after?",
    type: "multi",
    section: "2",
    showIf: equalsValue("q13", "Yes"),
    options: [
      "Severe hunger", "Weakness", "Dizziness", "Hair fall", "Constipation", "Menstrual changes",
      "Poor workout performance", "Strength loss", "Excessive fatigue", "Strong cravings", "Loss-of-control eating",
      "Frequent illness", "Weight regain", "Rapid weight regain", "No major problem", "Other",
    ],
  },
]

// ---------------------------------------------------------------------------
// Section 3 — Body composition & objective baseline (13)
// ---------------------------------------------------------------------------

const hasBodyCompMeasurement = includesOtherThan("q15", ["None"])

const SECTION_3: Question[] = [
  {
    id: "q15",
    label: "Do you have recent body-composition measurements, circumference measurements or progress photos?",
    type: "multi",
    section: "3",
    tag: "fitness",
    options: ["DEXA", "Clinical/Validated BIA", "Professional/Gym BIA", "Consumer Smart Scale", "Measuring Tape", "Progress Photos", "Visual Estimate", "None"],
    note: "Tier 1 DEXA · Tier 2 validated clinical BIA · Tier 3 professional BIA · Tier 4 smart scale · Tier 5 circumferences · Tier 6 visual estimate.",
  },
  { id: "q15_date", label: "Date of measurement", type: "date", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_bf", label: "Body fat (%)", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_muscle", label: "Muscle mass (kg)", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_smm", label: "Skeletal muscle (kg)", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_visceral", label: "Visceral fat", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_waist", label: "Waist (cm — note the unit if inches)", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_hip", label: "Hip", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_chest", label: "Chest", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_arm", label: "Arms", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  { id: "q15_thigh", label: "Thigh", type: "number", section: "3", showIf: hasBodyCompMeasurement },
  {
    id: "q15_src",
    label: "Body-fat measurement source",
    type: "single",
    section: "3",
    tag: "planning",
    showIf: hasBodyCompMeasurement,
    options: ["DEXA", "Clinical/Validated BIA", "Professional/Gym BIA", "Consumer Smart Scale", "Measuring Tape", "Visual Estimate", "Unknown"],
  },
  {
    id: "q13_bf_conf",
    label: "Body-fat confidence",
    type: "single",
    section: "3",
    tag: "planning",
    showIf: hasBodyCompMeasurement,
    options: ["High", "Moderate", "Low"],
  },
]

// ---------------------------------------------------------------------------
// Section 4 — Medical, clinical & safety assessment (29)
// ---------------------------------------------------------------------------

const hasMedicalCondition = includesOtherThan("q17", ["No Medical Condition"])
const hasSurgeryEvent = includesOtherThan("q18", ["None"])
const takesMedicine = equalsValue("q19", "Yes")
const hasBloodTests = isTruthy("q20")
const hasReproFactor = includesOtherThan("q66", ["None", "Prefer Not to Answer", "Not Applicable"])

const SECTION_4: Question[] = [
  {
    id: "q17",
    label: "Have you ever been diagnosed with any medical condition?",
    type: "multi",
    section: "4",
    tag: "clinical",
    required: true,
    options: [
      "Diabetes Type 1", "Diabetes Type 2", "Prediabetes", "Insulin Resistance", "Obesity", "Metabolic Syndrome",
      "Hypothyroidism", "Hyperthyroidism", "Hashimoto's Thyroiditis", "Graves' Disease", "PCOS/PCOD", "Endometriosis",
      "Hormonal Imbalance", "Menopause", "Perimenopause", "Hypertension", "Low Blood Pressure", "High Cholesterol",
      "High Triglycerides", "Heart Disease", "Heart Failure", "Previous Heart Attack", "Arrhythmia",
      "Fatty Liver Grade I", "Fatty Liver Grade II", "Fatty Liver Grade III", "Hepatitis", "Other Liver Disease",
      "Kidney Stones", "Chronic Kidney Disease", "High Uric Acid", "Gout", "GERD", "Gastritis", "IBS", "IBD",
      "Crohn's Disease", "Ulcerative Colitis", "Celiac Disease", "Gallstones", "Anaemia", "Iron Deficiency",
      "Vitamin D Deficiency", "Vitamin B12 Deficiency", "Folate Deficiency", "Arthritis", "Osteoporosis",
      "Osteopenia", "Asthma", "Sleep Apnea", "Autoimmune Disease", "Previous Cancer", "Current Cancer Treatment",
      "Other", "No Medical Condition",
    ],
  },
  { id: "q17d", label: "When diagnosed", type: "single", section: "4", tag: "clinical", showIf: hasMedicalCondition, options: ["<6 months", "6–12 months", "1–3 years", ">3 years"] },
  { id: "q17a", label: "Current status", type: "single", section: "4", tag: "clinical", showIf: hasMedicalCondition, options: ["Controlled", "Improving", "Stable", "Uncontrolled", "Under Investigation"] },
  { id: "q17b", label: "Doctor follow-up", type: "single", section: "4", tag: "clinical", showIf: hasMedicalCondition, options: ["Regular", "Occasionally", "Not Required", "Never"] },
  {
    id: "q17c",
    label: "Per-condition notes (which condition, since when, status, treating doctor)",
    type: "textarea",
    section: "4",
    tag: "clinical",
    showIf: hasMedicalCondition,
    placeholder: "e.g. Hypothyroidism since 2022 — controlled on 50 mcg; PCOS/PCOD — under investigation",
    note: "The single status and follow-up answers above cover the client overall; use this when two conditions differ.",
  },
  {
    id: "q107",
    label: "Is there any relevant family history of medical conditions?",
    type: "multi",
    section: "4",
    tag: "clinical",
    options: ["Diabetes", "Thyroid Disease", "Obesity", "Hypertension", "High Cholesterol", "Heart Disease", "Stroke", "Kidney Disease", "Fatty Liver", "PCOS", "Cancer", "Autoimmune Disease", "None", "Don't Know"],
    help: "First-degree family history raises the screening threshold even when the client's own reports are still normal.",
  },
  { id: "q107a", label: "Relationship", type: "text", section: "4", showIf: includesOtherThan("q107", ["None", "Don't Know"]), placeholder: "e.g. Father — diabetes; Mother — hypothyroidism" },
  {
    id: "q18",
    label: "Have you undergone any significant surgery, hospitalization, serious injury or major medical event?",
    type: "multi",
    section: "4",
    tag: "clinical",
    options: ["General Surgery", "Bariatric Surgery", "Orthopaedic Surgery", "Cardiac Surgery", "Women's Health Surgery", "Cancer Surgery", "Organ Surgery", "Major Hospitalization", "Accident", "Fracture", "Severe Infection", "Other", "None"],
  },
  { id: "q18b", label: "What was done during the surgery or event", type: "textarea", section: "4", showIf: hasSurgeryEvent, placeholder: "e.g. Gallbladder removed, laparoscopic; ACL reconstruction with graft", note: "One line per event if there is more than one." },
  { id: "q18c", label: "Date of the surgery or event", type: "date", section: "4", showIf: hasSurgeryEvent, note: "Clients rarely remember the day. If only the year or month is known, leave this blank and write it in the box above." },
  { id: "q18a", label: "Current impact", type: "multi", section: "4", showIf: hasSurgeryEvent, options: ["No Impact", "Affects Eating", "Affects Digestion", "Affects Exercise", "Affects Mobility", "Chronic Pain", "Requires Medical Monitoring"] },
  { id: "q19", label: "Are you currently taking any medicines regularly?", type: "single", section: "4", tag: "clinical", required: true, options: ["Yes", "No"] },
  {
    id: "q19a",
    label: "For each medicine — name, reason, dose, timing, before/with/after food",
    type: "textarea",
    section: "4",
    tag: "clinical",
    showIf: takesMedicine,
    requiredIf: takesMedicine,
    placeholder: "e.g. Thyronorm 50 mcg — hypothyroidism, morning, empty stomach; Metformin 500 mg — after dinner",
    note: "Food-medicine timing is a hard constraint on meal timing, not a preference.",
  },
  {
    id: "q19b",
    label: "Recent changes",
    type: "single",
    section: "4",
    tag: "clinical",
    showIf: takesMedicine,
    options: ["No", "Started recently", "Dose increased", "Dose reduced", "Medicine changed", "Not sure"],
    help: "A dose change in the last few weeks can explain weight, appetite or energy movement that would otherwise be blamed on diet.",
  },
  {
    id: "q20",
    label: "Have you had relevant blood tests during the last 12 months?",
    type: "multi",
    section: "4",
    tag: "clinical",
    required: true,
    options: ["CBC", "HbA1c", "Fasting Blood Sugar", "PP Blood Sugar", "Fasting Insulin", "Lipid Profile", "Liver Function", "Kidney Function", "Thyroid Profile", "Vitamin D", "Vitamin B12", "Iron Profile", "Ferritin", "Uric Acid", "Hormonal Profile", "Other"],
  },
  { id: "q20c", label: "Report status", type: "single", section: "4", tag: "clinical", showIf: hasBloodTests, options: ["Reports Available", "Reports Not Available"] },
  { id: "q20b", label: "For relevant tests — test, date, result", type: "textarea", section: "4", tag: "clinical", showIf: hasBloodTests, placeholder: "e.g. HbA1c 6.1 (12 Mar); Vitamin D 14 ng/mL (12 Mar); TSH 8.2 (2 Jan)" },
  { id: "q20a", label: "Status", type: "single", section: "4", tag: "clinical", showIf: hasBloodTests, options: ["Normal", "Abnormal", "Unsure"] },
  { id: "q20d", label: "Action", type: "multi", section: "4", tag: "clinical", showIf: hasBloodTests, options: ["Upload Report", "AI Extract Report", "Dietitian Verification"], note: "An AI-extracted value is not verified data until a dietitian has confirmed it." },
  {
    id: "q21",
    label: "Are you currently experiencing any symptoms that concern you?",
    type: "multi",
    section: "4",
    tag: "clinical",
    required: true,
    options: ["Chest Pain", "Breathlessness", "Palpitations", "Severe Fatigue", "Frequent Dizziness", "Swelling in Legs", "Black Stool", "Blood in Stool", "Repeated Vomiting", "Rapid Unexplained Weight Loss", "Severe Headache During Exercise", "Fainting", "None", "Other"],
    note: "Anything other than None is a stop-and-check, not a note for later.",
  },
  { id: "q21c", label: "Dietitian safety decision", type: "single", section: "4", tag: "clinical", showIf: includesOtherThan("q21", ["None"]), options: ["Continue Normally", "Clinical Dietitian Review", "Doctor Clearance Recommended", "SOP Escalation Required"] },
  {
    id: "q22",
    label: "Has any doctor advised specific dietary or exercise restrictions?",
    type: "multi",
    section: "4",
    tag: "clinical",
    required: true,
    options: ["Low Salt", "Fluid Restriction", "Protein Restriction", "Potassium Restriction", "Purine Restriction", "Gluten Free", "Lactose Free", "Low Fat", "Low Sugar", "Food-Medicine Timing", "Exercise Restriction", "Avoid Heavy Lifting", "Other", "No Restrictions"],
    note: "A doctor's instruction overrides every other planning decision, including the client's own preferences.",
  },
  { id: "q22a", label: "Instruction details", type: "textarea", section: "4", showIf: includesOtherThan("q22", ["No Restrictions"]), placeholder: "e.g. fluid restricted to 1.5 L/day; protein max 0.8 g/kg per nephrologist; no high-intensity cardio" },
  {
    id: "q66",
    label: "Are there hormonal or reproductive-health factors that may affect your nutrition journey?",
    type: "multi",
    section: "4",
    tag: "clinical",
    options: ["Regular Cycle", "Irregular Periods", "Missed Periods", "Heavy Bleeding", "Severe Pain", "PCOS", "Endometriosis", "Trying to Conceive", "Pregnant", "Breastfeeding", "Postpartum", "Perimenopause", "Menopause", "Low Testosterone Diagnosed", "Fertility Treatment", "None", "Prefer Not to Answer", "Not Applicable"],
    note: "Never push for an answer here. Pregnancy and breastfeeding stop any deficit-led plan outright.",
  },
  {
    id: "q66_cycle",
    label: "Are your periods regular?",
    type: "single",
    section: "4",
    tag: "clinical",
    showIf: hasReproFactor,
    options: ["Regular (25–35 days)", "Irregular", "No period for 3+ months", "Stopped — menopause", "No natural cycle — hormonal contraception", "Prefer not to answer"],
    note: "Never push. Move on the moment the client sounds uncomfortable.",
  },
  {
    id: "q66_lmp",
    label: "First day of the last period",
    type: "date",
    section: "4",
    showIf: hasReproFactor,
    help: "Follow-up weight is read against the cycle — without this date, normal premenstrual water weight looks like a plateau.",
  },
  {
    id: "q66_symptoms",
    label: "What changes around your period?",
    type: "multi",
    section: "4",
    tag: "clinical",
    showIf: hasReproFactor,
    options: ["Increased appetite", "Sugar or carb cravings", "Bloating or water weight", "Fatigue", "Low mood or irritability", "Poor sleep", "Digestive changes", "Headache or migraine", "Painful cramps", "Heavy bleeding", "No noticeable change"],
    note: "Heavy bleeding with fatigue is an iron and B12 question — check it against the blood-report answers in this section.",
  },
  {
    id: "q66_phase",
    label: "When is eating hardest?",
    type: "single",
    section: "4",
    showIf: hasReproFactor,
    options: ["Week before the period", "During bleeding", "Mid-cycle", "No particular pattern"],
    help: "Names the days the plan has to survive — that is when the higher-protein, higher-volume meals and the planned treat belong.",
  },
  {
    id: "q66_contraception",
    label: "Hormonal contraception or hormone treatment",
    type: "single",
    section: "4",
    tag: "clinical",
    showIf: hasReproFactor,
    options: ["None", "Combined pill", "Progestin-only pill", "Hormonal IUD", "Injection or implant", "HRT", "Fertility treatment", "Prefer not to answer"],
    note: "Several of these drive appetite and water retention on their own — worth knowing before a stall gets blamed on the plan.",
  },
]

// ---------------------------------------------------------------------------
// Section 5 — Digestion, allergies & food tolerance (37 = 15 hand + 22 generated)
// ---------------------------------------------------------------------------

const ALLERGENS: { label: string; slug: string }[] = [
  { label: "Milk", slug: "milk" },
  { label: "Egg", slug: "egg" },
  { label: "Peanut", slug: "peanut" },
  { label: "Tree nuts", slug: "tree_nuts" },
  { label: "Wheat", slug: "wheat" },
  { label: "Soy", slug: "soy" },
  { label: "Fish", slug: "fish" },
  { label: "Shellfish", slug: "shellfish" },
  { label: "Sesame", slug: "sesame" },
  { label: "Curd", slug: "curd" },
  { label: "Paneer", slug: "paneer" },
  { label: "Dal", slug: "dal" },
  { label: "Chickpeas", slug: "chickpeas" },
  { label: "Rajma or beans", slug: "rajma_or_beans" },
  { label: "Onion", slug: "onion" },
  { label: "Garlic", slug: "garlic" },
  { label: "Spicy food", slug: "spicy_food" },
  { label: "Fried food", slug: "fried_food" },
  { label: "High-fat food", slug: "high_fat_food" },
  { label: "Artificial sweeteners", slug: "artificial_sweeteners" },
  { label: "Protein powder", slug: "protein_powder" },
  { label: "Other", slug: "other" },
]

const ALLERGEN_TYPE_QUESTIONS: Question[] = ALLERGENS.map(({ label, slug }) => ({
  id: `q27_${slug}_type`,
  label: `${label} — which is it?`,
  type: "single",
  section: "5",
  tag: "clinical",
  showIf: includesValue("q27", label),
  requiredIf: includesValue("q27", label),
  options: ALLERGY_TYPE_OPTIONS,
}))

const hasAllergyOrIntolerance = includesOtherThan("q27", ["No known allergy or intolerance"])

const SECTION_5: Question[] = [
  {
    id: "q23",
    label: "How would you describe your digestion overall?",
    type: "single",
    section: "5",
    tag: "core",
    required: true,
    options: ["Excellent", "Mostly Comfortable", "Occasionally Uncomfortable", "Frequently Uncomfortable", "Daily Digestive Problems", "Severe Digestive Issues", "Not Sure"],
  },
  {
    id: "q24",
    label: "Digestive symptoms",
    type: "multi",
    section: "5",
    tag: "clinical",
    options: ["Bloating", "Gas", "Acidity", "Heartburn", "Acid Reflux", "Constipation", "Loose Motions", "Alternating Bowel Pattern", "Stomach Pain", "Cramps", "Nausea", "Vomiting", "Early Fullness", "Excessive Burping", "None", "Other"],
  },
  { id: "q24a", label: "Frequency of the main symptom", type: "single", section: "5", showIf: includesOtherThan("q24", ["None"]), options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"] },
  { id: "q24b", label: "Timing", type: "multi", section: "5", showIf: includesOtherThan("q24", ["None"]), options: ["Morning", "After breakfast", "After lunch", "Evening", "After dinner", "Night", "After specific foods", "During stress", "Around training", "Random"] },
  { id: "q24c", label: "Severity (1–10)", type: "scale10", section: "5", showIf: includesOtherThan("q24", ["None"]) },
  {
    id: "q24d",
    label: "Food association",
    type: "text",
    section: "5",
    showIf: includesOtherThan("q24", ["None"]),
    placeholder: "e.g. worse after dal and rajma; fine on plain khichdi days",
    help: "A symptom tied to a food is a plan constraint; a symptom tied to nothing is a monitoring item.",
  },
  {
    id: "q25",
    label: "Bowel frequency",
    type: "single",
    section: "5",
    tag: "core",
    required: true,
    options: ["More than 3 times daily", "2–3 times daily", "Once daily", "Once every 2 days", "Less than 3 times weekly", "Highly irregular", "Prefer not to answer"],
  },
  {
    id: "q27",
    label: "Any food that causes a problem — allergy or intolerance?",
    type: "multi",
    section: "5",
    tag: "clinical",
    required: true,
    options: ["No known allergy or intolerance", "Milk", "Egg", "Peanut", "Tree nuts", "Wheat", "Soy", "Fish", "Shellfish", "Sesame", "Curd", "Paneer", "Dal", "Chickpeas", "Rajma or beans", "Onion", "Garlic", "Spicy food", "Fried food", "High-fat food", "Artificial sweeteners", "Protein powder", "Other"],
    note: "Name every food first — you say which is an allergy and which an intolerance underneath. An allergen never appears in any meal, in any form; a trigger food is reduced, timed differently or retested smaller.",
  },
  ...ALLERGEN_TYPE_QUESTIONS,
  {
    id: "q27d",
    label: "What happens when they eat it?",
    type: "textarea",
    section: "5",
    tag: "clinical",
    showIf: hasAllergyOrIntolerance,
    placeholder: "e.g. Egg — lips swell and throat tightens within minutes; Peanut — hives and vomiting",
    note: "One line per allergen. Record the reaction as described, then classify it below.",
  },
  { id: "q27a", label: "Reaction severity", type: "single", section: "5", tag: "clinical", showIf: hasAllergyOrIntolerance, options: ["Mild", "Moderate", "Severe", "Previous emergency reaction", "Unknown"] },
  { id: "q27b", label: "Professionally diagnosed?", type: "single", section: "5", tag: "clinical", showIf: hasAllergyOrIntolerance, options: ["Yes", "No", "Not sure"] },
  { id: "q27c", label: "Other food — name it", type: "text", section: "5", showIf: includesValue("q27", "Other") },
  { id: "q26a", label: "Reaction / symptoms", type: "multi", section: "5", showIf: hasAllergyOrIntolerance, options: ["Bloating", "Gas", "Acidity", "Reflux", "Pain", "Nausea", "Loose stools", "Constipation", "Skin reaction", "Other"] },
  { id: "q26d", label: "Frequency of the reaction", type: "single", section: "5", showIf: hasAllergyOrIntolerance, options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"] },
  {
    id: "q26b",
    label: "Reproducibility",
    type: "single",
    section: "5",
    showIf: hasAllergyOrIntolerance,
    options: ["Almost every time", "Often", "Sometimes", "Client is unsure"],
    help: "A food that reacts almost every time is excluded; one that reacts sometimes is retested with a smaller portion.",
  },
]

// ---------------------------------------------------------------------------
// Section 6 — Dietary intake, food pattern & protein (89 = 21 hand + 68 generated)
// ---------------------------------------------------------------------------

const EATING_OCCASIONS: { label: string; slug: string; kind: "textarea" | "variants" }[] = [
  { label: "Wake-up Drinks", slug: "wake", kind: "textarea" },
  { label: "Breakfast", slug: "breakfast", kind: "variants" },
  { label: "Mid-Morning", slug: "midmorning", kind: "variants" },
  { label: "Lunch", slug: "lunch", kind: "variants" },
  { label: "Afternoon", slug: "afternoon", kind: "variants" },
  { label: "Evening", slug: "evening", kind: "variants" },
  { label: "Pre-Workout", slug: "preworkout", kind: "textarea" },
  { label: "During Workout", slug: "duringworkout", kind: "textarea" },
  { label: "Post-Workout", slug: "postworkout", kind: "variants" },
  { label: "Dinner", slug: "dinner", kind: "variants" },
  { label: "After Dinner", slug: "afterdinner", kind: "textarea" },
  { label: "Late-Night Food", slug: "beforesleep", kind: "textarea" },
  { label: "Beverages", slug: "beverages", kind: "textarea" },
  { label: "Snacks", slug: "snacks", kind: "textarea" },
  { label: "Tasting While Cooking", slug: "tasting", kind: "textarea" },
  { label: "Small Bites", slug: "smallbites", kind: "textarea" },
  { label: "Alcohol", slug: "alcohol", kind: "textarea" },
]

const EATING_OCCASION_QUESTIONS: Question[] = EATING_OCCASIONS.flatMap(({ label, slug, kind }) => {
  const showIf = includesValue("q28", label)
  const foodQuestion: Question =
    kind === "variants"
      ? {
          id: `q112_${slug}_variants`,
          label: `${label} — what do they actually have, and how often?`,
          type: "mealVariants",
          section: "6",
          tag: "core",
          showIf,
          note: "One option per thing they eat, with foods and quantities, then how many days a week it happens. Qualitative context for the dietitian, not auto-costed — free-text food matching isn't reliable enough for a clinical number. Enter the actual estimate in the Estimated current daily calories/protein/carbs/fat fields below (q29b) once this picture is clear.",
        }
      : {
          id: `q28_${slug}_food`,
          label: `${label} — what, with quantity`,
          type: "textarea",
          section: "6",
          showIf,
          placeholder: "e.g. tea with 1 tsp sugar · 2 biscuits · 1 peg whisky",
        }
  return [
    { id: `q28_${slug}_time`, label: `${label} — exact or approximate time`, type: "time", section: "6", showIf },
    foodQuestion,
    { id: `q28_${slug}_drinks`, label: `${label} — anything to drink?`, type: "portions", section: "6", showIf, options: DRINK_OPTIONS },
    { id: `q28_${slug}_beverage`, label: `${label} — any other drink`, type: "text", section: "6", showIf, placeholder: "only if it is not in the list above" },
  ]
})

const hasDayRules = includesOtherThan("q38", ["No restriction", "Prefer not to answer"])

const SECTION_6: Question[] = [
  {
    id: "q33",
    label: "What food pattern do you follow?",
    type: "single",
    section: "6",
    tag: "core",
    required: true,
    options: ["Vegetarian", "Eggetarian", "Vegan", "Non-vegetarian", "Pescatarian", "Flexitarian", "Jain", "Other"],
  },
  {
    id: "q38",
    label: "Cultural or religious food practices",
    type: "multi",
    section: "6",
    tag: "clinical",
    required: true,
    options: ["No restriction", "Vegetarian household", "Vegan preference", "Jain restrictions", "Halal", "Kosher", "No beef", "No pork", "No egg", "No non-vegetarian food on selected days", "Fasting practice", "Separate cooking not allowed", "Ethical or environmental restriction", "Prefer not to answer", "Other"],
    help: "Weekday rules live here — \"no non-veg on Tuesday and Saturday\", Navratri or Shravan fasts, no onion and garlic on certain days. Select the practice and the day questions open up; the plan then holds those weekdays, so this must be asked even when the client does not raise it.",
  },
  {
    id: "q38a",
    label: "On which days do these rules apply?",
    type: "multi",
    section: "6",
    showIf: hasDayRules,
    options: WEEKDAYS,
    note: "Tuesday and Saturday are the usual pair, but confirm rather than assume — Monday, Thursday and Friday are all common too.",
  },
  {
    id: "q38b",
    label: "What is avoided on those days?",
    type: "multi",
    section: "6",
    showIf: hasDayRules,
    requiredIf: hasDayRules,
    options: ["Non-vegetarian food", "Eggs", "Onion & garlic", "All animal products", "Specific grains (fasting)", "Other"],
  },
  {
    id: "q38c",
    label: "Day-rule details",
    type: "text",
    section: "6",
    showIf: hasDayRules,
    placeholder: "e.g. Tuesdays & Saturdays — no non-veg or eggs; Navratri fasts",
    note: "These day rules are enforced per weekday in the generated plan, so vague answers produce wrong days.",
  },
  {
    id: "q28",
    label: "Eating occasions during the previous complete day",
    type: "multi",
    section: "6",
    tag: "core",
    required: true,
    options: EATING_OCCASIONS.map((o) => o.label),
    note: "Include tasting while cooking, small bites and anything drunk — these are the occasions clients leave out unless asked by name.",
  },
  ...EATING_OCCASION_QUESTIONS,
  {
    id: "q109a",
    label: "Which meals are usually skipped, delayed or replaced?",
    type: "multi",
    section: "6",
    tag: "core",
    options: ["Breakfast usually skipped", "Breakfast usually delayed", "Breakfast usually replaced", "Mid-morning usually skipped", "Lunch usually skipped", "Lunch usually delayed", "Lunch usually replaced", "Evening snack usually skipped", "Dinner usually skipped", "Dinner usually delayed", "Dinner usually replaced", "No meal is regularly missed"],
  },
  {
    id: "q30",
    label: "How does your eating and activity usually change on weekends or holidays?",
    type: "multi",
    section: "6",
    tag: "core",
    options: ["Wake-up Time", "Breakfast", "Meal Timing", "Portion Sizes", "Number of Meals", "Outside Food", "Restaurant/Delivery", "Snacks", "Sweets", "Alcohol", "Late-Night Eating", "Protein Intake", "Total Activity"],
    note: "Select what differs from a weekday, then describe the direction of each change while asking.",
  },
  { id: "q30a", label: "Weekend difference", type: "single", section: "6", tag: "planning", options: ["No Meaningful Difference", "Mild Difference", "Moderate Difference", "Major Difference"] },
  {
    id: "q30b",
    label: "Potential weekend calorie impact",
    type: "single",
    section: "6",
    tag: "planning",
    options: ["Lower", "Similar", "Moderately Higher", "Significantly Higher", "Unable to Estimate"],
    help: "Two heavy weekend days can erase a whole week's deficit — the weekend has to be planned, not ignored.",
  },
  {
    id: "q29",
    label: "How consistent is this eating pattern from week to week?",
    type: "single",
    section: "6",
    tag: "core",
    required: true,
    options: ["Very Consistent", "Weekdays Are Usually Consistent", "Weekends Are Significantly Different", "Intake Changes Every Day", "Work Schedule Changes My Food", "Travel Frequently Changes My Food", "I Eat Differently When Stressed", "I Eat Differently Around Workouts", "No Consistent Pattern"],
  },
  {
    id: "q29a",
    label: "Habitual intake confidence",
    type: "single",
    section: "6",
    tag: "planning",
    options: ["High", "Moderate", "Low", "Additional Dietary Recall Required"],
    note: "Estimate calories from the habitual pattern and several data points. One reported day on its own does not support a calorie target.",
  },
  {
    id: "q29b_est_kcal",
    label: "Estimated current daily calories",
    type: "number",
    section: "6",
    tag: "planning",
    placeholder: "e.g. 1800",
    help: "Not in the original counselling PDF — added to actually record the estimate q29a asks for. The dietitian's estimate from the habitual pattern above, never a single recalled day. Feeds the roadmap's protein ramp and already-below-target check; leave blank if confidence is too low to estimate (q29a).",
  },
  {
    id: "q29b_est_protein_g",
    label: "Estimated current daily protein (g)",
    type: "number",
    section: "6",
    tag: "planning",
    placeholder: "e.g. 55",
  },
  {
    id: "q29b_est_carbs_g",
    label: "Estimated current daily carbohydrates (g)",
    type: "number",
    section: "6",
    tag: "planning",
    placeholder: "e.g. 210",
  },
  {
    id: "q29b_est_fat_g",
    label: "Estimated current daily fat (g)",
    type: "number",
    section: "6",
    tag: "planning",
    placeholder: "e.g. 60",
  },
  { id: "q50a", label: "Meals per day with a clear protein source", type: "single", section: "6", tag: "planning", required: true, options: ["0", "1", "2", "3", "4 or more", "Not sure"] },
  {
    id: "q50b",
    label: "Protein barriers",
    type: "multi",
    section: "6",
    tag: "planning",
    maxSelect: 3,
    options: ["Lack of knowledge", "Vegetarian pattern", "Vegan pattern", "Cooking", "Cost", "Digestion", "Taste", "Low appetite", "Availability", "Family food pattern", "Work schedule", "Carrying food", "Dislike protein foods", "Become too full", "Protein-powder concern", "Kidney or liver concern", "Cultural restriction", "No major barrier", "Other"],
  },
  {
    id: "q110",
    label: "What cooking fats and additions are commonly used in your household?",
    type: "multi",
    section: "6",
    tag: "core",
    options: ["Ghee", "Butter", "Oil", "Cheese", "Mayonnaise", "Sauces", "Chutney", "Pickle", "Sugar", "Honey", "Jaggery", "Cream", "None"],
    help: "Household cooking fat is the single biggest hidden calorie source in an Indian kitchen and never appears in a food recall.",
  },
  { id: "q110a", label: "Frequency and approximate quantity of the selected items", type: "textarea", section: "6", showIf: includesOtherThan("q110", ["None"]), placeholder: "e.g. ghee 1 tsp per roti, daily; pickle most lunches; cream in weekend gravies" },
  { id: "q110f", label: "Salt type", type: "single", section: "6", tag: "core", options: ["Iodized", "Himalayan Pink", "Rock", "Black", "Low Sodium", "Mixed", "Other"] },
  { id: "q110g", label: "Flour types used regularly", type: "multi", section: "6", tag: "core", options: ["Wheat", "Multigrain", "Ragi", "Bajra", "Jowar", "Maize", "Oats", "Mixed Millet", "Gluten-Free", "Other"] },
  {
    id: "q31",
    label: "How often do you eat food prepared outside your home?",
    type: "single",
    section: "6",
    tag: "core",
    required: true,
    options: ["More than once daily", "Daily", "4–6 times weekly", "2–3 times weekly", "Once weekly", "1–3 times monthly", "Rarely"],
  },
  { id: "q31a", label: "Main sources", type: "multi", section: "6", showIf: (a) => a.q31 !== undefined && a.q31 !== "Rarely", options: ["Restaurant", "Delivery", "Office or canteen", "College", "Hotel", "Business or client meals", "Family meals", "Street food", "Travel food"] },
  { id: "q31b", label: "Typical orders and portions", type: "textarea", section: "6", showIf: (a) => a.q31 !== undefined && a.q31 !== "Rarely", placeholder: "e.g. butter chicken + 2 naan; masala dosa; chicken biryani full plate" },
]

// ---------------------------------------------------------------------------
// Section 7 — Food preferences, cultural habits & household feasibility (13)
// ---------------------------------------------------------------------------

const SECTION_7: Question[] = [
  {
    id: "q34",
    label: "What cuisine does your household normally follow?",
    type: "multi",
    section: "7",
    tag: "core",
    required: true,
    maxSelect: 3,
    options: ["North Indian", "Punjabi", "Gujarati", "Rajasthani", "Maharashtrian", "Bengali", "Bihari or Jharkhand", "South Indian", "Kerala-style", "Tamil", "Telugu", "Karnataka", "North-East Indian", "Kashmiri", "Indian mixed", "Middle Eastern", "Mediterranean", "East Asian", "South-East Asian", "European or Western", "African", "Latin American", "Mixed or international", "Other"],
  },
  {
    id: "q34c",
    label: "Regular staple foods",
    type: "multi",
    section: "7",
    tag: "planning",
    options: ["Roti", "Rice", "Paratha", "Bread", "Oats", "Poha", "Upma", "Idli", "Dosa", "Millet", "Pasta", "Noodles", "Potato", "Other"],
    help: "Staples anchor the plan — they are portioned and improved, not replaced.",
  },
  { id: "q34f", label: "Frequency of major staples", type: "textarea", section: "7", tag: "planning", placeholder: "e.g. roti twice daily (3–4 each time); rice at lunch only; poha 2 mornings a week" },
  {
    id: "q35",
    label: "Which foods do you genuinely enjoy and want to keep? (up to 15, top 5 first)",
    type: "textarea",
    section: "7",
    tag: "planning",
    required: true,
    placeholder: "e.g. rajma chawal, paneer bhurji, masala dosa, filter coffee, fruit chaat …",
    help: "Favourite foods are retained wherever clinically possible — a plan that deletes all of them is abandoned in week two.",
    note: "Click in priority order — first click = rank 1.",
  },
  {
    id: "q36",
    label: "Which foods do you dislike, avoid or never want included?",
    type: "textarea",
    section: "7",
    tag: "planning",
    placeholder: "e.g. lauki, karela, tinda",
    note: "Allergies and intolerances belong in Stage 5 — do not repeat them here.",
  },
  { id: "q36a", label: "Classify", type: "single", section: "7", showIf: isTruthy("q36"), options: ["Mild Dislike", "Strong Dislike", "Never Eat", "Religious Restriction", "Ethical Restriction"] },
  {
    id: "q37",
    label: "Which foods or eating habits are non-negotiable for you? (rank top 5)",
    type: "multi",
    section: "7",
    tag: "planning",
    required: true,
    maxSelect: 5,
    options: ["Tea", "Coffee", "Rice", "Roti", "Bread", "Milk", "Sweets or dessert", "Chocolate", "Weekend restaurant meal", "Social meal", "Traditional household food", "Current breakfast", "Evening snack", "Late dinner due to routine", "No strong non-negotiable", "Other"],
    help: "Non-negotiables stay in the plan. The meal around them is improved; they are not deleted.",
    note: "Click in priority order — first click = rank 1.",
  },
  {
    id: "q39",
    label: "Who is the primary meal preparer in your household?",
    type: "multi",
    section: "7",
    tag: "core",
    required: true,
    options: ["Self", "Spouse or partner", "Parent or family", "Cook or helper", "PG or hostel kitchen", "Office or canteen", "Tiffin service", "Restaurant or delivery", "Varies"],
  },
  { id: "q39a", label: "Control over food choices", type: "single", section: "7", tag: "planning", options: ["High", "Moderate", "Low"] },
  {
    id: "q39b",
    label: "Ability to request modifications",
    type: "single",
    section: "7",
    tag: "planning",
    options: ["Yes", "Sometimes", "No"],
    help: "Low control plus no ability to request changes means the plan must work with the food already being cooked.",
  },
  { id: "q39c", label: "Relevant household limitations", type: "text", section: "7", tag: "planning", placeholder: "e.g. one common gravy for six people; cook leaves by 8 AM" },
  {
    id: "q40",
    label: "Facilities available",
    type: "multi",
    section: "7",
    tag: "core",
    options: ["Full Kitchen", "Basic Kitchen", "Refrigerator", "Freezer", "Microwave", "Office Refrigerator", "Office Microwave", "Meal Carrying Capability", "Other"],
  },
  {
    id: "q41",
    label: "Realistic meal preparation",
    type: "multi",
    section: "7",
    tag: "planning",
    required: true,
    options: ["Daily Cooking", "Simple Cooking", "Batch Cooking", "Weekly Prep", "Family Help", "Very Limited", "No Extra Cooking", "Max 5 Minutes", "Max 10–15 Minutes", "Max 30 Minutes"],
    help: "Everything the plan asks the client to cook has to fit inside this answer, or it will not be cooked.",
  },
]

// ---------------------------------------------------------------------------
// Section 8 — Daily activity & NEAT (11)
// ---------------------------------------------------------------------------

const SECTION_8: Question[] = [
  {
    id: "q54c",
    label: "Outside planned exercise, how active are you during a normal day?",
    type: "single",
    section: "8",
    tag: "core",
    required: true,
    options: ["Mostly seated", "Lightly active", "Moderately active", "Active", "Highly physical"],
  },
  { id: "q111", label: "Sitting time", type: "single", section: "8", tag: "core", options: ["<4 Hours", "4–6 Hours", "6–8 Hours", "8–10 Hours", ">10 Hours", "Variable", "Don't Know"] },
  { id: "q111a", label: "Standing or moving time", type: "single", section: "8", tag: "core", options: ["<1 Hour", "1–2 Hours", "2–4 Hours", "4–6 Hours", ">6 Hours", "Variable"] },
  {
    id: "q106",
    label: "Average daily step count",
    type: "single",
    section: "8",
    tag: "core",
    required: true,
    options: ["<3,000", "3,000–5,000", "5,000–8,000", "8,000–10,000", "10,000–12,000", ">12,000", "Don't Know"],
  },
  { id: "q54f", label: "Tracking source", type: "single", section: "8", showIf: (a) => a.q106 !== undefined && a.q106 !== "Don't Know", options: ["Phone", "Smartwatch", "Fitness Tracker", "Estimate"], note: "A phone in a pocket undercounts and an estimate is a guess — neither should be treated as measured data." },
  { id: "q112", label: "Weekday steps", type: "number", section: "8", tag: "core" },
  { id: "q112a", label: "Weekend steps", type: "number", section: "8", tag: "core" },
  { id: "q112b", label: "Weekend activity compared with weekday", type: "single", section: "8", tag: "core", options: ["Much Lower", "Slightly Lower", "Similar", "Slightly Higher", "Much Higher", "Variable"] },
  { id: "q112c", label: "Weekend sitting time compared with weekday", type: "single", section: "8", tag: "core", options: ["Much Higher", "Slightly Higher", "Similar", "Lower", "Variable"] },
  {
    id: "q112d",
    label: "NEAT classification",
    type: "single",
    section: "8",
    tag: "planning",
    options: ["Very Low NEAT", "Low NEAT", "Moderate NEAT", "High NEAT", "Very High NEAT"],
    note: "Judge on steps plus sitting, standing, occupation, commute, household movement and the weekday/weekend difference — not steps alone.",
  },
  { id: "q112e", label: "NEAT confidence", type: "single", section: "8", tag: "planning", options: ["High", "Moderate", "Low"] },
]

// ---------------------------------------------------------------------------
// Section 9 — Exercise, training & recovery (25)
// ---------------------------------------------------------------------------

const isCurrentlyTraining = includesOtherThan("q43", ["Currently not exercising"])

const SECTION_9: Question[] = [
  {
    id: "q43",
    label: "Tell me about your current exercise or training routine.",
    type: "multi",
    section: "9",
    tag: "fitness",
    required: true,
    options: ["Starting with LeanR PT", "Strength training", "Cardio machines", "Running", "Walking", "Yoga", "Pilates", "Swimming", "Cycling", "Sports", "Home workout", "HIIT", "Group classes", "Rehabilitation exercise", "Currently not exercising", "Other"],
  },
  { id: "q44a", label: "Days per week", type: "single", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["0", "1", "2", "3", "4", "5", "6", "7", "Variable"] },
  { id: "q44b", label: "Duration", type: "single", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Less than 30 minutes", "30–45 minutes", "45–60 minutes", "60–90 minutes", "More than 90 minutes", "Variable"] },
  {
    id: "q44c",
    label: "Timing",
    type: "single",
    section: "9",
    tag: "fitness",
    showIf: isCurrentlyTraining,
    options: ["Early morning", "Morning", "Afternoon", "Evening", "Night", "Variable"],
    help: "Training time decides where the carbohydrate and protein go, not just how much.",
  },
  { id: "q44g", label: "Location", type: "single", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Gym", "Home", "Outdoor", "Mixed"] },
  {
    id: "q44d",
    label: "Training experience",
    type: "single",
    section: "9",
    tag: "fitness",
    required: true,
    options: ["Complete beginner", "Less than 6 months", "6–12 months", "1–3 years", "More than 3 years", "Returning after a break"],
  },
  { id: "q44e", label: "Intensity", type: "single", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Very light", "Light", "Moderate", "Hard", "Very hard", "Variable", "Not sure"] },
  {
    id: "q45",
    label: "How do you feel during exercise?",
    type: "multi",
    section: "9",
    tag: "fitness",
    showIf: isCurrentlyTraining,
    options: ["Good energy", "Low energy before starting", "Energy drops early", "Energy drops midway", "Excessive hunger", "Weakness", "Dizziness", "Nausea", "Cramps", "Unusual breathlessness", "Headache", "Shakiness", "Too full or heavy", "No major problem", "Other"],
    note: "Dizziness, unusual breathlessness or shakiness during training is a clinical signal, not a fuelling detail.",
  },
  {
    id: "q46",
    label: "How do you feel after exercise and between sessions?",
    type: "multi",
    section: "9",
    tag: "fitness",
    showIf: isCurrentlyTraining,
    options: ["Recover well", "Mild normal soreness", "Excessive soreness", "Soreness for several days", "Persistent fatigue", "Strength declining", "Performance declining", "Poor sleep", "Excessive hunger", "Low appetite", "Frequent cramps", "Feel dehydrated", "Other"],
  },
  { id: "q47", label: "Before training", type: "multi", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Full meal", "Small meal", "Snack", "Fruit or carbohydrate source", "Protein food", "Protein shake", "Pre-workout supplement", "Caffeine", "Water only", "Train fasted", "Variable"] },
  { id: "q47a", label: "How long before training?", type: "single", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Less than 30 minutes before", "30–60 minutes before", "1–2 hours before", "2–3 hours before", "More than 3 hours before"] },
  { id: "q48", label: "During training", type: "multi", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Nothing", "Water", "Electrolytes", "Sports drink", "Carbohydrate drink or gel", "BCAA or EAA", "Other supplement", "Food"] },
  { id: "q49", label: "After training", type: "multi", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Full meal", "Small meal", "Protein-rich food", "Protein shake", "Fruit or carbohydrate source", "Milk or dairy beverage", "Water only", "Nothing for several hours", "Variable"] },
  { id: "q49a", label: "How soon after training?", type: "single", section: "9", tag: "fitness", showIf: isCurrentlyTraining, options: ["Less than 30 minutes", "30–60 minutes", "1–2 hours", "2–3 hours", "More than 3 hours"] },
  {
    id: "q51",
    label: "Do you currently use any supplements?",
    type: "multi",
    section: "9",
    tag: "clinical",
    required: true,
    options: ["Protein powder", "Creatine", "Pre-workout", "BCAA or EAA", "Electrolytes", "Mass gainer", "Fat burner", "Multivitamin", "Vitamin D", "Vitamin B12", "Iron", "Calcium", "Omega-3", "Magnesium", "Herbal or Ayurvedic product", "None", "Other"],
  },
  { id: "q51c", label: "For each — product, dose, frequency, purpose", type: "textarea", section: "9", showIf: includesOtherThan("q51", ["None"]), placeholder: "e.g. whey 1 scoop post-workout daily; Vitamin D 60k IU weekly for deficiency" },
  { id: "q51a", label: "Recommended by", type: "single", section: "9", showIf: includesOtherThan("q51", ["None"]), options: ["Doctor", "Dietitian", "Personal Trainer", "Friend or family", "Social media", "Self", "Other"] },
  { id: "q51b", label: "Side effects", type: "multi", section: "9", showIf: includesOtherThan("q51", ["None"]), options: ["None", "Digestive issue", "Headache", "Sleep issue", "Palpitations", "Skin issue", "Other"] },
  {
    id: "q53",
    label: "Do you have any pain, injury or movement limitations affecting exercise?",
    type: "multi",
    section: "9",
    tag: "fitness",
    required: true,
    options: ["Knee", "Lower back", "Upper back", "Neck", "Shoulder", "Elbow or wrist", "Hip", "Ankle or foot", "Previous fracture", "Post-surgery limitation", "Medically restricted movement", "No limitation", "Other"],
  },
  { id: "q53c", label: "Severity", type: "single", section: "9", showIf: includesOtherThan("q53", ["No limitation"]), options: ["Mild", "Moderate", "Severe", "Variable"] },
  { id: "q53d", label: "Duration", type: "single", section: "9", showIf: includesOtherThan("q53", ["No limitation"]), options: ["Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "More than 1 year"] },
  { id: "q53e", label: "Activities affected", type: "text", section: "9", showIf: includesOtherThan("q53", ["No limitation"]), placeholder: "e.g. cannot squat below parallel; stairs painful after 10 minutes" },
  { id: "q53a", label: "Professional assessment", type: "single", section: "9", showIf: includesOtherThan("q53", ["No limitation"]), options: ["Doctor", "Physiotherapist", "Personal Trainer", "Self-observed", "Not assessed"] },
  {
    id: "q52",
    label: "Have you noticed any signs that your body may not be fuelling or recovering well?",
    type: "multi",
    section: "9",
    tag: "clinical",
    required: true,
    options: ["Persistent tiredness", "Feeling unusually cold", "Frequent illness", "Frequent injuries", "Stress fracture or bone injury", "Declining performance", "Loss of strength", "Poor recovery", "Difficulty concentrating", "Significant irritability or mood change", "Reduced sex drive", "Menstrual cycle irregular or stopped", "Unintentional weight loss", "Training while eating very little", "Fear of increasing food despite high training", "None", "Other"],
    help: "Under-fuelling screen (RED-S) — changes the energy strategy.",
  },
  { id: "q52a", label: "Did this coincide with…", type: "multi", section: "9", showIf: includesOtherThan("q52", ["None"]), options: ["Increased training", "Reduced food intake", "Rapid weight loss", "Increased stress", "Poor sleep", "Illness", "Not sure"] },
]

// ---------------------------------------------------------------------------
// Section 10 — Hunger & eating behaviour (18)
// ---------------------------------------------------------------------------

const SECTION_10: Question[] = [
  {
    id: "q56",
    label: "How would you describe your hunger and appetite throughout the day?",
    type: "single",
    section: "10",
    tag: "core",
    required: true,
    options: ["Stable", "Low hunger most of the day", "High morning hunger", "High lunch hunger", "High evening hunger", "High night hunger", "Extreme post-workout hunger", "Unpredictable", "Often eat without physical hunger", "Not sure"],
    help: "The appetite phenotype decides where the calories are placed — an evening-hunger client fails a big-breakfast plan.",
  },
  { id: "q56a", label: "Hungriest time", type: "single", section: "10", tag: "core", options: ["Early morning", "Mid-morning", "Lunch", "Afternoon", "Evening", "Night", "Post-workout", "Variable"] },
  { id: "q56b", label: "Low-appetite periods", type: "multi", section: "10", tag: "core", options: ["Early morning", "Mid-morning", "Lunch", "Afternoon", "Evening", "Night", "Immediately after training", "During stress", "No low-appetite period"] },
  {
    id: "q57",
    label: "Appetite variability",
    type: "multi",
    section: "10",
    tag: "core",
    options: ["Good", "Very strong", "Low", "Variable", "Become full quickly", "Struggle to finish meals", "Forget to eat", "Delay eating despite hunger", "Hungry but not interested in food", "Reduced after training", "Increased after training", "Reduced by stress", "Increased by stress", "No concern"],
  },
  {
    id: "q55",
    label: "Are there particular meals or times of day that are difficult to manage?",
    type: "multi",
    section: "10",
    tag: "core",
    required: true,
    maxSelect: 3,
    options: ["Early morning", "Breakfast", "Mid-morning", "Lunch", "Afternoon", "Evening", "Pre-workout", "Post-workout", "Dinner", "Late night", "Weekend", "Travel", "Social events", "No specific time"],
  },
  { id: "q55b", label: "How difficult", type: "single", section: "10", showIf: includesOtherThan("q55", ["No specific time"]), options: ["Slightly difficult", "Moderately difficult", "Very difficult", "Usually goes wrong"] },
  { id: "q55a", label: "Reason", type: "multi", section: "10", showIf: includesOtherThan("q55", ["No specific time"]), options: ["No time", "No appetite", "Excessive hunger", "Meetings", "No meal break", "Food unavailable", "Cannot carry food", "Family routine", "Cravings", "Stress", "Commute", "Training timing", "Tiredness", "Cooking difficulty", "Other"] },
  {
    id: "q58",
    label: "What food cravings do you experience?",
    type: "multi",
    section: "10",
    tag: "core",
    required: true,
    options: ["Sweets or mithai", "Chocolate", "Bakery foods", "Fried foods", "Salty snacks", "Chips or namkeen", "Fast food", "Carbohydrate-rich foods", "Sugary drinks", "Tea or coffee", "Late-night food", "No strong cravings", "Other"],
  },
  {
    id: "q58a",
    label: "Trigger",
    type: "multi",
    section: "10",
    maxSelect: 3,
    showIf: includesOtherThan("q58", ["No strong cravings"]),
    options: ["Hunger", "Stress", "Boredom", "Poor sleep", "Menstrual cycle", "Previous restriction", "Social situation", "Food cues", "Work pressure", "Habit", "Post-workout", "Other"],
    help: "A craving driven by previous restriction is fixed by feeding more, not by more willpower.",
  },
  { id: "q58b", label: "Timing", type: "single", section: "10", showIf: includesOtherThan("q58", ["No strong cravings"]), options: ["Morning", "Afternoon", "Evening", "Late night", "Post-workout", "Variable"] },
  { id: "q58c", label: "Frequency", type: "single", section: "10", showIf: includesOtherThan("q58", ["No strong cravings"]), options: ["Rarely", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"] },
  {
    id: "q59",
    label: "How do stress and emotions affect your eating?",
    type: "multi",
    section: "10",
    tag: "core",
    options: ["Eat More", "Eat Less", "Crave Specific Foods", "Snack More", "Skip Meals", "Order Outside Food", "No Significant Effect", "Variable", "Other"],
  },
  {
    id: "q60",
    label: "Have you experienced any concerning eating behaviours?",
    type: "multi",
    section: "10",
    tag: "clinical",
    required: true,
    options: ["Feeling unable to control eating", "Eating an unusually large amount with distress", "Severe or prolonged food restriction", "Skipping meals to compensate", "Significant guilt after eating", "Anxiety after eating", "Strong fear of specific foods", "Self-induced vomiting", "Other compensatory behaviour", "Professionally diagnosed eating disorder", "Currently receiving professional support", "None", "Prefer not to answer"],
    note: "Ask sensitively, record only what is offered, and never intensify restriction where any of this is present.",
  },
  { id: "q60a", label: "Dietitian assessment", type: "single", section: "10", tag: "clinical", showIf: includesOtherThan("q60", ["None", "Prefer not to answer"]), options: ["No Concern", "Explore Further", "Senior Clinical Review", "Mental Health Professional Referral", "Avoid Aggressive Restriction"] },
  {
    id: "q113",
    label: "Eating speed",
    type: "single",
    section: "10",
    tag: "core",
    options: ["Very Fast", "Fast", "Moderate", "Slow"],
    help: "Fast, distracted eating means fullness signals arrive after the plate is empty — a portion problem no calorie target fixes on its own.",
  },
  { id: "q113a", label: "Common distractions", type: "multi", section: "10", tag: "core", options: ["Phone", "TV", "Work", "Driving", "Conversation", "None", "Other"] },
  { id: "q113b", label: "Why do you usually finish a meal?", type: "single", section: "10", tag: "core", options: ["Comfortable Fullness", "Plate Is Empty", "Still Hungry", "Habit", "Food Is Available", "Don't Want to Waste Food", "Emotional Satisfaction", "Not Sure", "Other"] },
  {
    id: "q69",
    label: "When following a nutrition plan, what usually happens when things do not go as planned?",
    type: "single",
    section: "10",
    tag: "core",
    required: true,
    options: ["I Adjust and Continue Normally", "I Return to the Plan at the Next Meal", "I Usually Give Up for the Rest of the Day", "I May Go Off-Plan for Several Days", "I Feel Guilty and Restrict Later", "I Compensate With Extra Exercise", "I Tend to Follow an All-or-Nothing Pattern", "It Depends on the Situation", "Not Sure"],
  },
]

// ---------------------------------------------------------------------------
// Section 11 — Sleep, stress, hydration & lifestyle (30 = 15 hand + 15 generated)
// ---------------------------------------------------------------------------

const SUBSTANCES: { label: string; slug: string; qtyExample: string }[] = [
  { label: "Alcohol", slug: "alcohol", qtyExample: "e.g. 3–4 pegs of whisky per sitting" },
  { label: "Cigarette", slug: "cigarette", qtyExample: "e.g. 5 cigarettes a day" },
  { label: "Vaping", slug: "vaping", qtyExample: "e.g. one pod every two days" },
  { label: "Chewing tobacco", slug: "chewing", qtyExample: "e.g. 4 sachets a day" },
  { label: "Other nicotine or tobacco", slug: "other", qtyExample: "e.g. 2 cigars a week" },
]

const SUBSTANCE_QUESTIONS: Question[] = SUBSTANCES.flatMap(({ label, slug, qtyExample }) => {
  const showIf = includesValue("q65", label)
  return [
    { id: `q65_${slug}_freq`, label: `${label} — how often?`, type: "single" as const, section: "11", showIf, options: SUBSTANCE_FREQ_OPTIONS },
    { id: `q65_${slug}_qty`, label: `${label} — how much each time?`, type: "text" as const, section: "11", showIf, placeholder: qtyExample },
    { id: `q65_${slug}_context`, label: `${label} — when does it happen?`, type: "multi" as const, section: "11", showIf, options: SUBSTANCE_CONTEXT_OPTIONS },
  ]
})

const SECTION_11: Question[] = [
  { id: "q61d", label: "Bedtime", type: "time", section: "11", tag: "core" },
  { id: "q61e", label: "Wake time", type: "time", section: "11", tag: "core" },
  {
    id: "q61",
    label: "Average sleep duration",
    type: "single",
    section: "11",
    tag: "core",
    required: true,
    options: ["Less than 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "8–9 hours", "More than 9 hours", "Variable"],
  },
  { id: "q61a", label: "Sleep quality (1–10)", type: "scale10", section: "11", tag: "core", required: true },
  {
    id: "q61c",
    label: "Sleep problems",
    type: "multi",
    section: "11",
    tag: "clinical",
    options: ["Difficulty falling asleep", "Frequent waking", "Wake too early", "Heavy snoring", "Observed breathing pauses", "Daytime sleepiness", "Shift-related sleep issue", "Late caffeine", "Training affects sleep", "No major concern", "Other"],
    note: "Snoring plus observed breathing pauses plus daytime sleepiness is a sleep-apnoea picture worth naming to the client.",
  },
  { id: "q61f", label: "Night awakenings", type: "single", section: "11", showIf: includesOtherThan("q61c", ["No major concern"]), options: ["None", "Once", "Twice", "Three or more", "Variable"] },
  { id: "q62", label: "Current stress level (1–10)", type: "scale10", section: "11", tag: "core", required: true },
  { id: "q62a", label: "Major stress sources", type: "multi", section: "11", maxSelect: 3, options: ["Work", "Business", "Studies", "Financial", "Family", "Relationship", "Health", "Body or weight", "Caregiving", "Travel", "Poor sleep", "Other"] },
  { id: "q62b", label: "Impact on eating, sleep and exercise", type: "multi", section: "11", options: ["Food intake", "Cravings", "Meal timing", "Sleep", "Training consistency", "Performance", "Digestion", "No noticeable effect"] },
  {
    id: "q63",
    label: "Approximate daily water intake",
    type: "single",
    section: "11",
    tag: "core",
    required: true,
    options: ["Less than 1 litre", "1–1.5 litres", "1.5–2 litres", "2–3 litres", "More than 3 litres", "Not sure"],
    note: "If a doctor-given fluid restriction was recorded in the medical section, that ceiling wins over any hydration target.",
  },
  {
    id: "q65",
    label: "Do you consume alcohol, tobacco or nicotine?",
    type: "multi",
    section: "11",
    tag: "core",
    required: true,
    options: ["Alcohol", "Cigarette", "Vaping", "Chewing tobacco", "Other nicotine or tobacco", "None", "Prefer not to answer"],
    note: "Record sensitively and without comment — a judged answer here is an inaccurate answer.",
  },
  ...SUBSTANCE_QUESTIONS,
  {
    id: "q67",
    label: "How often do travel and social situations affect your eating routine?",
    type: "multi",
    section: "11",
    tag: "core",
    required: true,
    options: ["Work travel", "Personal travel", "Flights or airports", "Hotel stays", "Business dinners", "Restaurants", "Family gatherings", "Parties or social events", "International travel", "Religious or community events", "Rarely affected", "Other"],
  },
  { id: "q67b", label: "Frequency", type: "single", section: "11", showIf: includesOtherThan("q67", ["Rarely affected"]), options: ["Rarely", "1–2 times per month", "Weekly", "Multiple times per week", "Frequent traveller"] },
  { id: "q67a", label: "Nutrition impact", type: "multi", section: "11", showIf: includesOtherThan("q67", ["Rarely affected"]), options: ["Skip meals", "Eat very little beforehand", "Overeat", "Drink alcohol", "Eat whatever is available", "Struggle with protein", "Eat late", "Order familiar foods", "Carry snacks", "Manage reasonably well"] },
  { id: "q67c", label: "Typical challenges", type: "text", section: "11", showIf: includesOtherThan("q67", ["Rarely affected"]), placeholder: "e.g. airport food after 10 PM; client dinners three nights a week" },
]

// ---------------------------------------------------------------------------
// Section 12 — Adherence, mindset & success strategy (11)
// ---------------------------------------------------------------------------

const SECTION_12: Question[] = [
  {
    id: "q73",
    label: "Based on your past experience, what could make it difficult to stay consistent with your LeanR plan?",
    type: "multi",
    section: "12",
    tag: "planning",
    required: true,
    maxSelect: 3,
    options: ["Busy Work Schedule", "Travel", "Stress", "Poor Sleep", "Family Responsibilities", "Hunger", "Cravings", "Cooking", "Budget", "Food Availability", "Social Events", "Low Motivation", "Poor Results", "Digestive Problems", "Other"],
    note: "Click in priority order — first click = rank 1.",
  },
  {
    id: "q71",
    label: "Are there any nutrition beliefs or food rules that strongly influence how you eat?",
    type: "multi",
    section: "12",
    tag: "core",
    required: true,
    options: ["Carbohydrates cause weight gain", "Rice causes weight gain", "Roti causes weight gain", "Avoid food after a specific time", "Skipping meals helps fat loss", "Fasting is necessary", "Fruit has too much sugar", "Dietary fat should be avoided", "Very high protein is necessary", "Protein damages kidneys or liver", "Protein powder is unsafe", "Supplements are necessary", "Detox or cleanse is required", "More sweating means more fat loss", "Fasted workout significantly increases fat loss", "Social-media nutrition influences choices", "No strong belief affecting choices", "Other"],
    help: "A plan that silently contradicts a strongly held rule gets quietly edited by the client instead of followed.",
  },
  { id: "q71b", label: "Source of belief", type: "multi", section: "12", showIf: includesOtherThan("q71", ["No strong belief affecting choices"]), options: ["Social media", "Friends or family", "Previous dietitian", "Personal Trainer", "Doctor", "Own experience", "Article or book", "Not sure"] },
  { id: "q71a", label: "Strength of belief", type: "single", section: "12", showIf: includesOtherThan("q71", ["No strong belief affecting choices"]), options: ["None", "Mild", "Moderate", "Significant"] },
  { id: "q71c", label: "May it affect adherence or nutrition quality?", type: "single", section: "12", showIf: includesOtherThan("q71", ["No strong belief affecting choices"]), options: ["No", "Possibly", "Yes — restricts food choices", "Yes — drives under-eating"] },
  {
    id: "q72",
    label: "What type of nutrition plan would be easiest for you to follow consistently?",
    type: "single",
    section: "12",
    tag: "planning",
    required: true,
    options: ["Exact Meal Plan", "Meal Options", "Flexible Exchange", "Portion Guidance", "Combination"],
  },
  {
    id: "q72a",
    label: "Preferred measurement method",
    type: "single",
    section: "12",
    tag: "planning",
    options: ["Grams", "Household Measures", "Hand Portions", "Visual Portions", "Combination"],
    help: "The plan is written in the client's own measuring language — grams to someone who cooks in katoris is a plan they cannot follow.",
  },
  {
    id: "q74",
    label: "How much change feels realistic for you during the first two weeks?",
    type: "single",
    section: "12",
    tag: "planning",
    required: true,
    options: ["Very Small Changes", "A Few Priority Changes", "Moderate Structured Changes", "Comfortable With Significant Changes", "Not Sure – Need Dietitian Guidance"],
  },
  { id: "q75", label: "How confident are you that you can follow the agreed nutrition and lifestyle plan? (1–10)", type: "scale10", section: "12", tag: "core", required: true },
  {
    id: "q75a",
    label: "What would make the plan easier to follow?",
    type: "multi",
    section: "12",
    showIf: (a) => typeof a.q75 === "number" && (a.q75 as number) < 7,
    options: ["Simpler Meals", "More Food Options", "Less Cooking", "Family-Friendly Meals", "Travel Options", "More Accountability", "More Frequent Follow-ups", "Flexible Portions", "Better Craving Management", "Other"],
    note: "Below 7 the plan is changed now, not reviewed later — confidence at counselling predicts week-3 dropout.",
  },
  {
    id: "q70",
    label: "What type of support and coaching helps you stay most consistent?",
    type: "multi",
    section: "12",
    tag: "core",
    required: true,
    maxSelect: 3,
    options: ["Clear Step-by-Step Instructions", "Regular Accountability", "Frequent Check-ins", "Flexible Guidance", "Strict Structure", "Encouragement and Motivation", "Progress Data and Feedback", "Education and Explanation", "Problem-Solving Support", "Simple Targets", "Other"],
  },
]

// ---------------------------------------------------------------------------
// Section 13 — Dietitian professional assessment (7)
// ---------------------------------------------------------------------------

const isPlateauedOrRestarter = (a: Answers) => a.q76_category === "Plateaued — dieting now, weight has stopped moving" || a.q76_category === "Re-starter — lost weight before and regained it"

const SECTION_13: Question[] = [
  {
    id: "q76_category",
    label: "Which kind of client is this?",
    type: "single",
    section: "13",
    tag: "planning",
    required: true,
    options: ["First-timer — never dieted with structure before", "Plateaued — dieting now, weight has stopped moving", "Re-starter — lost weight before and regained it", "Maintenance — at or near goal, holding it"],
    help: "Sets the calorie strategy and the protein band. Nothing else in the roadmap branches on it — BMI, target weight, timeline, fat and fibre are identical for all four.",
    note: "Four different starting problems, not four different diets: habit formation, diagnosis, confidence, not regaining.",
  },
  {
    id: "q76_weeks_on_plan",
    label: "How many weeks have they held the current deficit?",
    type: "number",
    section: "13",
    showIf: isPlateauedOrRestarter,
    placeholder: "e.g. 10",
    help: "Adaptation is depth × duration. Past 8 weeks at a steep deficit the drop in resting expenditure becomes measurable rather than theoretical.",
  },
  {
    id: "q76_weeks_stagnant",
    label: "How many weeks has the weight not moved?",
    type: "number",
    section: "13",
    showIf: isPlateauedOrRestarter,
    placeholder: "e.g. 4",
    help: "One week of no movement is noise — water, salt, cycle and bowel timing each hide 1–2 kg. Three weeks is the shortest window where the absence of loss is signal.",
  },
  {
    id: "q76",
    label: "Main factors currently limiting the client's progress",
    type: "multi",
    section: "13",
    tag: "planning",
    required: true,
    maxSelect: 5,
    options: ["Excess energy intake", "Intake appears too low", "Irregular energy intake", "Low protein intake", "Poor protein distribution", "Long meal gaps", "Frequent meal skipping", "Excessive evening hunger", "Excessive night hunger", "Frequent cravings", "Emotional or stress eating", "Weekend overeating", "Frequent outside food", "Hidden calorie intake", "Liquid calories", "Alcohol intake", "Low physical activity", "Inconsistent training", "Training stimulus may be insufficient", "High training demand", "Poor pre-workout fuelling", "Poor post-workout nutrition", "Possible under-fuelling", "Poor recovery", "Poor sleep", "High stress", "Digestive issues affecting intake", "Food intolerance or discomfort", "Medical or clinical consideration", "Medication-related consideration", "Restriction-regain cycle", "Low appetite", "Early fullness", "Poor meal planning", "Work schedule", "Travel", "Cooking limitation", "Food availability", "Budget limitation", "Nutrition misconceptions", "Poor adherence", "Goal or timeline appears unrealistic", "Insufficient information", "Other"],
    note: "Click in priority order — first click = rank 1.",
  },
  {
    id: "q77",
    label: "Minimum changes most likely to move the client towards the goal",
    type: "multi",
    section: "13",
    tag: "planning",
    required: true,
    maxSelect: 3,
    options: ["Improve meal regularity", "Stop frequent meal skipping", "Increase protein", "Improve protein distribution", "Improve breakfast", "Improve lunch", "Improve evening snack", "Improve dinner", "Reduce excessive portions", "Improve carbohydrate quality", "Improve carbohydrate timing", "Improve workout fuelling", "Improve post-workout nutrition", "Increase food intake safely", "Improve hydration", "Improve fibre", "Increase fruit or vegetable variety", "Reduce outside food frequency", "Improve restaurant choices", "Create weekend strategy", "Create travel strategy", "Improve sleep routine", "Address cravings", "Address emotional eating", "Reduce alcohol", "Improve meal preparation", "Simplify diet", "Correct nutrition misconception", "Stabilise intake before fat loss", "Clinical nutrition strategy required", "Other"],
  },
  {
    id: "q89",
    label: "Energy strategy you currently believe is appropriate",
    type: "single",
    section: "13",
    tag: "planning",
    required: true,
    options: ["Controlled energy deficit", "Mild energy deficit", "Maintenance or recomposition", "Mild energy surplus", "Controlled energy surplus", "Intake stabilisation before deficit or surplus", "Correct excessive restriction first", "Performance-fuelling priority", "Clinical stabilisation priority", "Unsure — AI clinical review required"],
  },
  {
    id: "ds2",
    label: "AI hard constraints — non-negotiable rules the AI must follow (one per line)",
    type: "textarea",
    section: "13",
    tag: "clinical",
    placeholder: "e.g. protein max 60 g/day per nephrologist; no fasting protocols; fluid cap 1.5 L",
    note: "Hard constraints override every other strategy choice except a doctor's instruction.",
  },
]

// ---------------------------------------------------------------------------
// Section 14 — Physical assessment (coach) (11)
// ---------------------------------------------------------------------------

const POINT_OPTIONS = ["1", "2", "3", "4"]

const SECTION_14: Question[] = [
  { id: "q120_assessed_on", label: "Date of the assessment", type: "date", section: "14", tag: "planning", note: "Only if it was not today — this is what a future re-test is compared against." },
  { id: "q120_plank_seconds", label: "Core strength — plank hold (seconds)", type: "number", section: "14", tag: "fitness", note: "Every 30 seconds is a point, to a maximum of 4." },
  { id: "q120_plank_points", label: "Plank points", type: "single", section: "14", tag: "fitness", options: POINT_OPTIONS, note: "Filled in from the measurement above — change it only if you disagree." },
  { id: "q120_pushups_count", label: "Overall body strength — push-ups completed", type: "number", section: "14", tag: "fitness", note: "1–15 = 1 point · 16–25 = 2 · 26–35 = 3 · 36 and above = 4." },
  { id: "q120_pushups_points", label: "Push-up points", type: "single", section: "14", tag: "fitness", options: POINT_OPTIONS, note: "Filled in from the measurement above — change it only if you disagree." },
  { id: "q120_balance_seconds", label: "Balance — star pose or one leg (seconds)", type: "number", section: "14", tag: "fitness", note: "Every 30 seconds is a point, to a maximum of 4." },
  { id: "q120_balance_points", label: "Balance points", type: "single", section: "14", tag: "fitness", options: POINT_OPTIONS, note: "Filled in from the measurement above — change it only if you disagree." },
  { id: "q120_reach_points", label: "Flexibility — reach test", type: "single", section: "14", tag: "fitness", options: ["Knee touch", "Ankle touch", "Toe touch", "Heel touch"], note: "Knee touch = 1 point · ankle = 2 · toe = 3 · heel = 4." },
  {
    id: "q120_bca_points",
    label: "Body composition points",
    type: "single",
    section: "14",
    tag: "fitness",
    options: POINT_OPTIONS,
    note: "Scored from the body fat % already recorded in the body-composition section, against the thresholds for the client's sex — men 18% and below = 4, 19–25 = 3, 26–30 = 2, above 31 = 1; women 20% and below = 4, 21–27 = 3, 28–33 = 2, above 34 = 1. Set this by hand only if body fat was not measured or you disagree.",
  },
  { id: "q120_cardio_km", label: "Cardio — distance covered in 10 minutes (km)", type: "number", section: "14", tag: "fitness", placeholder: "e.g. 0.9", note: "Below 0.5 km = 1 point · 0.5–0.8 = 2 · 0.8–1.1 = 3 · 1.2 and above = 4." },
  { id: "q120_cardio_points", label: "Cardio points", type: "single", section: "14", tag: "fitness", options: POINT_OPTIONS, note: "Filled in from the measurement above — change it only if you disagree." },
]

// ---------------------------------------------------------------------------
// The full bank
// ---------------------------------------------------------------------------

export const QUESTIONS: Question[] = [
  ...CLIENT_QUESTIONS,
  ...SECTION_1,
  ...SECTION_2,
  ...SECTION_3,
  ...SECTION_4,
  ...SECTION_5,
  ...SECTION_6,
  ...SECTION_7,
  ...SECTION_8,
  ...SECTION_9,
  ...SECTION_10,
  ...SECTION_11,
  ...SECTION_12,
  ...SECTION_13,
  ...SECTION_14,
]

const QUESTIONS_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))

export function findQuestion(id: string): Question | undefined {
  return QUESTIONS_BY_ID.get(id)
}

export function questionsForSection(sectionId: string): Question[] {
  return QUESTIONS.filter((q) => q.section === sectionId)
}

export function isQuestionVisible(question: Question, answers: Answers): boolean {
  return question.showIf ? question.showIf(answers) : true
}

export function isQuestionRequired(question: Question, answers: Answers): boolean {
  if (question.requiredIf) return question.requiredIf(answers)
  return !!question.required
}
