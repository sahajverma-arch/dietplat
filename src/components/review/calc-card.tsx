import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CalcCard({
  title,
  given,
  formula,
  calc,
  footnote,
  chip,
}: {
  title: string
  given: string
  formula: string
  calc: React.ReactNode
  footnote?: string
  chip?: React.ReactNode
}) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          {title}
          {chip}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <Row label="GIVEN" value={given} />
        <Row label="FORMULA" value={formula} muted />
        <Row label="CALC" value={calc} strong />
        {footnote && <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{footnote}</p>}
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string
  value: React.ReactNode
  muted?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${muted ? "text-muted-foreground italic" : ""} ${strong ? "font-medium" : ""}`}
      >
        {value}
      </span>
    </div>
  )
}
