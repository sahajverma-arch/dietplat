/**
 * Postgres-counter rate limit for POST /api/plan/generate — the only
 * expensive path in the app (LLM calls with retries, plus a bounded solver
 * search). No Upstash/Redis is configured for this project, so this counts
 * rows in plan_generation_requests instead. One row per generation
 * *request*, not per LLM attempt inside it.
 */

import { and, eq, gte } from "drizzle-orm"

import { db } from "@/db"
import { planGenerationRequests } from "@/db/schema"

const WINDOW_MINUTES = 10
const MAX_REQUESTS_PER_WINDOW = 5

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Plan generation rate limit exceeded — max ${MAX_REQUESTS_PER_WINDOW} requests per ${WINDOW_MINUTES} minutes. Try again in ${retryAfterSeconds}s.`
    )
    this.name = "RateLimitExceededError"
  }
}

/** Throws RateLimitExceededError if the user is over the limit; otherwise records this request and returns. */
export async function checkAndRecordPlanGenerationRequest(userId: string): Promise<void> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000)

  const recent = await db
    .select({ createdAt: planGenerationRequests.createdAt })
    .from(planGenerationRequests)
    .where(and(eq(planGenerationRequests.userId, userId), gte(planGenerationRequests.createdAt, windowStart)))

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent.reduce((a, b) => (a.createdAt < b.createdAt ? a : b))
    const retryAfterMs = oldest.createdAt.getTime() + WINDOW_MINUTES * 60_000 - Date.now()
    throw new RateLimitExceededError(Math.max(1, Math.ceil(retryAfterMs / 1000)))
  }

  await db.insert(planGenerationRequests).values({ userId })
}
