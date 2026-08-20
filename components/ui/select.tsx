import React from "react";
import { cn } from "../../utils/cn";

type SelectOption = string | { value: string; label: string };

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const normalizeOption = (option: SelectOption) =>
  typeof option === "string"
    ? { value: option, label: option }
    : { value: option.value, label: option.label };

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  className = "",
  placeholder,
}) => (
  <select
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.target.value)}
    className={cn(
      "rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50",
      className,
    )}
  >
    {placeholder ? <option value="">{placeholder}</option> : null}
    {options.map((option) => {
      const normalized = normalizeOption(option);
      return (
        <option key={normalized.value} value={normalized.value}>
          {normalized.label}
        </option>
      );
    })}
  </select>
);
