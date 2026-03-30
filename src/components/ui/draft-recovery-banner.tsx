"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "lucide-react";

interface DraftRecoveryBannerProps {
  savedAt: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({ savedAt, onResume, onDiscard }: DraftRecoveryBannerProps) {
  const timeAgo = getRelativeTime(savedAt);

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
      <AlertTriangleIcon className="size-5 text-amber-600 shrink-0" />
      <p className="text-sm flex-1">
        You have an unsaved draft from <strong>{timeAgo}</strong>.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" onClick={onResume}>
          Resume
        </Button>
      </div>
    </div>
  );
}

function getRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "a few seconds ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}
