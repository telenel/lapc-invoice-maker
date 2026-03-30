"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Spinner, Checkmark, ErrorX } from "@/components/ui/step-indicators";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export type EmailStep = null | "validating" | "connecting" | "sending" | "done" | "error";

interface LogEntry {
  timestamp: string;
  message: string;
  status?: "ok" | "error" | "pending";
}

interface EmailProgressProps {
  step: EmailStep;
  recipientEmail: string;
  logs: LogEntry[];
  error?: string;
  onClose: () => void;
  onRetry: () => void;
}

const STEPS: { key: Exclude<EmailStep, null | "error">; label: string }[] = [
  { key: "validating", label: "Validating recipient..." },
  { key: "connecting", label: "Connecting to email service..." },
  { key: "sending", label: "Sending email..." },
  { key: "done", label: "Email queued for delivery" },
];

function stepIndex(step: EmailStep): number {
  if (step === "validating") return 0;
  if (step === "connecting") return 1;
  if (step === "sending") return 2;
  if (step === "done") return 3;
  if (step === "error") return -1;
  return -1;
}

export function EmailProgress({
  step,
  recipientEmail,
  logs,
  error,
  onClose,
  onRetry,
}: EmailProgressProps) {
  if (!step) return null;

  const currentIdx = stepIndex(step);
  const isError = step === "error";
  const isDone = step === "done";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-background rounded-lg shadow-lg w-[440px] overflow-hidden"
      >
        {/* Header */}
        <div className={`px-6 pt-5 pb-3 ${isDone ? "bg-green-50 dark:bg-green-950/20" : isError ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
          <h3 className="text-lg font-semibold">
            {isDone ? "Email Sent Successfully" : isError ? "Email Failed" : "Sending Email..."}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {recipientEmail}
          </p>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 space-y-2.5" aria-live="polite">
          {STEPS.map((s, idx) => {
            const isActive = idx === currentIdx;
            const isComplete = idx < currentIdx || (idx === currentIdx && isDone);
            const isFailed = isError && idx === Math.max(currentIdx, 0);

            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 text-sm ${
                  isActive && !isDone
                    ? "text-foreground font-medium"
                    : isComplete
                    ? "text-muted-foreground"
                    : isFailed
                    ? "text-red-500 font-medium"
                    : "text-muted-foreground/40"
                }`}
              >
                <div className="shrink-0 size-5">
                  {isFailed ? (
                    <ErrorX />
                  ) : isActive && !isDone ? (
                    <Spinner />
                  ) : isComplete ? (
                    <Checkmark />
                  ) : (
                    <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <span>{isFailed ? (error ?? "Failed to send email") : s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Terminal log */}
        <div className="mx-6 mb-4 rounded-md bg-zinc-950 border border-zinc-800 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <div className="size-2.5 rounded-full bg-red-500/80" />
            <div className="size-2.5 rounded-full bg-yellow-500/80" />
            <div className="size-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 text-[10px] text-zinc-500 font-mono">email-service</span>
          </div>
          <div className="p-3 max-h-40 overflow-y-auto font-mono text-xs leading-relaxed">
            <AnimatePresence initial={false}>
              {logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`${
                    log.status === "error"
                      ? "text-red-400"
                      : log.status === "ok"
                      ? "text-green-400"
                      : "text-zinc-400"
                  }`}
                >
                  <span className="text-zinc-600">[{log.timestamp}]</span>{" "}
                  {log.message}
                </motion.div>
              ))}
            </AnimatePresence>
            {!isDone && !isError && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="inline-block text-zinc-500"
              >
                _
              </motion.span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex justify-end gap-2">
          {isError && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="size-3.5 mr-1.5" />
              Retry
            </Button>
          )}
          {(isDone || isError) && (
            <Button size="sm" onClick={onClose}>
              {isDone ? "Done" : "Close"}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
