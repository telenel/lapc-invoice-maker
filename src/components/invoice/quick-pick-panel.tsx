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

interface QuickPickPanelProps {
  department: string;
  onSelect: (description: string, price: number) => void;
}

export function QuickPickPanel({ department, onSelect }: QuickPickPanelProps) {
  const [picks, setPicks] = useState<QuickPick[]>([]);

  useEffect(() => {
    if (!department) {
      setPicks([]);
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

    return () => {
      cancelled = true;
    };
  }, [department]);

  if (!department || picks.length === 0) return null;

  return (
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
            className="flex items-center gap-1"
          >
            {pick.description} — ${pick.price.toFixed(2)}
            <Badge variant="secondary" className="ml-1 text-xs">
              {pick.usageCount}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}
