import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  slotIndex: 0 | 1 | 2;
  required: boolean;
  staffId: string;
  display: string;
  disabled: boolean;
  attemptedSubmit: boolean;
  children: ReactNode;
}

export function ApproverSlotCard({
  slotIndex,
  required,
  staffId,
  display,
  disabled,
  attemptedSubmit,
  children,
}: Props) {
  const filled = staffId.trim().length > 0;
  const showError = required && !filled && attemptedSubmit;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        showError ? "border-destructive bg-destructive/[0.04]" : "border-border",
        disabled && "opacity-70",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Signature {slotIndex + 1}
        </h3>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
            filled && required && "border border-positive-border bg-positive-bg text-positive",
            !filled && required && !attemptedSubmit && "text-muted-foreground",
            !filled && required && attemptedSubmit && "border border-destructive/30 bg-destructive/10 text-destructive",
            !required && (filled
              ? "border border-info-border bg-info-bg text-info"
              : "text-muted-foreground"),
          )}
        >
          {required ? "Required" : "Optional"}
        </span>
      </div>
      <div className="mb-3">{children}</div>
      <div
        className={cn(
          "border-b border-dashed pb-1.5",
          filled ? "border-foreground/40" : "border-border",
        )}
      >
        <p
          className={cn(
            "min-h-[1.4em] text-[12.5px] italic",
            filled ? "text-foreground" : "text-muted-foreground/60",
          )}
        >
          {filled ? display : "— select an approver —"}
        </p>
      </div>
    </div>
  );
}
