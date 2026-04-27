"use client";

import { CheckIcon, CircleDashedIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistEntry, SectionAnchor } from "../types";

interface Props {
  checklist: ChecklistEntry[];
  onJump: (anchor: SectionAnchor) => void;
}

export function ChecklistCard({ checklist, onJump }: Props) {
  const done = checklist.filter((c) => c.complete).length;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Checklist · {done}/{checklist.length}</p>
      </div>
      <ul className="space-y-1">
        {checklist.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onJump(c.anchor)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
              <span className="size-4 shrink-0 inline-flex items-center justify-center">
                {c.complete ? <CheckIcon className="size-4 text-positive" /> : c.blocker ? <XIcon className="size-4 text-destructive" /> : <CircleDashedIcon className="size-4 text-muted-foreground" />}
              </span>
              <span className={cn("text-[12.5px] flex-1", c.complete && "line-through text-muted-foreground", c.blocker && "text-destructive font-semibold")}>
                {c.label}
              </span>
              {!c.complete && <ChevronRightIcon className="size-3.5 text-muted-foreground/60" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
