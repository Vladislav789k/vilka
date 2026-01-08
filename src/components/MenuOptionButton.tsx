"use client";

import { type ReactNode, isValidElement } from "react";

type MenuOptionButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
  isDisabled?: boolean;
  variant?: "default" | "primary" | "secondary";
  className?: string;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
  key?: string | number; // React special prop, not passed to component
};

/**
 * Unified option button component for menu item selectors (sizes, variants, categories, etc.)
 * Provides consistent styling across all option buttons in the catalog.
 */
export function MenuOptionButton({
  children,
  onClick,
  isSelected = false,
  isDisabled = false,
  variant = "default",
  className = "",
  type = "button",
  "aria-label": ariaLabel,
}: MenuOptionButtonProps) {
  // Ensure children is not empty - if it is, don't render the button
  const hasContent =
    (typeof children === "string" && children.trim().length > 0) ||
    (typeof children === "number" && children !== 0) ||
    (isValidElement(children) && children !== null);

  if (!hasContent) {
    return null;
  }

  const baseClasses =
    "appearance-none inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-medium transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const variantClasses = {
    default: isSelected
      ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-900"
      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 active:bg-slate-300",
    primary: isSelected
      ? "!bg-brand !text-white !border-brand border shadow-sm hover:!bg-brand-dark active:!bg-brand-dark"
      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 active:bg-slate-300",
    secondary: isSelected
      ? "bg-slate-100 text-slate-900 border-2 border-slate-400 shadow-sm hover:bg-slate-200 active:bg-slate-300"
      : "bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100",
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  // Some environments may apply UA/extension styles that override utility classes after click/focus.
  // Inline style ensures the selected primary option stays green and readable.
  const selectedPrimaryStyle =
    variant === "primary" && isSelected
      ? ({
          backgroundColor: "#16a34a",
          color: "#ffffff",
          borderColor: "#16a34a",
          WebkitTextFillColor: "#ffffff",
        } as const)
      : undefined;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={combinedClasses}
      style={selectedPrimaryStyle}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

