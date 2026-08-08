import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { db } from "@/db"
import { counsellingSessions } from "@/db/schema"
import { SECTIONS, questionsForSection, type Answers } from "@/lib/counselling/questions"
import { QUICK_GROUPS } from "@/lib/counselling/quick-intake"
import { CounsellingWizard, type WizardStep } from "@/components/counselling/counselling-wizard"

export default async function CounsellingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  const [session] = await db
    .select()
    .from(counsellingSessions)
    .where(eq(counsellingSessions.id, sessionId))
    .limit(1)

  if (!session) notFound()

  const steps: WizardStep[] =
    session.type === "quick"
      ? QUICK_GROUPS.map((g) => ({ id: g.id, title: g.title, intro: g.intro, questionIds: g.questionIds }))
      : SECTIONS.map((s) => ({
          id: s.id,
          title: s.id === "client" ? s.title : `${s.id}. ${s.title}`,
          intro: s.intro,
          questionIds: questionsForSection(s.id).map((q) => q.id),
        }))

  return (
    <CounsellingWizard
      sessionId={session.id}
      mode={session.type as "quick" | "full"}
      steps={steps}
      initialAnswers={(session.answers as Answers) ?? {}}
    />
  )
}
