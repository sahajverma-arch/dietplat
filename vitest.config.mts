import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `npm test` — and therefore the Vercel build, which runs
    // `npm run verify && npm run build` — stays HERMETIC. Files named
    // *.integration.test.ts make live network calls (the RLS audit hits the
    // real Supabase project) and are excluded here, run instead via
    // `npm run test:integration`.
    //
    // WHY: a real deploy failed with two of twenty anon-key checks timing
    // out while eighteen passed — pure cross-region latency (the build runs
    // in iad1, this project's Supabase is in ap-northeast-1), not a policy
    // regression. When that build fails Vercel silently keeps serving the
    // PREVIOUS deployment, so pushed fixes appear to do nothing and there is
    // no obvious sign why. A security audit is worth running; gating every
    // deploy on a cross-Pacific round trip to production is not.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
  },
})
