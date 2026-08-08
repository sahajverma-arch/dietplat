"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { recordOverride } from "@/app/(app)/sessions/[sessionId]/review/actions"

export function OverrideDialog({
  roadmapId,
  sessionId,
  flagCode,
}: {
  roadmapId: string
  sessionId: string
  flagCode: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [dietitianName, setDietitianName] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!reason.trim() || !dietitianName.trim()) {
      toast.error("Reason and your name are both required.")
      return
    }
    startTransition(async () => {
      try {
        await recordOverride({ roadmapId, sessionId, flagCode, reason, dietitianName })
        toast.success("Override recorded")
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not record override")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Record override</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override {flagCode}</DialogTitle>
          <DialogDescription>
            This records your professional judgment to proceed despite the block flag. It does not
            change the roadmap — the flag stays visible alongside the override.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="override-name">Your name</FieldLabel>
            <Input id="override-name" value={dietitianName} onChange={(e) => setDietitianName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="override-reason">Reason</FieldLabel>
            <Textarea id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            Record override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
