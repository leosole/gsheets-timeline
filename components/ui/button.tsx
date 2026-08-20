import React from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon" | "text";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  title?: string;
  className?: string;
  ariaLabel?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "cursor-pointer rounded-md bg-primary text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "cursor-pointer rounded-md border border-border bg-background text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "cursor-pointer rounded-lg text-muted-foreground hover:bg-muted",
  icon: "cursor-pointer rounded p-1 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground",
  text: "cursor-pointer bg-transparent border-0 text-muted-foreground hover:text-foreground",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1",
  md: "px-3 py-2",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  size = "md",
  disabled = false,
  title,
  className = "",
  ariaLabel,
}) => {
  const baseSize =
    variant === "ghost" || variant === "icon" || variant === "text"
      ? ""
      : sizeClasses[size];
  const classes = cn(variantClasses[variant], baseSize, className);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  );
};
