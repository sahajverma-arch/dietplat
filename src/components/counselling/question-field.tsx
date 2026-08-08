"use client"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
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
import { Button } from "@/components/ui/button"
import type { Question } from "@/lib/counselling/questions"

export interface MealVariantRow {
  food: string
  quantity?: string
  daysPerWeek?: number
}

interface QuestionFieldProps {
  question: Question
  value: unknown
  onChange: (value: unknown) => void
  required: boolean
  error?: string
}

export function QuestionField({ question, value, onChange, required, error }: QuestionFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={question.id}>
        {question.label}
        {required && <span className="text-destructive"> *</span>}
      </FieldLabel>
      {renderInput(question, value, onChange)}
      {question.help && <FieldDescription>{question.help}</FieldDescription>}
      {question.note && <FieldDescription>{question.note}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

function renderInput(question: Question, value: unknown, onChange: (value: unknown) => void) {
  switch (question.type) {
    case "text":
      return (
        <Input
          id={question.id}
          value={(value as string) ?? ""}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "textarea":
      return (
        <Textarea
          id={question.id}
          value={(value as string) ?? ""}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "number":
      return (
        <Input
          id={question.id}
          type="number"
          value={(value as number) ?? ""}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      )
    case "height":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={question.id}
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
          <span className="text-sm text-muted-foreground">cm</span>
        </div>
      )
    case "date":
      return (
        <Input
          id={question.id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "time":
      return (
        <Input
          id={question.id}
          type="time"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "scale10":
      return (
        <div className="flex items-center gap-3">
          <input
            id={question.id}
            type="range"
            min={1}
            max={10}
            value={(value as number) ?? 5}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
          <span className="w-6 text-sm tabular-nums">{(value as number) ?? "—"}</span>
        </div>
      )
    case "single":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger id={question.id} className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {question.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case "multi":
    case "portions":
      return (
        <CheckboxGroup
          id={question.id}
          options={question.options ?? []}
          value={(value as string[]) ?? []}
          maxSelect={question.maxSelect}
          onChange={onChange}
        />
      )
    case "mealVariants":
      return (
        <MealVariantsInput
          value={(value as MealVariantRow[]) ?? []}
          onChange={onChange}
        />
      )
    default:
      return null
  }
}

function CheckboxGroup({
  id,
  options,
  value,
  maxSelect,
  onChange,
}: {
  id: string
  options: string[]
  value: string[]
  maxSelect?: number
  onChange: (value: string[]) => void
}) {
  function toggle(option: string, checked: boolean) {
    if (checked) {
      if (maxSelect && value.length >= maxSelect) return
      onChange([...value, option])
    } else {
      onChange(value.filter((v) => v !== option))
    }
  }

  return (
    <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
      {options.map((option) => {
        const checked = value.includes(option)
        return (
          <label key={option} htmlFor={`${id}-${option}`} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${id}-${option}`}
              checked={checked}
              onCheckedChange={(c) => toggle(option, c === true)}
              disabled={!checked && !!maxSelect && value.length >= maxSelect}
            />
            {option}
          </label>
        )
      })}
    </div>
  )
}

function MealVariantsInput({
  value,
  onChange,
}: {
  value: MealVariantRow[]
  onChange: (value: MealVariantRow[]) => void
}) {
  function updateRow(index: number, patch: Partial<MealVariantRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {value.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder="Food + quantity, e.g. 2 rotis with dal"
            value={row.food}
            onChange={(e) => updateRow(index, { food: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={7}
            placeholder="Days/wk"
            value={row.daysPerWeek ?? ""}
            onChange={(e) =>
              updateRow(index, { daysPerWeek: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="w-24"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { food: "" }])}>
        + Add option
      </Button>
      <FieldDescription>
        Qualitative context, not auto-costed — free-text food matching isn&apos;t reliable enough for a
        clinical number. Enter the actual estimate in the Estimated current daily calories/protein/carbs/fat
        fields further down this section.
      </FieldDescription>
    </div>
  )
}
