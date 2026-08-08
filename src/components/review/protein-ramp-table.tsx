import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatGrams } from "@/lib/format"
import type { ProteinRampRow } from "@/lib/counselling/protein-ramp"

export function ProteinRampTable({ rows, proteinHeld }: { rows: ProteinRampRow[]; proteinHeld: boolean }) {
  if (proteinHeld) {
    return <p className="text-sm text-muted-foreground">Protein held at the recorded cap — ramp disabled.</p>
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Already at target protein — no ramp needed.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Week</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>Gap</TableHead>
          <TableHead>Step</TableHead>
          <TableHead>After</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.week}>
            <TableCell className="tabular-nums">{row.week}</TableCell>
            <TableCell className="tabular-nums">{formatGrams(row.beforeG)} g</TableCell>
            <TableCell className="tabular-nums">{formatGrams(row.gapG)} g</TableCell>
            <TableCell className="font-mono text-xs">{row.stepFormula}</TableCell>
            <TableCell className="tabular-nums font-medium">{formatGrams(row.afterG)} g</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
