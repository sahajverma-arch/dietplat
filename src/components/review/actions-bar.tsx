"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { recomputeRoadmap } from "@/app/(app)/sessions/[sessionId]/review/actions"

// Only regions with seeded meal_templates + foods — see CLAUDE.md "The
// exchange system" and README "How to add a region". Keep in sync with
// supabase/migrations/20260808200000_classic_table41_exchange_system.sql,
// 20260809200000_south_indian_region.sql and 20260809300000_five_more_regions.sql.
const SEEDED_REGIONS = [
  { value: "north_indian", label: "North Indian" },
  { value: "maharashtrian", label: "Maharashtrian" },
  { value: "south_indian", label: "South Indian (Malayali)" },
  { value: "punjabi", label: "Punjabi" },
  { value: "gujarati", label: "Gujarati" },
  { value: "bengali", label: "Bengali" },
  { value: "rajasthani", label: "Rajasthani" },
  { value: "hyderabadi", label: "Hyderabadi" },
]

export function ActionsBar({
  sessionId,
  roadmapId,
  hasUnresolvedBlock,
}: {
  sessionId: string
  roadmapId: string
  hasUnresolvedBlock: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [region, setRegion] = useState(SEEDED_REGIONS[0].value)

  function handleRecompute() {
    startTransition(async () => {
      try {
        await recomputeRoadmap(sessionId)
        toast.success("Recomputed — new snapshot created")
      } catch (err) {
        // Caught here, not left to bubble to error.tsx — a Server Action
        // error caught client-side keeps its real message; one that
        // reaches the error boundary gets Next's generic production
        // message instead. A blocked clinical calculation (e.g. a missing
        // required answer) must show the actual RoadmapInputError text.
        toast.error(err instanceof Error ? err.message : "Recompute failed")
      }
    })
  }

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId, weekNumber: 1, region }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Plan generation failed")
        return
      }
      toast.success(
        `Week 1 plan generated (${data.generationMode === "ai" ? "AI-selected" : "fallback rotation"}, ${data.attempts} attempt${data.attempts === 1 ? "" : "s"}).`
      )
      router.push(`/plans/${data.dietPlanId}`)
    } catch {
      toast.error("Plan generation failed — network or server error")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4 print:hidden">
      <select
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        disabled={hasUnresolvedBlock || isGenerating}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {SEEDED_REGIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <Button onClick={handleGenerate} disabled={hasUnresolvedBlock || isGenerating}>
        {isGenerating ? "Generating…" : "Generate week 1 plan"}
      </Button>
      <Button variant="outline" onClick={handleRecompute} disabled={isPending}>
        {isPending ? "Recomputing…" : "Recompute"}
      </Button>
    </div>
  )
}
