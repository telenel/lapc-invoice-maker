"use client";

import { CheckCircleIcon, RefreshCwIcon, DotIcon } from "lucide-react";

interface Props { isDirty: boolean; savingDraft: boolean; lastSavedAt: number | null; }

function rel(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "moments ago";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function DraftStateCard({ isDirty, savingDraft, lastSavedAt }: Props) {
  if (savingDraft) {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[12.5px] text-info">
      <RefreshCwIcon className="size-3.5 animate-spin" /> Saving…
    </div>;
  }
  if (isDirty) {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[12.5px] text-warn">
      <DotIcon className="size-4 animate-pulse" /> Unsaved changes
    </div>;
  }
  if (lastSavedAt) {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[12.5px] text-positive">
      <CheckCircleIcon className="size-3.5" /> Saved · {rel(lastSavedAt)}
    </div>;
  }
  return null;
}
