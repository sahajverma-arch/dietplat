"use server"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { z } from "zod"

import { db } from "@/db"
import { clients, counsellingSessions, roadmaps } from "@/db/schema"
import { answersSchema } from "@/lib/counselling/answers-schema"
import type { Answers } from "@/lib/counselling/questions"
import { fillUnaskedRequired } from "@/lib/counselling/quick-intake"
import { ENGINE_VERSION, roadmapFor } from "@/lib/counselling/roadmap"
import { RoadmapInputError, roadmapInputFromAnswers } from "@/lib/counselling/roadmap-input"
import { requireStaffUser } from "@/lib/counselling/require-staff-user"

const startSessionSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().email("Invalid email").optional(),
  type: z.enum(["quick", "full"]),
})

export async function startCounsellingSession(input: {
  name: string
  phone?: string
  email?: string
  type: "quick" | "full"
}) {
  const user = await requireStaffUser()
  const parsed = startSessionSchema.parse(input)

  const [client] = await db
    .insert(clients)
    .values({ name: parsed.name, phone: parsed.phone, email: parsed.email, createdBy: user.id })
    .returning({ id: clients.id })

  const [session] = await db
    .insert(counsellingSessions)
    .values({ clientId: client.id, type: parsed.type, createdBy: user.id, answers: {} })
    .returning({ id: counsellingSessions.id })

  redirect(`/counselling/${session.id}`)
}

export async function startCounsellingSessionForClient(clientId: string, type: "quick" | "full") {
  const user = await requireStaffUser()
  clientId = z.string().uuid().parse(clientId)
  type = z.enum(["quick", "full"]).parse(type)

  const [session] = await db
    .insert(counsellingSessions)
    .values({ clientId, type, createdBy: user.id, answers: {} })
    .returning({ id: counsellingSessions.id })

  redirect(`/counselling/${session.id}`)
}

export async function autosaveSession(sessionId: string, answers: Answers) {
  await requireStaffUser()

  await db
    .update(counsellingSessions)
    .set({ answers })
    .where(eq(counsellingSessions.id, sessionId))
}

export async function submitSession(
  sessionId: string
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  await requireStaffUser()

  const [session] = await db
    .select()
    .from(counsellingSessions)
    .where(eq(counsellingSessions.id, sessionId))
    .limit(1)

  if (!session) throw new Error("Session not found")

  const rawAnswers = session.answers as Answers
  const finalAnswers = session.type === "quick" ? fillUnaskedRequired(rawAnswers) : rawAnswers

  const result = answersSchema(session.type as "quick" | "full").safeParse(finalAnswers)
  if (!result.success) {
    const missing = result.error.issues.map((issue) => String(issue.path[0]))
    return { ok: false, missing }
  }

  await db
    .update(counsellingSessions)
    .set({ answers: finalAnswers, status: "submitted", submittedAt: new Date() })
    .where(eq(counsellingSessions.id, sessionId))

  try {
    const roadmapInput = roadmapInputFromAnswers(finalAnswers)
    const output = roadmapFor(roadmapInput)
    await db.insert(roadmaps).values({
      sessionId,
      engineVersion: ENGINE_VERSION,
      input: roadmapInput,
      output,
    })
  } catch (err) {
    if (!(err instanceof RoadmapInputError)) throw err
    // A required field (age/sex/height/weight/activity/category) is
    // missing or unusable — the session is still recorded as submitted;
    // /sessions/[id] shows the blocked state explicitly rather than
    // silently having no roadmap. currentIntake is always omitted here
    // regardless (the foods table that would price it doesn't exist yet),
    // which never throws — it just narrows what the engine can compute.
  }

  return { ok: true }
}
