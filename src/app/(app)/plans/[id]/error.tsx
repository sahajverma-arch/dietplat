"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Last-resort boundary for this route segment — expected domain errors
 * (PlanNotFoundError, swap/approve validation errors) are already caught
 * and shown inline where they're thrown (page.tsx's try/catch, the
 * swap/approve/generate-next-week handlers' try/catch + toast), since a
 * Server Action or thrown error caught client-side keeps its real message
 * while one left to reach this boundary gets Next's generic
 * "something went wrong" text in production. This only ever renders for a
 * genuinely unexpected bug.
 */
export default function PlanError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-destructive/30">
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium text-destructive">
            {error.name || "Error"}: {error.message || "An unexpected error occurred while rendering this plan."}
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
