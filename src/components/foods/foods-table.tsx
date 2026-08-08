"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FoodFormDialog } from "@/components/foods/food-form-dialog"
import { DIET_TYPES, REGIONS } from "@/lib/foods/vocab"
import type { ExchangeType, Food } from "@/db/schema"

const ALL = "__all__"

export function FoodsTable({ foods, exchangeTypes }: { foods: Food[]; exchangeTypes: ExchangeType[] }) {
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState(ALL)
  const [dietType, setDietType] = useState(ALL)
  const [exchangeType, setExchangeType] = useState(ALL)

  const exchangeLabel = useMemo(() => new Map(exchangeTypes.map((et) => [et.code, et.label])), [exchangeTypes])

  const filtered = foods.filter((f) => {
    if (search && !f.nameEn.toLowerCase().includes(search.toLowerCase())) return false
    if (region !== ALL && !f.regions.includes(region)) return false
    if (dietType !== ALL && !f.dietTypes.includes(dietType)) return false
    if (exchangeType !== ALL && f.exchangeType !== exchangeType) return false
    return true
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search foods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={region} onValueChange={(v) => setRegion(v ?? ALL)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All regions</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dietType} onValueChange={(v) => setDietType(v ?? ALL)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Diet type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All diet types</SelectItem>
            {DIET_TYPES.map((d) => (
              <SelectItem key={d} value={d}>
                {d.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={exchangeType} onValueChange={(v) => setExchangeType(v ?? ALL)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Exchange type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exchange types</SelectItem>
            {exchangeTypes.map((et) => (
              <SelectItem key={et.code} value={et.code}>
                {et.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <FoodFormDialog exchangeTypes={exchangeTypes} trigger={<Button>+ Add food</Button>} />
        </div>
      </div>

      <p className="mb-2 text-sm text-muted-foreground">
        {filtered.length} of {foods.length} foods
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Exchange type</TableHead>
              <TableHead>Serving</TableHead>
              <TableHead>Diet types</TableHead>
              <TableHead>Meal slots</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((food) => (
              <TableRow key={food.id} className={food.isActive ? "" : "opacity-50"}>
                <TableCell className="font-medium">{food.nameEn}</TableCell>
                <TableCell>{exchangeLabel.get(food.exchangeType) ?? food.exchangeType}</TableCell>
                <TableCell>
                  {food.servingRawG !== null ? `${food.servingRawG} g` : "variable"}
                  {food.householdMeasure ? ` · ${food.householdMeasure}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {food.dietTypes.map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">
                        {d.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{food.mealSlots.join(", ")}</TableCell>
                <TableCell>
                  <Badge variant={food.isActive ? "default" : "secondary"}>
                    {food.isActive ? "active" : "inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <FoodFormDialog
                    exchangeTypes={exchangeTypes}
                    food={food}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
