import { desc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"

import { db } from "@/db"
import { clients, counsellingSessions, roadmaps } from "@/db/schema"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RoadmapResult } from "@/lib/counselling/roadmap"

export default async function SessionStatusPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  const [row] = await db
    .select({ session: counsellingSessions, client: clients })
    .from(counsellingSessions)
    .innerJoin(clients, eq(counsellingSessions.clientId, clients.id))
    .where(eq(counsellingSessions.id, sessionId))
    .limit(1)

  if (!row) notFound()

  const { session, client } = row

  const [roadmap] = await db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.sessionId, sessionId))
    .orderBy(desc(roadmaps.createdAt))
    .limit(1)

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{client.name}</CardTitle>
            <Badge variant={session.status === "submitted" ? "default" : "secondary"}>
              {session.status}
            </Badge>
          </div>
          <CardDescription>
            {session.type === "quick" ? "Quick" : "Full"} counselling session
            {session.submittedAt ? ` · submitted ${session.submittedAt.toLocaleString()}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roadmap ? (
            <div className="space-y-3">
              <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                Roadmap generated (engine {roadmap.engineVersion}).
              </div>
              <RoadmapSummary output={roadmap.output as RoadmapResult} />
              <Link href={`/sessions/${sessionId}/review`} className={buttonVariants({})}>
                View full review
              </Link>
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              No roadmap yet. Most likely a required field for the engine — age, sex, height,
              weight, activity level, or counselling category — is missing from this session.
              (Current measured intake — the priced &quot;measured food day&quot; — is always
              omitted for now, since that pricing step against the foods table doesn&apos;t exist
              yet; it only narrows what the engine can compute, it never blocks the roadmap
              outright.)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RoadmapSummary({ output }: { output: RoadmapResult }) {
  const stat = (label: string, value: string) => (
    <div className="flex justify-between border-b py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )

  return (
    <div className="rounded-md border p-4">
      {stat("BMI", `${output.anthro.bmiValue.toFixed(1)} · ${output.anthro.classification} (Indian criteria)`)}
      {stat("TDEE", `${Math.round(output.energy.tdee)} kcal`)}
      {stat("Target (steady state)", `${Math.round(output.macrosAtTarget.kcal)} kcal`)}
      {stat(
        "Macros at target",
        `P ${Math.round(output.macrosAtTarget.proteinG)} · F ${Math.round(output.macrosAtTarget.fatG)} · C ${Math.round(output.macrosAtTarget.carbsG)} g`
      )}
      {stat(
        "Protein ramp",
        output.proteinRamp.length > 0 ? `${output.proteinRamp.length} weeks` : "not needed — already at target"
      )}
      {output.flags.length > 0 &&
        stat("Flags", output.flags.map((f) => `${f.level}:${f.code}`).join(", "))}
    </div>
  )
}
