"use client"

import { Checkbox } from "@/components/ui/checkbox"

export function ChipCheckboxGroup({
  idPrefix,
  options,
  value,
  onChange,
}: {
  idPrefix: string
  options: readonly string[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  function toggle(option: string, checked: boolean) {
    onChange(checked ? [...value, option] : value.filter((v) => v !== option))
  }

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label key={option} htmlFor={`${idPrefix}-${option}`} className="flex items-center gap-1.5 text-sm">
          <Checkbox
            id={`${idPrefix}-${option}`}
            checked={value.includes(option)}
            onCheckedChange={(c) => toggle(option, c === true)}
          />
          {option.replace(/_/g, " ")}
        </label>
      ))}
    </div>
  )
}
