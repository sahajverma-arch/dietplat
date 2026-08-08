import { desc, eq } from "drizzle-orm"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/db"
import { clients, dietPlans, planGenerationRuns, roadmaps } from "@/db/schema"

const RECENT_LIMIT = 200

export default async function GenerationLogPage() {
  const rows = await db
    .select({ run: planGenerationRuns, client: clients, plan: dietPlans, sessionId: roadmaps.sessionId })
    .from(planGenerationRuns)
    .innerJoin(clients, eq(planGenerationRuns.clientId, clients.id))
    .innerJoin(roadmaps, eq(planGenerationRuns.roadmapId, roadmaps.id))
    .leftJoin(dietPlans, eq(planGenerationRuns.dietPlanId, dietPlans.id))
    .orderBy(desc(planGenerationRuns.createdAt))
    .limit(RECENT_LIMIT)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Generation Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every LLM attempt behind plan generation — session, model, latency, and why an attempt failed validation,
          for self-diagnosing a plan that &ldquo;looks wrong&rdquo;. Most recent {RECENT_LIMIT} attempts.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No generation attempts recorded yet.</Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ run, client, plan, sessionId }) => {
                const validation = run.validationResult as { ok: boolean; errors: string[] }
                const deviation = plan?.deviation as Array<{ kcal: number; proteinG: number; fatG: number; carbsG: number }> | undefined
                const worstDeviationPct = deviation
                  ? Math.max(...deviation.flatMap((d) => [Math.abs(d.kcal), Math.abs(d.proteinG), Math.abs(d.fatG), Math.abs(d.carbsG)])) * 100
                  : undefined

                return (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {run.createdAt.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{run.weekNumber}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{sessionId.slice(0, 8)}</TableCell>
                    <TableCell>{run.attemptNumber}</TableCell>
                    <TableCell className="text-xs">{run.model ?? "—"}</TableCell>
                    <TableCell className="text-right">{run.latencyMs} ms</TableCell>
                    <TableCell>
                      {validation.ok ? (
                        <Badge>ok</Badge>
                      ) : (
                        <span className="text-xs text-destructive" title={validation.errors.join("\n")}>
                          {validation.errors[0] ?? "failed"}
                          {validation.errors.length > 1 ? ` (+${validation.errors.length - 1} more)` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {plan ? (
                        <a href={`/plans/${plan.id}`} className="underline">
                          {plan.generationMode}
                          {worstDeviationPct !== undefined ? ` · ${worstDeviationPct.toFixed(2)}% dev` : ""}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">no plan — generation blocked</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
