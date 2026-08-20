import React from "react";

interface CheckboxChipProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const CheckboxChip: React.FC<CheckboxChipProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => (
  <label className="cursor-pointer">
    <input
      disabled={disabled}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="peer sr-only"
    />
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs peer-checked:bg-primary">
      {label}
    </span>
  </label>
);
