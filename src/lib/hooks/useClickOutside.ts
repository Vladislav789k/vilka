/**
 * Hook to detect clicks outside an element
 */
import { useEffect, RefObject } from "react";

type UseClickOutsideOptions = {
  enabled?: boolean;
  handler: (event: MouseEvent) => void;
};

export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  options: UseClickOutsideOptions
) {
  const { enabled = true, handler } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler(event);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, enabled, handler]);
}

