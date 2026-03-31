"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/components/calendar/event-detail-sidebar";

/* ---------- helpers (mirrored from event-detail-sidebar) ---------- */

const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  MEETING: { color: "#3b82f6", icon: "\u{1F4CB}", label: "Meeting" },
  SEMINAR: { color: "#8b5cf6", icon: "\u{1F393}", label: "Seminar" },
  VENDOR: { color: "#14b8a6", icon: "\u{1F3E2}", label: "Vendor" },
  OTHER: { color: "#6b7280", icon: "\u{1F4CC}", label: "Event" },
  catering: { color: "#f97316", icon: "\u{1F37D}\uFE0F", label: "Catering" },
  birthday: { color: "#ec4899", icon: "\u{1F382}", label: "Birthday" },
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

function parseDateLocal(value: string): Date {
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyPattern.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function formatEventDateTime(start: string, end?: string | null, allDay?: boolean): string {
  const startDate = parseDateLocal(start);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (allDay) return `${dateStr} \u00B7 All Day`;
  const startTime = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!end) return `${dateStr} \u00B7 ${startTime}`;
  const endDate = parseDateLocal(end);
  const endTime = endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} \u00B7 ${startTime} \u2013 ${endTime}`;
}

function formatTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getTypeConfig(event: CalendarEvent): { color: string; icon: string; label: string } {
  if (event.source === "catering") return TYPE_CONFIG.catering;
  if (event.source === "birthday") return TYPE_CONFIG.birthday;
  const key = event.type ?? "OTHER";
  return TYPE_CONFIG[key] ?? TYPE_CONFIG.OTHER;
}

/* ---------- sub-components ---------- */

function QuoteStatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    DECLINED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    EXPIRED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };
  const colorClass = statusColors[status] ?? statusColors.DRAFT;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {QUOTE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DetailRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-sm leading-none">{icon}</span>
      <span className="text-sm text-foreground leading-snug">{children}</span>
    </div>
  );
}

/* ---------- main component ---------- */

interface MobileEventSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onEditEvent?: (eventId: string) => void;
}

export function MobileEventSheet({ event, open, onClose, onEditEvent }: MobileEventSheetProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const cfg = event ? getTypeConfig(event) : null;

  return (
    <AnimatePresence>
      {open && event && cfg && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet-content"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card shadow-lg"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Colored top border */}
            <div className="h-1 w-full" style={{ background: cfg.color }} />

            {/* Header */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="size-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: cfg.color }}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                  {event.source === "catering" && event.quoteStatus && (
                    <QuoteStatusBadge status={event.quoteStatus} />
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Close event details"
                >
                  <X className="size-4" />
                </button>
              </div>
              <h3 className="text-base font-bold leading-tight">{event.title}</h3>
            </div>

            {/* Details */}
            <div className="px-4 pb-3 space-y-2.5">
              <DetailRow icon="\u{1F4C5}">
                {formatEventDateTime(event.start, event.end, event.allDay)}
              </DetailRow>
              {event.location && <DetailRow icon="\u{1F4CD}">{event.location}</DetailRow>}
              {event.headcount != null && (
                <DetailRow icon="\u{1F465}">{event.headcount} guests</DetailRow>
              )}
              {event.quoteNumber && (
                <DetailRow icon="\u{1F4B0}">
                  {event.quoteNumber}
                  {event.totalAmount != null ? ` \u00B7 ${formatCurrency(event.totalAmount)}` : ""}
                </DetailRow>
              )}
              {event.setupTime && (
                <DetailRow icon="\u{1F550}">Setup: {formatTime(event.setupTime)}</DetailRow>
              )}
              {event.takedownTime && (
                <DetailRow icon="\u{1F550}">Takedown: {formatTime(event.takedownTime)}</DetailRow>
              )}
              {event.department && <DetailRow icon="\u{1F3E2}">{event.department}</DetailRow>}
              {event.description && (
                <div className="mt-3 rounded-md bg-muted/60 px-3 py-2.5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <SheetActions event={event} typeColor={cfg.color} onEditEvent={onEditEvent} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetActions({
  event,
  typeColor,
  onEditEvent,
}: {
  event: CalendarEvent;
  typeColor: string;
  onEditEvent?: (eventId: string) => void;
}) {
  if (event.source === "catering" && event.quoteId) {
    return (
      <Link href={`/quotes/${event.quoteId}`} className="block">
        <Button
          className="w-full"
          style={{ backgroundColor: typeColor, color: "#fff", borderColor: typeColor }}
        >
          View Quote
        </Button>
      </Link>
    );
  }

  if (event.source === "manual" && event.eventId) {
    return (
      <Button
        className="w-full"
        style={{ backgroundColor: typeColor, color: "#fff", borderColor: typeColor }}
        onClick={() => onEditEvent?.(event.eventId!)}
      >
        Edit Event
      </Button>
    );
  }

  if (event.source === "birthday" && event.staffId) {
    return (
      <Link href={`/staff/${event.staffId}`} className="block">
        <Button
          className="w-full"
          style={{ backgroundColor: typeColor, color: "#fff", borderColor: typeColor }}
        >
          View Staff
        </Button>
      </Link>
    );
  }

  return null;
}
