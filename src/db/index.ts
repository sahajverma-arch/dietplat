import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { env } from "@/lib/env"
import * as schema from "./schema"

declare global {
  // eslint-disable-next-line no-var -- `declare global` requires `var` for declaration merging
  var __dietplatQueryClient: ReturnType<typeof postgres> | undefined
}

const queryClient =
  globalThis.__dietplatQueryClient ?? postgres(env.DATABASE_URL, { prepare: false })

if (process.env.NODE_ENV !== "production") {
  globalThis.__dietplatQueryClient = queryClient
}

export const db = drizzle(queryClient, { schema, casing: "snake_case" })
