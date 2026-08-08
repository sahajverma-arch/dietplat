"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Last-resort boundary for this route segment — expected domain errors
 * (RoadmapInputError, etc.) are caught and shown inline by the action
 * handlers that can throw them (see actions-bar.tsx, override-dialog.tsx),
 * since a Server Action error caught client-side keeps its real message
 * while one left to reach this boundary gets Next's generic
 * "something went wrong" text in production. This only ever renders for a
 * genuinely unexpected bug, not a known blocked-calculation case.
 */
export default function ReviewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-destructive/30">
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium text-destructive">
            {error.name || "Error"}: {error.message || "An unexpected error occurred while rendering this review."}
          </p>
          {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
