# LEANR — Diet Platform

Internal dietitian tool for Fitelo. Staff-only. Counselling intake → deterministic roadmap → exchange-list diet plan.

## Stack
- Next.js 14 App Router + TypeScript (strict). Server Actions for mutations, Route Handlers for anything the AI touches.
- Supabase: Postgres + Auth (Google OAuth) + RLS. Drizzle ORM. No Prisma.
- Vercel deploy. Node runtime for AI routes (not edge — long timeouts needed).
- NVIDIA NIM for LLM calls, OpenAI-compatible: `baseURL: https://integrate.api.nvidia.com/v1`, key `NVIDIA_API_KEY`, model from `NVIDIA_MODEL` env var.
- Tailwind + shadcn/ui. No component library beyond that.

## THE ONE RULE THAT MATTERS

**The LLM never calculates nutrition. The LLM never sees a calorie or macro target.**

Numbers come from two deterministic places only:
1. `src/lib/counselling/` — energy, BMI, roadmap, macros, protein ramp. Pure functions, zero I/O, zero randomness.
2. `src/lib/plan/exchange-solver.ts` — converts week targets into integer/half-integer exchange counts using Table 4.1 constants.

The LLM does exactly one job: **given a list of exchange slots and a filtered list of eligible foods, pick which named food fills each slot.** It returns food IDs. Nothing else. Macros are then recomputed from exchange counts × Table 4.1 and validated.

If you ever find yourself writing a prompt that asks a model to "calculate calories", "estimate macros", or "make sure it adds up to 1775 kcal" — stop. That is the bug this architecture exists to prevent.

## The exchange system

`exchange_types` (11 rows, read-only at runtime) is the classic textbook Table 4.1 — the
Comprehensive Food Exchange List (Indian modified American exchange list):

`milk_cow · milk_skim · meat · meat_lean · pulse · cereal · vegetable_a · vegetable_b · fruit ·
fat · sugar`

This was briefly swapped for the sister `dietitian-platform` codebase's richer 12-group exchange
list during Prompt 3, on the theory that its "production-validated" data was more authoritative.
That was wrong — verified by reading three real generated diet plans (Deepak Sharma, Anjali Joshi,
Ritu Verma). Deepak's and Anjali's plans both explicitly cite "Table 4.1" and their arithmetic
proves it: `Roti (atta 100 g raw, 5 rotis)` = 5 cereal exchanges at 20 g each (not the 12-group
system's 30 g/roti), `Milk (250 ml)` = 1 exact milk_cow exchange, and the guidelines list swap
groups as "Vegetable A (100 g)" / "Vegetable B (50 g)" — a split the 12-group system doesn't have
at all. Ritu Verma's plan is a different, superseded architecture entirely (INDB/USDA
portion-matched, not exchange-solved — the sister codebase's own
`0017_remove_indb_usda_foods.sql` deleted that pipeline). Reverted to Table 4.1 for good.

Each exchange type carries protein_g/carbs_g/fat_g/fiber_g per 1 exchange; kcal is always
*computed* as `protein_g*4 + carbs_g*4 + fat_g*9`, never stored/sourced independently, so it can
never drift from the macros it summarises (this generated-kcal figure sits a few kcal off Table
4.1's own printed values in a couple of rows — e.g. fruit computes to 40 kcal against the table's
45 — an artifact of the textbook's own rounding, not a bug). Two Vegetable A exchanges = one
Vegetable B exchange. Eggs and lean meat/fish map onto the `meat` (1 whole egg = 1 exchange, 40 g)
and `meat_lean` (35 g chicken/fish = 1 exchange) types respectively — confirmed against Deepak's
plan's own non-veg swap line ("1 whole egg or 35 g chicken breast / fish").

Food *display names* vary by region even when the underlying exchange is identical — Anjali's
Maharashtrian plan calls the same wheat-flour cereal exchange "Poli" instead of "Roti", ghee is
"Toop", peanuts are "Shengdana", dal is "Varan/Amti/Usal" depending on prep, sabzi is "Bhaji". The
`foods` table carries region-specific alias rows for these (same exchange arithmetic, different
`name_en`) rather than a separate name-translation layer.

## Rounding & precision
- All intermediate maths unrounded. Round only at display.
- kcal, protein/carb/fat grams → integer at display.
- BMI → 1 decimal. Weights → 1 decimal.
- Timeline divisors displayed at full precision (`20.2 ÷ 0.74`, never `÷ 0.7`).

## Testing
Every function in `src/lib/counselling/` and `src/lib/plan/` gets a Vitest unit test. The four worked examples (TEST-001 Priya, TEST-002 Rahul, TEST-003 Sneha, TEST-004 Aadi) are golden-file tests — if any figure drifts, the build fails. Do not change a golden file to make a test pass; fix the code or ask.

## Conventions
- No `any`. No `@ts-ignore`.
- Zod schema at every boundary: form input, LLM output, API response.
- Errors surface to the UI. Never silently fall back to a default number in a clinical calculation — throw, and let the review page show a blocked state.
- Server-only secrets in `src/lib/env.ts`, validated with Zod at boot.
- Migrations in `supabase/migrations/`, timestamped, forward-only.

## Auth
Google OAuth via Supabase. Access restricted to `@fitelo.co`. Enforced in three places — all three required:
1. `queryParams: { hd: 'fitelo.co' }` on sign-in (UX hint only, spoofable).
2. Postgres trigger on `auth.users` insert — reject non-fitelo.co emails.
3. Middleware + RLS policy checking `auth.jwt() ->> 'email' LIKE '%@fitelo.co'`.

## Do not
- Do not install a nutrition API or food database package. `exchange_types` + our own `foods` table is the entire source of truth.
- Do not let plan generation write to the DB until validation passes.
- Do not add a "regenerate with AI" button that bypasses the solver.
