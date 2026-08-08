"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { QuestionField } from "@/components/counselling/question-field"
import {
  type Answers,
  findQuestion,
  isQuestionRequired,
  isQuestionVisible,
} from "@/lib/counselling/questions"
import { isEmpty } from "@/lib/counselling/quick-intake"
import { autosaveSession, submitSession } from "@/app/(app)/counselling/actions"

export interface WizardStep {
  id: string
  title: string
  intro?: string
  questionIds: string[]
}

export function CounsellingWizard({
  sessionId,
  mode,
  steps,
  initialAnswers,
}: {
  sessionId: string
  mode: "quick" | "full"
  steps: WizardStep[]
  initialAnswers: Answers
}) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>(initialAnswers)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const step = steps[stepIndex]
  const visibleQuestions = step.questionIds
    .map((id) => findQuestion(id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .filter((q) => isQuestionVisible(q, answers))

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function validateStep() {
    const stepErrors: Record<string, string> = {}
    for (const q of visibleQuestions) {
      if (isQuestionRequired(q, answers) && isEmpty(answers[q.id])) {
        stepErrors[q.id] = "Required"
      }
    }
    setErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  function goNext() {
    if (!validateStep()) return
    startTransition(async () => {
      await autosaveSession(sessionId, answers)
      setStepIndex((i) => Math.min(steps.length - 1, i + 1))
    })
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function handleSubmit() {
    if (!validateStep()) return
    startTransition(async () => {
      await autosaveSession(sessionId, answers)
      const result = await submitSession(sessionId)
      if (!result.ok) {
        toast.error(`${result.missing.length} required question(s) still need an answer.`)
        return
      }
      router.push(`/sessions/${sessionId}`)
    })
  }

  const isLastStep = stepIndex === steps.length - 1

  return (
    <div className="mx-auto max-w-2xl">
      {mode === "quick" && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Quick intake — medical not screened. Plans generated from this session are marked
          unscreened.
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 flex justify-between text-sm text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span>{Math.round(((stepIndex + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="text-xl font-semibold">{step.title}</h2>
      {step.intro && <p className="mt-1 text-sm text-muted-foreground">{step.intro}</p>}

      <div className="mt-6 space-y-5">
        {visibleQuestions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(value) => setAnswer(q.id, value)}
            required={isQuestionRequired(q, answers)}
            error={errors[q.id]}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-between border-t pt-4">
        <Button variant="outline" onClick={goBack} disabled={stepIndex === 0 || isPending}>
          Back
        </Button>
        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={isPending}>
            Submit
          </Button>
        ) : (
          <Button onClick={goNext} disabled={isPending}>
            Next
          </Button>
        )}
      </div>
    </div>
  )
}
