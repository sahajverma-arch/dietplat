import Link from "next/link"
import { desc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { db } from "@/db"
import { clients, counsellingSessions } from "@/db/schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { startCounsellingSessionForClient } from "@/app/(app)/counselling/actions"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) notFound()

  const sessions = await db
    .select()
    .from(counsellingSessions)
    .where(eq(counsellingSessions.clientId, clientId))
    .orderBy(desc(counsellingSessions.createdAt))

  async function startQuick() {
    "use server"
    await startCounsellingSessionForClient(clientId, "quick")
  }

  async function startFull() {
    "use server"
    await startCounsellingSessionForClient(clientId, "full")
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.phone ?? "No phone"} · {client.email ?? "No email"}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={startQuick}>
            <Button type="submit" variant="outline" size="sm">
              New Quick
            </Button>
          </form>
          <form action={startFull}>
            <Button type="submit" size="sm">
              New Full
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Counselling sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          )}
          {sessions.map((session) => {
            const href =
              session.status === "draft" ? `/counselling/${session.id}` : `/sessions/${session.id}`
            return (
              <Link
                key={session.id}
                href={href}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
              >
                <span>
                  {session.type === "quick" ? "Quick" : "Full"} — {session.createdAt.toLocaleDateString()}
                </span>
                <span className="flex items-center gap-2">
                  {session.status === "draft" && (
                    <span className="text-muted-foreground">Resume draft</span>
                  )}
                  <Badge variant={session.status === "submitted" ? "default" : "secondary"}>
                    {session.status}
                  </Badge>
                </span>
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
