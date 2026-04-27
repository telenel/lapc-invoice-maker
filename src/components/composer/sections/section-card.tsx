import type { ReactNode } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionAnchor } from "../types";

type Status = "default" | "complete" | "blocker";

interface StepBadgeProps {
  step: number;
  status: Status;
}

export function StepBadge({ step, status }: StepBadgeProps) {
  const statusLabel =
    status === "complete" ? "complete" : status === "blocker" ? "blocker" : "in progress";
  return (
    <span
      role="img"
      aria-label={`Step ${step} of 6, ${statusLabel}`}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
        "border transition-colors tabular-nums",
        status === "default" && "border-border bg-background text-foreground",
        status === "complete" && "border-positive-border bg-positive text-primary-foreground",
        status === "blocker" && "border-destructive bg-destructive text-primary-foreground",
      )}
    >
      {status === "complete" ? (
        <CheckIcon className="size-3.5" />
      ) : status === "blocker" ? (
        <XIcon className="size-3.5" />
      ) : (
        step
      )}
    </span>
  );
}

interface SectionCardProps {
  step: number;
  title: string;
  description?: string;
  anchor: SectionAnchor;
  status: Status;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  step,
  title,
  description,
  anchor,
  status,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className={cn(
        "rounded-lg border border-border bg-card p-[18px] shadow-sm transition-shadow",
        "hover:shadow-rail focus-within:shadow-rail",
        className,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <StepBadge step={step} status={status} />
          <div>
            <h2
              id={`${anchor}-title`}
              className="text-sm font-semibold tracking-tight"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
