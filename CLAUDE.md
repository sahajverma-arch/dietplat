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
Google OAuth via Supabase. Access restricted to `@fitelo.com`. Enforced in three places — all three required:
1. `queryParams: { hd: 'fitelo.com' }` on sign-in (UX hint only, spoofable).
2. Postgres trigger on `auth.users` insert — reject non-fitelo.com emails.
3. Middleware + RLS policy checking `auth.jwt() ->> 'email' LIKE '%@fitelo.com'`.

## Do not
- Do not install a nutrition API or food database package. Table 4.1 + our own `foods` table is the entire source of truth.
- Do not let plan generation write to the DB until validation passes.
- Do not add a "regenerate with AI" button that bypasses the solver.
