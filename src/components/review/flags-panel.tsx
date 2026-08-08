import type { RoadmapFlag, FlagLevel } from "@/lib/counselling/types"

const LEVEL_ORDER: FlagLevel[] = ["stop", "block", "warn", "note"]

const LEVEL_STYLES: Record<FlagLevel, string> = {
  stop: "border-red-400 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  block: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  note: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
}

export function FlagsPanel({ flags, overriddenCodes }: { flags: RoadmapFlag[]; overriddenCodes: Set<string> }) {
  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No flags raised.</p>
  }

  const grouped = LEVEL_ORDER.map((level) => ({ level, items: flags.filter((f) => f.level === level) })).filter(
    (g) => g.items.length > 0
  )

  return (
    <div className="space-y-3">
      {grouped.map(({ level, items }) => (
        <div key={level} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{level}</h3>
          {items.map((flag) => (
            <div key={flag.code} className={`rounded-md border px-3 py-2 text-sm ${LEVEL_STYLES[flag.level]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{flag.code}</span>
                {overriddenCodes.has(flag.code) && (
                  <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-medium dark:bg-black/20">
                    override recorded
                  </span>
                )}
              </div>
              <p className="mt-1">{flag.message}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
