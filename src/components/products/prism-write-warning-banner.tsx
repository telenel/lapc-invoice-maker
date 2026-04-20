"use client";

import { AlertTriangleIcon } from "lucide-react";

interface PrismWriteWarningBannerProps {
  title?: string;
  messages: string[];
}

export function PrismWriteWarningBanner({
  title = "Prism writes require explicit confirmation",
  messages,
}: PrismWriteWarningBannerProps) {
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
        <div className="space-y-2">
          <p className="font-semibold">{title}</p>
          <ul className="list-disc space-y-1 pl-5 text-rose-900/90 dark:text-rose-100/90">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
