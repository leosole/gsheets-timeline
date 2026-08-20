import React from "react";
import { cn } from "../../utils/cn";

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string> {
  options: Array<ToggleOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

export const ToggleGroup = <T extends string>({
  options,
  value,
  onChange,
  className = "",
  itemClassName = "px-3 py-1 text-xs rounded-md transition-colors",
  activeClassName = "bg-primary text-white",
  inactiveClassName = "text-muted-foreground hover:text-foreground",
}: ToggleGroupProps<T>) => (
  <div
    className={cn(
      "flex rounded-lg border border-border bg-background p-0.5 gap-0.5",
      className,
    )}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          "cursor-pointer",
          itemClassName,
          value === option.value ? activeClassName : inactiveClassName,
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);
