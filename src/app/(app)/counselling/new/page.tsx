"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { startCounsellingSession } from "@/app/(app)/counselling/actions"

export default function NewCounsellingPage() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()

  function start(type: "quick" | "full") {
    if (!name.trim()) return
    startTransition(async () => {
      try {
        await startCounsellingSession({ name, phone: phone || undefined, email: email || undefined, type })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start counselling session")
      }
    })
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">New Counselling</h1>
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>Start a quick or full counselling session.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-client-name">
                Client full name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="new-client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anita Verma" />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-client-phone">Phone</FieldLabel>
              <Input id="new-client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx xxxxx" />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-client-email">Email</FieldLabel>
              <Input id="new-client-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" />
            </Field>
          </FieldGroup>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" disabled={!name.trim() || isPending} onClick={() => start("quick")}>
              Start Quick (8 steps)
            </Button>
            <Button className="flex-1" disabled={!name.trim() || isPending} onClick={() => start("full")}>
              Start Full (15 steps)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
