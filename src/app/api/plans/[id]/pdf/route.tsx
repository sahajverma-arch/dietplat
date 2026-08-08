import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"

import { requireStaffUser } from "@/lib/counselling/require-staff-user"
import { PlanNotFoundError, loadPlanViewModel } from "@/lib/plan/plan-view-model"
import { PlanPdfDocument } from "@/components/plan/pdf/plan-pdf-document"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaffUser()

  const { id } = await params

  let model
  try {
    model = await loadPlanViewModel(id)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    throw err
  }

  const buffer = await renderToBuffer(<PlanPdfDocument model={model} />)
  const filename = `${model.client.slug}-week${model.plan.weekNumber}-diet-plan.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
