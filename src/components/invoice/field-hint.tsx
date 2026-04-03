"use client";

import { useUserPreference } from "@/domains/user-preference/hooks";

export const HINTS_KEY = "laportal-hints-dismissed";

function parseHintsDismissed(value: unknown): boolean {
  return value === true;
}

export function useHintsDismissed() {
  const {
    value: dismissed,
    setValue: setDismissed,
  } = useUserPreference<boolean>({
    key: HINTS_KEY,
    defaultValue: true,
    deserialize: parseHintsDismissed,
  });

  function dismiss() {
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
        className="shrink-0 underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Hide hints"
      >
        hide hints
      </button>
    </p>
  );
}
