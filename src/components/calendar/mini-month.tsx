"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MiniMonthProps {
  /** The month to display */
  displayMonth: Date;
  /** Called when user clicks prev/next month arrows */
  onMonthChange: (date: Date) => void;
  /** Called when user clicks a date */
  onDateClick: (dateStr: string) => void;
  /** Currently highlighted date range (start inclusive, end exclusive) */
  activeRange?: { start: string; end: string };
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function MiniMonth({
  displayMonth,
  onMonthChange,
  onDateClick,
  activeRange,
}: MiniMonthProps) {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { day: number; dateStr: string; inMonth: boolean }[] = [];

    // Previous month fill
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({
        day: d,
        dateStr: `${prevYear}-${pad(prevMonth + 1)}-${pad(d)}`,
        inMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        dateStr: `${year}-${pad(month + 1)}-${pad(d)}`,
        inMonth: true,
      });
    }

    // Next month fill
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      for (let d = 1; d <= remaining; d++) {
        cells.push({
          day: d,
          dateStr: `${nextYear}-${pad(nextMonth + 1)}-${pad(d)}`,
          inMonth: false,
        });
      }
    }

    // Group into weeks
    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function isInRange(dateStr: string): boolean {
    if (!activeRange) return false;
    return dateStr >= activeRange.start && dateStr < activeRange.end;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{monthLabel}</span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            className="text-[10px] font-medium text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Date grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 text-center">
          {week.map((cell) => {
            const isToday = cell.dateStr === today;
            const inRange = isInRange(cell.dateStr);
            return (
              <button
                key={cell.dateStr}
                onClick={() => onDateClick(cell.dateStr)}
                className={cn(
                  "h-7 w-7 mx-auto text-[11px] rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  !cell.inMonth && "text-muted-foreground/40",
                  cell.inMonth && !isToday && !inRange && "text-foreground",
                  inRange && !isToday && "bg-primary/10 text-primary",
                  isToday &&
                    "bg-primary text-primary-foreground font-bold",
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
