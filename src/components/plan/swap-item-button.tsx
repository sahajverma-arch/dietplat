"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getSwapCandidates, swapPlanItem, type SwapCandidate } from "@/app/(app)/plans/[id]/actions"
import { formatItemLabel } from "@/lib/plan/format-item"
import type { PlanViewItem } from "@/lib/plan/plan-view-model"

export function SwapItemButton({ item, editable }: { item: PlanViewItem; editable: boolean }) {
  const [open, setOpen] = useState(false)
  const [candidates, setCandidates] = useState<SwapCandidate[] | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!editable) {
    return <span>{formatItemLabel(item)}</span>
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && candidates === null) {
      startTransition(async () => {
        setCandidates(await getSwapCandidates(item.id))
      })
    }
  }

  function handlePick(foodId: string) {
    startTransition(async () => {
      try {
        await swapPlanItem(item.id, foodId)
        toast.success("Swapped — grams recomputed, macros unchanged.")
        setOpen(false)
        setCandidates(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Swap failed")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
            title="Click to swap this food"
          />
        }
      >
        {formatItemLabel(item)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Swap {item.nameEn}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {candidates === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading eligible foods…</p>
          ) : candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No other eligible {item.exchangeType} foods for this client at this slot.
            </p>
          ) : (
            candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={isPending}
                onClick={() => handlePick(c.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span>{c.nameEn}</span>
                {c.householdMeasure && <span className="text-xs text-muted-foreground">{c.householdMeasure}</span>}
              </button>
            ))
          )}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
