import { defineConfig } from "vitest/config"

/**
 * Live-network tests only — the RLS audit against the real Supabase project.
 * Kept out of `npm test` (and therefore out of the Vercel build) so a
 * deploy can never fail on a cross-region network hiccup and silently leave
 * the previous deployment serving. Run deliberately:
 *
 *   npm run test:integration
 *
 * These need real credentials; each suite skips cleanly without them.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
  },
})
