import Link from "next/link"

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        <Link href="/settings/generation-log" className="underline">
          Generation log
        </Link>{" "}
        — every plan-generation LLM attempt, for self-diagnosing a plan that looks wrong.
      </p>
    </div>
  )
}
