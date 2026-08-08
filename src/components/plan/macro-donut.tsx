"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

const COLORS = { protein: "#facc15", carbs: "#38bdf8", fat: "#f97316" }

export function MacroDonut({ proteinG, carbsG, fatG }: { proteinG: number; carbsG: number; fatG: number }) {
  const data = [
    { name: "Protein", value: proteinG * 4, color: COLORS.protein },
    { name: "Carbohydrates", value: carbsG * 4, color: COLORS.carbs },
    { name: "Fat", value: fatG * 9, color: COLORS.fat },
  ]

  return (
    <div className="h-32 w-32 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="60%" outerRadius="100%" paddingAngle={2} stroke="none">
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
