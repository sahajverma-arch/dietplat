"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { approvePlan } from "@/app/(app)/plans/[id]/actions"
import { cn } from "@/lib/utils"

export function PlanActionsBar({
  planId,
  roadmapId,
  weekNumber,
  region,
  status,
  withinTolerance,
}: {
  planId: string
  roadmapId: string
  weekNumber: number
  region: string
  status: "draft" | "approved"
  withinTolerance: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isGeneratingNext, setIsGeneratingNext] = useState(false)

  function handleApprove() {
    startTransition(async () => {
      try {
        await approvePlan(planId)
        toast.success("Plan approved.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not approve plan")
      }
    })
  }

  async function handleGenerateNextWeek() {
    setIsGeneratingNext(true)
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId, weekNumber: weekNumber + 1, region }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Could not generate next week")
        return
      }
      toast.success(`Week ${weekNumber + 1} plan generated.`)
      router.push(`/plans/${data.dietPlanId}`)
    } catch {
      toast.error("Could not generate next week — network or server error")
    } finally {
      setIsGeneratingNext(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4 print:hidden">
      {status === "approved" ? (
        <Badge>Approved</Badge>
      ) : (
        <Button onClick={handleApprove} disabled={isPending || !withinTolerance}>
          {isPending ? "Approving…" : "Mark approved"}
        </Button>
      )}
      <Button variant="outline" onClick={handleGenerateNextWeek} disabled={isGeneratingNext}>
        {isGeneratingNext ? "Generating…" : `Generate week ${weekNumber + 1}`}
      </Button>
      <a href={`/api/plans/${planId}/pdf`} className={cn(buttonVariants({ variant: "outline" }))}>
        Export PDF
      </a>
    </div>
  )
}
