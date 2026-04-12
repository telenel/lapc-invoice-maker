"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildWallClockTimeOptions, formatWallClockTime, normalizeWallClockTimeInput } from "@/lib/time";
import { cn } from "@/lib/utils";

interface TimeSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  additionalValues?: Array<string | null | undefined>;
}

export function TimeSelect({
  id,
  value,
  onValueChange,
  placeholder = "Select time",
  disabled = false,
  invalid = false,
  className,
  additionalValues = [],
}: TimeSelectProps) {
  const normalizedValue = normalizeWallClockTimeInput(value) ?? "";
  const selectedLabel = normalizedValue ? formatWallClockTime(normalizedValue) : "";
  const options = buildWallClockTimeOptions([value, ...additionalValues]);

  return (
    <Select
      value={normalizedValue}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid}
        className={cn("w-full", className)}
      >
        {selectedLabel ? (
          <SelectValue>{selectedLabel}</SelectValue>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
