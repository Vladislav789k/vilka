"use client";

import { useState, useEffect } from "react";
import type { CheckoutDraft } from "./types";

const STORAGE_KEY = "vilka_checkout_draft";

export function useCheckoutDraft() {
  const [draft, setDraft] = useState<CheckoutDraft>(() => {
    if (typeof window === "undefined") {
      return {
        addressLabel: null,
        addressId: null,
        addressLatitude: null,
        addressLongitude: null,
        apartment: "",
        entrance: "",
        floor: "",
        intercom: "",
        comment: "",
        leaveAtDoor: false,
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as CheckoutDraft;
      }
    } catch (e) {
      console.warn("[useCheckoutDraft] Failed to load draft from localStorage", e);
    }

    return {
      addressLabel: null,
      addressId: null,
      addressLatitude: null,
      addressLongitude: null,
      apartment: "",
      entrance: "",
      floor: "",
      intercom: "",
      comment: "",
      leaveAtDoor: false,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn("[useCheckoutDraft] Failed to save draft to localStorage", e);
    }
  }, [draft]);

  const updateDraft = (updates: Partial<CheckoutDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const clearDraft = () => {
    setDraft({
      addressLabel: null,
      addressId: null,
      addressLatitude: null,
      addressLongitude: null,
      apartment: "",
      entrance: "",
      floor: "",
      intercom: "",
      comment: "",
      leaveAtDoor: false,
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("[useCheckoutDraft] Failed to clear draft from localStorage", e);
    }
  };

  return { draft, updateDraft, clearDraft };
}

