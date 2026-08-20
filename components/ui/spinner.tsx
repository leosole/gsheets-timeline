import React from "react";
import { cn } from "../../utils/cn";

interface SpinnerProps {
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ className = "" }) => (
  <span
    className={cn(
      "h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary",
      className,
    )}
    aria-hidden="true"
  />
);
