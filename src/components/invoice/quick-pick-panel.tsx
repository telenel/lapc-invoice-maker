"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface QuickPick {
  id: string;
  description: string;
  price: number;
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
}

export function QuickPickPanel({ department, onSelect }: QuickPickPanelProps) {
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

    return () => {
      cancelled = true;
    };
  }, [department]);

  const hasPicks = picks.length > 0;
  const hasSaved = savedItems.length > 0;

  if (!department || (!hasPicks && !hasSaved)) return null;

  return (
    <div className="space-y-3">
      {hasPicks && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Quick Picks for {department}
          </Label>
          <div className="flex flex-wrap gap-2">
            {picks.map((pick) => (
              <Button
                key={pick.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelect(pick.description, pick.price)}
                className="flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pick.description} — ${Number(pick.price).toFixed(2)}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {pick.usageCount}
                </Badge>
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
                {item.description} — ${Number(item.unitPrice).toFixed(2)}
                <Badge variant="outline" className="ml-1 text-xs">
                  {item.usageCount}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
