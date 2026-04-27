import { cn } from "@/lib/utils";
import type { ComposerStatus } from "../types";

const TONES: Record<string, string> = {
  DRAFT:     "bg-muted text-muted-foreground border-border",
  FINALIZED: "bg-positive-bg text-positive border-positive-border",
  SENT:      "bg-info-bg text-info border-info-border",
  PAID:      "bg-positive-bg text-positive border-positive-border",
  EXPIRED:   "bg-warn-bg text-warn border-warn-border",
  DECLINED:  "bg-destructive/10 text-destructive border-destructive/30",
  REVISED:   "bg-info-bg text-info border-info-border",
};

interface Props {
  status: ComposerStatus;
  className?: string;
}

export function StatusPill({ status, className }: Props) {
  const tone = TONES[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider",
        tone,
        className,
      )}
    >
      {status}
    </span>
  );
}
