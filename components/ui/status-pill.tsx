import React from "react";
import { cn } from "../../utils/cn";

interface StatusPillProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  showCheck?: boolean;
  className?: string;
  customColor?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  selected = false,
  onClick,
  showCheck = false,
  className = "",
  customColor,
}) => {
  const baseClass =
    "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors";

  const selectedClass = selected
    ? "bg-primary text-white border-primary"
    : "bg-background text-muted-foreground border-border hover:border-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        baseClass,
        !customColor && selectedClass,
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
      style={
        customColor
          ? {
              backgroundColor: customColor,
              color: "white",
              borderColor: customColor,
            }
          : undefined
      }
    >
      {showCheck ? <span>✓</span> : null}
      <span>{label}</span>
    </button>
  );
};
