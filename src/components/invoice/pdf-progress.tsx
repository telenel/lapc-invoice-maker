"use client";

import { Spinner, Checkmark } from "@/components/ui/step-indicators";
import type { GenerationStep } from "./invoice-form";

const STEPS: { key: GenerationStep; label: string }[] = [
  { key: "saving", label: "Creating invoice…" },
  { key: "generating", label: "Generating PDF…" },
  { key: "done", label: "Done!" },
];

function stepIndex(step: GenerationStep): number {
  if (step === "saving") return 0;
  if (step === "generating") return 1;
  if (step === "done") return 2;
  return -1;
}

export function PdfProgress({ step }: { step: GenerationStep }) {
  if (!step) return null;

  const currentIdx = stepIndex(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg p-6 w-80 space-y-4">
        <h3 className="text-lg font-semibold text-center">
          Generating Invoice
        </h3>
        <div className="space-y-3" aria-live="polite">
          {STEPS.map((s, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx || (idx === currentIdx && step === "done");

            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 text-sm ${
                  isActive
                    ? "text-foreground font-medium"
                    : isDone
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                <div className="flex-shrink-0 size-5">
                  {isActive && step !== "done" ? (
                    <Spinner />
                  ) : isDone ? (
                    <Checkmark />
                  ) : (
                    <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
