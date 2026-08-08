import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatKcal } from "@/lib/format"
import type { StrategyPhase } from "@/lib/counselling/strategy"

export function PhaseTable({ phases }: { phases: StrategyPhase[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phase</TableHead>
          <TableHead>Weeks</TableHead>
          <TableHead>kcal</TableHead>
          <TableHead>Why</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {phases.map((phase, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{phase.label}</TableCell>
            <TableCell className="tabular-nums">
              {phase.weekFrom}
              {phase.weekTo ? `–${phase.weekTo}` : "+"}
            </TableCell>
            <TableCell className="tabular-nums">{formatKcal(phase.kcal)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{phase.why}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
