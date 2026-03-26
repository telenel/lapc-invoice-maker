"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface QuickPick {
  id: string;
  department: string;
  description: string;
  defaultPrice: number;
  usageCount: number;
}

interface SavedItem {
  id: string;
  description: string;
  unitPrice: number;
  usageCount: number;
}

interface QuickPickPanelProps {
  department: string;
  onSelect: (description: string, price: number) => void;
  currentSubtotal: number;
}

export function QuickPickPanel({ department, onSelect, currentSubtotal }: QuickPickPanelProps) {
  const [picks, setPicks] = useState<QuickPick[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    if (!department) {
      setPicks([]);
      setSavedItems([]);
      return;
    }

    let cancelled = false;

    fetch(`/api/quick-picks?department=${encodeURIComponent(department)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: QuickPick[]) => {
        if (!cancelled) setPicks(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPicks([]);
      });

    fetch(`/api/saved-items?department=${encodeURIComponent(department)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SavedItem[]) => {
        if (!cancelled) setSavedItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSavedItems([]);
      });

    return () => { cancelled = true; };
  }, [department]);

  const globalPicks = picks.filter((p) => p.department === "__ALL__");
  const deptPicks = picks.filter((p) => p.department !== "__ALL__");
  const hasDept = deptPicks.length > 0;
  const hasSaved = savedItems.length > 0;
  const hasGlobal = globalPicks.length > 0;

  if (!department && !hasGlobal) return null;
  if (!hasGlobal && !hasDept && !hasSaved) return null;

  function handlePickClick(pick: QuickPick) {
    if (pick.description.includes("State Tax")) {
      const taxAmount = Math.round(currentSubtotal * 0.095 * 100) / 100;
      onSelect(pick.description, taxAmount);
    } else {
      onSelect(pick.description, Number(pick.defaultPrice));
    }
  }

  function formatPickLabel(pick: QuickPick): string {
    if (pick.description.includes("State Tax")) {
      const taxAmount = Math.round(currentSubtotal * 0.095 * 100) / 100;
      return `${pick.description} — $${taxAmount.toFixed(2)}`;
    }
    if (Number(pick.defaultPrice) === 0) {
      return pick.description;
    }
    return `${pick.description} — $${Number(pick.defaultPrice).toFixed(2)}`;
  }

  return (
    <div className="space-y-3">
      {hasGlobal && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Fees & Tax</Label>
          <div className="flex flex-wrap gap-2">
            {globalPicks.map((pick) => (
              <Button
                key={pick.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePickClick(pick)}
                className="flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {formatPickLabel(pick)}
                {pick.usageCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {pick.usageCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {hasDept && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Quick Picks for {department}
          </Label>
          <div className="flex flex-wrap gap-2">
            {deptPicks.map((pick) => (
              <Button
                key={pick.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePickClick(pick)}
                className="flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {formatPickLabel(pick)}
                {pick.usageCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {pick.usageCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {hasSaved && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Saved Items</Label>
          <div className="flex flex-wrap gap-2">
            {savedItems.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSelect(item.description, item.unitPrice)}
                className="flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.description} — <span className="tabular-nums">${Number(item.unitPrice).toFixed(2)}</span>
                {item.usageCount > 0 && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {item.usageCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
