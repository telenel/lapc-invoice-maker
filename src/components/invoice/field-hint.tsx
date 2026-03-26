"use client";

import { useState, useEffect } from "react";

export const HINTS_KEY = "lapc-hints-dismissed";

export function useHintsDismissed() {
  const [dismissed, setDismissed] = useState(true); // default true to avoid SSR flash

  useEffect(() => {
    const stored = localStorage.getItem(HINTS_KEY);
    setDismissed(stored === "true");
  }, []);

  function dismiss() {
    localStorage.setItem(HINTS_KEY, "true");
    setDismissed(true);
  }

  return { dismissed, dismiss };
}

export function FieldHint({
  text,
  dismissed,
  onDismiss,
}: {
  text: string;
  dismissed: boolean;
  onDismiss: () => void;
}) {
  if (dismissed) return null;
  return (
    <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
      <span>{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 underline underline-offset-2 hover:text-foreground"
        aria-label="Hide hints"
      >
        hide hints
      </button>
    </p>
  );
}
