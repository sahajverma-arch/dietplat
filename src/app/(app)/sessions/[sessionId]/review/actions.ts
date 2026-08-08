"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { counsellingSessions, roadmapOverrides, roadmaps } from "@/db/schema"
import type { Answers } from "@/lib/counselling/questions"
import { ENGINE_VERSION, roadmapFor } from "@/lib/counselling/roadmap"
import { roadmapInputFromAnswers } from "@/lib/counselling/roadmap-input"
import { requireStaffUser } from "@/lib/counselling/require-staff-user"

/** Snapshots are immutable — this always inserts a new row, never updates the existing one. */
export async function recomputeRoadmap(sessionId: string) {
  await requireStaffUser()

  const [session] = await db
    .select()
    .from(counsellingSessions)
    .where(eq(counsellingSessions.id, sessionId))
    .limit(1)
  if (!session) throw new Error("Session not found")

  const roadmapInput = roadmapInputFromAnswers(session.answers as Answers)
  const output = roadmapFor(roadmapInput)

  await db.insert(roadmaps).values({
    sessionId,
    engineVersion: ENGINE_VERSION,
    input: roadmapInput,
    output,
  })

  revalidatePath(`/sessions/${sessionId}/review`)
}

export async function recordOverride(input: {
  roadmapId: string
  flagCode: string
  reason: string
  dietitianName: string
  sessionId: string
}) {
  const user = await requireStaffUser()

  await db.insert(roadmapOverrides).values({
    roadmapId: input.roadmapId,
    flagCode: input.flagCode,
    reason: input.reason,
    dietitianName: input.dietitianName,
    createdBy: user.id,
  })

  revalidatePath(`/sessions/${input.sessionId}/review`)
}
