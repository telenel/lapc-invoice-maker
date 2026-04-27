"use client";

import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  savedAt: number;
  itemCount: number;
  total: number;
  onResume: () => void;
  onDiscard: () => void;
}

function rel(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "moments ago";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function DraftRestoreBanner({ savedAt, itemCount, total, onResume, onDiscard }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-info-border bg-info-bg p-3 animate-in slide-in-from-top-2 duration-300">
      <InfoIcon className="size-4 text-info shrink-0" />
      <p className="text-[13px] flex-1">
        Draft from <strong>{rel(savedAt)}</strong> · {itemCount} line items · {fmt(total)}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button>
        <Button size="sm" onClick={onResume}>Restore Draft</Button>
      </div>
    </div>
  );
}
