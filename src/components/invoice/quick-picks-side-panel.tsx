"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/formatters";
import { getQuickPickResources } from "./hooks/quick-pick-resource-cache";

interface QuickPick {
  id: string;
  description: string;
  defaultPrice: number;
  department: string;
  usageCount: number;
}

interface UserPick {
  id: string;
  description: string;
  unitPrice: number;
  department: string;
  usageCount: number;
  isCurrentDept: boolean;
}

interface QuickPicksSidePanelProps {
  department: string;
  currentSubtotal: number;
  onSelect: (description: string, price: number) => void;
}

export function QuickPicksSidePanel({
  department,
  currentSubtotal,
  onSelect,
}: QuickPicksSidePanelProps) {
  const [globalPicks, setGlobalPicks] = useState<QuickPick[]>([]);
  const [userPicks, setUserPicks] = useState<UserPick[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    getQuickPickResources(department, { includeSavedItems: false })
      .then(({ quickPicks, userPicks: nextUserPicks }) => {
        if (cancelled) return;
        setGlobalPicks(quickPicks);
        setUserPicks(nextUserPicks);
      })
      .catch(() => {
        if (cancelled) return;
        setGlobalPicks([]);
        setUserPicks([]);
      });

    return () => { cancelled = true; };
  }, [department]);

  function getPrice(pick: QuickPick): number {
    if (pick.description.includes("State Tax")) {
      return Math.round(currentSubtotal * 0.095 * 100) / 100;
    }
    return Number(pick.defaultPrice);
  }

  const lower = filter.toLowerCase();
  const filteredGlobal = globalPicks.filter((p) =>
    !lower || p.description.toLowerCase().includes(lower)
  );
  const deptPicks = userPicks.filter((p) => p.isCurrentDept && (!lower || p.description.toLowerCase().includes(lower)));
  const otherPicks = userPicks.filter((p) => !p.isCurrentDept && (!lower || p.description.toLowerCase().includes(lower)));

  const hasContent = filteredGlobal.length > 0 || deptPicks.length > 0 || otherPicks.length > 0;

  return (
    <div className="flex w-full flex-col border-t border-border/60 pt-3 lg:max-h-[500px] lg:w-[160px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pl-3 lg:pt-0">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter picks…"
        className="mb-2 h-8 text-xs lg:h-7 lg:text-[10px]"
        tabIndex={-1}
      />

      <div className="flex-1 overflow-y-auto space-y-1">
        {!hasContent && (
          <p className="text-[10px] text-muted-foreground">No picks available</p>
        )}

        {filteredGlobal.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide pt-1 pb-0.5">Standard</p>
            {filteredGlobal.map((pick) => (
              <button
                key={pick.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(pick.description, getPrice(pick))}
                className="w-full text-left px-2 py-1.5 text-[10px] bg-muted rounded-md hover:bg-muted/80 transition-colors truncate"
                title={`${pick.description} — ${formatAmount(getPrice(pick))}`}
              >
                {pick.description}
              </button>
            ))}
          </>
        )}

        {deptPicks.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide pt-2 pb-0.5">
              My Picks · {department}
            </p>
            {deptPicks.map((pick) => (
              <button
                key={pick.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(pick.description, pick.unitPrice)}
                className="w-full text-left px-2 py-1.5 text-[10px] border border-border rounded-md hover:bg-muted/50 transition-colors truncate"
                title={`${pick.description} — ${formatAmount(pick.unitPrice)}`}
              >
                {pick.description}
              </button>
            ))}
          </>
        )}

        {otherPicks.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide pt-2 pb-0.5">
              My Picks · Other
            </p>
            {otherPicks.map((pick) => (
              <button
                key={pick.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(pick.description, pick.unitPrice)}
                className="w-full text-left px-2 py-1.5 text-[10px] border border-dashed border-border/60 text-muted-foreground rounded-md hover:bg-muted/50 transition-colors truncate"
                title={`${pick.description} — ${formatAmount(pick.unitPrice)}`}
              >
                {pick.description}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
