"use client";

import { AlertTriangleIcon, ChevronRightIcon, XIcon } from "lucide-react";
import type { BlockerEntry, SectionAnchor } from "../types";

interface Props {
  blockers: BlockerEntry[];
  onClose: () => void;
  onJump: (anchor: SectionAnchor) => void;
}

export function BlockerSummary({ blockers, onClose, onJump }: Props) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/[0.05] p-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2 text-destructive font-semibold">
          <AlertTriangleIcon className="size-4" />
          Cannot generate PDF — {blockers.length} issue(s) to resolve
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="size-4" /></button>
      </div>
      <ul className="space-y-1">
        {blockers.map((b) => (
          <li key={b.field}>
            <button type="button" onClick={() => onJump(b.anchor)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-destructive hover:bg-destructive/[0.06]">
              <span className="text-[13px] underline decoration-dotted">{b.label}</span>
              <ChevronRightIcon className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
