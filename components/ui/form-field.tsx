import React from "react";
import { cn } from "../../utils/cn";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  className = "",
}) => (
  <div className={cn("space-y-2", className)}>
    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);
