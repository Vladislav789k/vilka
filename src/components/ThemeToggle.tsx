"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Shared function to trigger shimmer effect with random color variant
  const triggerShimmerEffect = () => {
    // Find the app shell wrapper
    const appShell = document.getElementById("app-shell");
    if (!appShell) {
      // Safe guard: if wrapper not found, do nothing (no crash)
      return;
    }

    // Prevent multiple simultaneous triggers
    if (appShell.classList.contains("theme-transitioning")) {
      return;
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      // Skip animation for users who prefer reduced motion
      return;
    }

    const colorVariants = ["purple-blue", "blue-cyan", "pink-rose", "orange-amber", "green-emerald", "rainbow"];
    
    const colorPalettes: Record<string, { start: string; mid: string }> = {
      "purple-blue": { start: "#8b5cf6", mid: "#3b82f6" },
      "blue-cyan": { start: "#3b82f6", mid: "#06b6d4" },
      "pink-rose": { start: "#ec4899", mid: "#f43f5e" },
      "orange-amber": { start: "#f97316", mid: "#f59e0b" },
      "green-emerald": { start: "#10b981", mid: "#059669" },
      "rainbow": { start: "#ef4444", mid: "#8b5cf6" }
    };
    
    const randomColorVariant = colorVariants[Math.floor(Math.random() * colorVariants.length)];
    const palette = colorPalettes[randomColorVariant] || colorPalettes["purple-blue"];
    
    // Create gradient with selected colors (always left-to-right)
    let gradient: string;
    if (randomColorVariant === "rainbow") {
      gradient = "linear-gradient(90deg, currentColor 0%, #ef4444 15%, #f97316 25%, #eab308 35%, #22c55e 45%, #3b82f6 55%, #8b5cf6 65%, #ec4899 75%, currentColor 85%, currentColor 100%)";
    } else {
      gradient = `linear-gradient(90deg, currentColor 0%, currentColor 20%, ${palette.start} 30%, ${palette.mid} 40%, ${palette.start} 50%, currentColor 60%, currentColor 100%)`;
    }
    
    // Trigger transition effect on the wrapper only
    appShell.classList.add("theme-transitioning");
    appShell.setAttribute("data-shimmer-variant", randomColorVariant);
    appShell.style.setProperty("--gradient-direction", gradient);
    
    // Set will-change for performance during animation
    appShell.style.willChange = "background-position";
    
    // Remove transition class after animation completes (2s animation + 100ms buffer)
    setTimeout(() => {
      appShell.classList.remove("theme-transitioning");
      appShell.removeAttribute("data-shimmer-variant");
      appShell.style.removeProperty("--gradient-direction");
      appShell.style.willChange = "auto";
    }, 2100);
  };

  if (!mounted) {
    return (
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border text-foreground transition-colors shadow-sm hover:bg-hover dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/10"
        aria-label="Переключить тему"
        disabled
      >
        <Moon className="h-4 w-4" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => {
        const newTheme = isDark ? "light" : "dark";
        console.log("[ThemeToggle] Switching theme from", theme, "to", newTheme);
        
        // Trigger shimmer effect before theme change
        triggerShimmerEffect();
        
        // Change theme
        setTheme(newTheme);
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border text-slate-700 transition-colors shadow-sm hover:bg-hover dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-white/10"
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      title={isDark ? "Тёмная тема активна. Нажмите для переключения на светлую" : "Светлая тема активна. Нажмите для переключения на тёмную"}
    >
      {isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}

