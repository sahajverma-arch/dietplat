"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ChipCheckboxGroup } from "@/components/foods/chip-checkbox-group"
import { ALLERGENS, DIET_TYPES, MEAL_SLOTS, REGIONS, TAGS } from "@/lib/foods/vocab"
import type { ExchangeType, Food } from "@/db/schema"
import { createFood, updateFood, type FoodFormInput } from "@/app/(app)/foods/actions"

const EMPTY_FORM: FoodFormInput = {
  nameEn: "",
  nameHi: "",
  exchangeType: "",
  exchangeUnits: 1,
  servingRawG: null,
  householdMeasure: "",
  regions: ["generic"],
  dietTypes: [],
  mealSlots: [],
  allergens: [],
  tags: [],
  isActive: true,
  notes: "",
}

function formFromFood(food: Food): FoodFormInput {
  return {
    nameEn: food.nameEn,
    nameHi: food.nameHi ?? "",
    exchangeType: food.exchangeType,
    exchangeUnits: Number(food.exchangeUnits),
    servingRawG: food.servingRawG === null ? null : Number(food.servingRawG),
    householdMeasure: food.householdMeasure ?? "",
    regions: food.regions,
    dietTypes: food.dietTypes,
    mealSlots: food.mealSlots,
    allergens: food.allergens,
    tags: food.tags,
    isActive: food.isActive,
    notes: food.notes ?? "",
  }
}

export function FoodFormDialog({
  exchangeTypes,
  food,
  trigger,
}: {
  exchangeTypes: ExchangeType[]
  food?: Food
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FoodFormInput>(food ? formFromFood(food) : EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof FoodFormInput>(key: K, value: FoodFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setForm(food ? formFromFood(food) : EMPTY_FORM)
  }

  function handleSubmit() {
    if (!form.nameEn.trim() || !form.exchangeType) {
      toast.error("Name and exchange type are required.")
      return
    }
    startTransition(async () => {
      try {
        if (food) {
          await updateFood(food.id, form)
          toast.success(`${form.nameEn} updated`)
        } else {
          await createFood(form)
          toast.success(`${form.nameEn} added`)
        }
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save food")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{food ? `Edit ${food.nameEn}` : "Add food"}</DialogTitle>
          <DialogDescription>
            One exchange of the selected group — set the serving that carries it.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="food-name-en">
                Name (English) <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="food-name-en" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="food-name-hi">Name (Hindi)</FieldLabel>
              <Input id="food-name-hi" value={form.nameHi} onChange={(e) => set("nameHi", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="food-exchange-type">
                Exchange type <span className="text-destructive">*</span>
              </FieldLabel>
              <Select value={form.exchangeType} onValueChange={(v) => set("exchangeType", v ?? "")}>
                <SelectTrigger id="food-exchange-type" className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {exchangeTypes.map((et) => (
                    <SelectItem key={et.code} value={et.code}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="food-exchange-units">Exchange units</FieldLabel>
              <Input
                id="food-exchange-units"
                type="number"
                step="0.5"
                value={form.exchangeUnits}
                onChange={(e) => set("exchangeUnits", Number(e.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="food-serving-g">Serving (g)</FieldLabel>
              <Input
                id="food-serving-g"
                type="number"
                placeholder="variable (e.g. fruit)"
                value={form.servingRawG ?? ""}
                onChange={(e) => set("servingRawG", e.target.value === "" ? null : Number(e.target.value))}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="food-household-measure">Household measure</FieldLabel>
            <Input
              id="food-household-measure"
              placeholder='e.g. "5 rotis", "1 katori diced"'
              value={form.householdMeasure}
              onChange={(e) => set("householdMeasure", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Regions</FieldLabel>
            <ChipCheckboxGroup idPrefix="regions" options={REGIONS} value={form.regions} onChange={(v) => set("regions", v)} />
          </Field>
          <Field>
            <FieldLabel>Diet types</FieldLabel>
            <ChipCheckboxGroup idPrefix="diet" options={DIET_TYPES} value={form.dietTypes} onChange={(v) => set("dietTypes", v)} />
          </Field>
          <Field>
            <FieldLabel>Meal slots</FieldLabel>
            <ChipCheckboxGroup idPrefix="slots" options={MEAL_SLOTS} value={form.mealSlots} onChange={(v) => set("mealSlots", v)} />
          </Field>
          <Field>
            <FieldLabel>Allergens</FieldLabel>
            <ChipCheckboxGroup idPrefix="allergens" options={ALLERGENS} value={form.allergens} onChange={(v) => set("allergens", v)} />
          </Field>
          <Field>
            <FieldLabel>Tags</FieldLabel>
            <ChipCheckboxGroup idPrefix="tags" options={TAGS} value={form.tags} onChange={(v) => set("tags", v)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="food-notes">Notes</FieldLabel>
            <Textarea id="food-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          <label htmlFor="food-is-active" className="flex items-center gap-2 text-sm">
            <Checkbox id="food-is-active" checked={form.isActive} onCheckedChange={(c) => set("isActive", c === true)} />
            Active (offered to the food selector)
          </label>
        </FieldGroup>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {food ? "Save changes" : "Add food"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
