import React from "react";
import { cn } from "../../utils/cn";

type AlertType = "error" | "info" | "muted";

interface AlertProps {
  type: AlertType;
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}

const commonClasses = "rounded-md border px-3 py-2 text-sm absolute bottom-0";

const alertClasses: Record<AlertType, string> = {
  error:
    commonClasses + " border-destructive/40 bg-destructive text-destructive",
  info: commonClasses + " border-primary/30 bg-accent text-foreground",
  muted: commonClasses + " border-border bg-muted text-muted-foreground",
};

export const Alert: React.FC<AlertProps> = ({
  type,
  children,
  className = "",
  role,
}) => (
  <div role={role} className={cn(alertClasses[type], className)}>
    {children}
  </div>
);
