"use client";

import { type ReactNode, type CSSProperties, isValidElement, useState, useEffect } from "react";
import { useTheme } from "next-themes";

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
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only apply theme-dependent styles after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure children is not empty - if it is, don't render the button
  const hasContent =
    (typeof children === "string" && children.trim().length > 0) ||
    (typeof children === "number" && children !== 0) ||
    (isValidElement(children) && children !== null);

  if (!hasContent) {
    return null;
  }

  const baseClasses =
    "appearance-none inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-medium transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const variantClasses = {
    default: isSelected
      ? "bg-brand text-white shadow-sm hover:bg-brand-dark active:bg-brand-dark dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
      : "bg-card text-foreground border border-border shadow-sm hover:bg-hover hover:border-border active:bg-muted dark:bg-slate-800 dark:text-foreground dark:border-slate-700 dark:hover:bg-slate-700",
    primary: isSelected
      ? "!bg-brand !text-white !border-brand border shadow-sm hover:!bg-brand-dark active:!bg-brand-dark"
      : "bg-card text-foreground border border-border shadow-sm hover:bg-hover hover:border-border active:bg-muted dark:bg-slate-800 dark:text-foreground dark:border-slate-700 dark:hover:bg-slate-700",
    secondary: isSelected
      ? "bg-muted text-foreground border-2 border-border shadow-sm hover:bg-hover active:bg-hover dark:bg-slate-700 dark:text-white dark:border-slate-500"
      : "bg-card text-foreground border border-border shadow-sm hover:bg-hover hover:border-border active:bg-muted dark:bg-slate-800 dark:text-foreground dark:border-slate-700 dark:hover:bg-slate-700",
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  // Some environments may apply UA/extension styles that override utility classes after click/focus.
  // Inline style ensures the selected primary option stays green and readable.
  // Explicit inline backgrounds/borders to keep pills readable, especially in light theme,
  // while still allowing text color to be controlled by shimmer / Tailwind classes.
  // Only apply inline styles after hydration to avoid server/client mismatch.
  let inlineStyle: CSSProperties | undefined;

  if (mounted) {
    const isDark = theme === "dark";
    if (!isDark) {
      const isBrandSelected = isSelected && (variant === "primary" || variant === "default");
      inlineStyle = {
        backgroundColor: isBrandSelected ? "#16a34a" : "#ffffff",
        borderColor: isBrandSelected ? "#16a34a" : "#cbd5e1",
      };
    } else if (variant === "primary" && isSelected) {
      inlineStyle = {
        backgroundColor: "#16a34a",
        borderColor: "#16a34a",
      };
    }
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={combinedClasses}
      style={inlineStyle}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

