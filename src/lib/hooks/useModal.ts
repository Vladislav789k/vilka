/**
 * Shared modal state management hook
 * Provides consistent open/close behavior with animation support
 */
import { useState, useEffect, useRef, useCallback } from "react";

type UseModalOptions = {
  onOpen?: () => void;
  onClose?: () => void;
  closeDelay?: number; // Delay before calling onClose (for animations)
};

export function useModal(options: UseModalOptions = {}) {
  const { onOpen, onClose, closeDelay = 0 } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const open = useCallback(() => {
    setIsClosing(false);
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    if (!isOpen) return;

    setIsClosing(true);

    if (closeDelay > 0) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
        onClose?.();
      }, closeDelay);
    } else {
      setIsOpen(false);
      setIsClosing(false);
      onClose?.();
    }
  }, [isOpen, closeDelay, onClose]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Reset closing state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  return {
    isOpen,
    isClosing,
    open,
    close,
    toggle,
  };
}

