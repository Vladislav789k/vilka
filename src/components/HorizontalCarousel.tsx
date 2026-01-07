"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type HorizontalCarouselProps = {
  children: ReactNode;
  className?: string;
  cardWidth?: number; // Width of one card including gap
  scrollBy?: number; // Number of cards to scroll per click
};

export function HorizontalCarousel({
  children,
  className = "",
  cardWidth = 272, // 256px card + 16px gap
  scrollBy = 2,
}: HorizontalCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [showArrows, setShowArrows] = useState(false);
  
  // Show arrows on mobile by default, hide on desktop until hover
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const updateScrollButtons = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const isAtStart = scrollLeft <= 0;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;
    
    setCanScrollLeft(!isAtStart);
    setCanScrollRight(!isAtEnd);
  }, []);

  // Throttled scroll handler using requestAnimationFrame
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        updateScrollButtons();
        rafId = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollButtons(); // Initial check

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [updateScrollButtons]);

  // ResizeObserver for container size changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScrollButtons();
    });

    resizeObserver.observe(container);

    // Also handle window resize
    const handleResize = () => {
      updateScrollButtons();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollButtons]);

  // Update when children change (content changes)
  useEffect(() => {
    // Use a small delay to ensure DOM has updated
    const timeoutId = setTimeout(() => {
      updateScrollButtons();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [children, updateScrollButtons]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = cardWidth * scrollBy;
    
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" && canScrollLeft) {
      e.preventDefault();
      scroll("left");
    } else if (e.key === "ArrowRight" && canScrollRight) {
      e.preventDefault();
      scroll("right");
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setShowArrows(true)}
      onMouseLeave={() => setShowArrows(false)}
    >
      {/* Left Arrow - Always visible, disabled when at start */}
      <button
        type="button"
        onClick={() => {
          if (canScrollLeft) {
            scroll("left");
          }
        }}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        aria-disabled={!canScrollLeft}
        className={`absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-card p-2 shadow-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:border-white/10 dark:bg-slate-800 ${
          isMobile || showArrows ? "opacity-100" : "opacity-0"
        } ${
          !canScrollLeft
            ? "cursor-not-allowed opacity-30"
            : "hover:bg-hover dark:hover:bg-slate-700 cursor-pointer opacity-100"
        }`}
        style={{ pointerEvents: !canScrollLeft && (isMobile || showArrows) ? "none" : "auto" }}
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-lg"
      >
        {children}
      </div>

      {/* Right Arrow - Always visible, disabled when at end */}
      <button
        type="button"
        onClick={() => {
          if (canScrollRight) {
            scroll("right");
          }
        }}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className={`absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-card p-2 shadow-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:border-white/10 dark:bg-slate-800 ${
          isMobile || showArrows ? "opacity-100" : "opacity-0"
        } ${
          !canScrollRight
            ? "cursor-not-allowed opacity-30"
            : "hover:bg-hover dark:hover:bg-slate-700 cursor-pointer"
        }`}
        style={{ pointerEvents: !canScrollRight ? "none" : "auto" }}
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
}
