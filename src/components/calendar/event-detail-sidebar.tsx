"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  source: "catering" | "manual" | "birthday";
  type?: string;
  location?: string | null;
  description?: string | null;
  eventId?: string;
  quoteId?: string;
  quoteStatus?: string;
  quoteNumber?: string;
  totalAmount?: number;
  headcount?: number;
  setupTime?: string;
  takedownTime?: string;
  staffId?: string;
  department?: string;
}

interface EventDetailSidebarProps {
  event: CalendarEvent | null;
  onEditEvent?: (eventId: string) => void;
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  MEETING: { color: "#3b82f6", icon: "📋", label: "Meeting" },
  SEMINAR: { color: "#8b5cf6", icon: "🎓", label: "Seminar" },
  VENDOR: { color: "#14b8a6", icon: "🏢", label: "Vendor" },
  OTHER: { color: "#6b7280", icon: "📌", label: "Event" },
  catering: { color: "#f97316", icon: "🍽️", label: "Catering" },
  birthday: { color: "#ec4899", icon: "🎂", label: "Birthday" },
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

function formatEventDateTime(
  start: string,
  end?: string | null,
  allDay?: boolean,
): string {
  const startDate = new Date(start);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (allDay) return `${dateStr} · All Day`;
  const startTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end) return `${dateStr} · ${startTime}`;
  const endTime = new Date(end).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${startTime} – ${endTime}`;
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

function CateringDetails({ event }: { event: CalendarEvent }) {
  return (
    <div className="space-y-2.5">
      <DetailRow icon="📅">
        {formatEventDateTime(event.start, event.end, event.allDay)}
      </DetailRow>
      {event.location && <DetailRow icon="📍">{event.location}</DetailRow>}
      {event.headcount != null && (
        <DetailRow icon="👥">{event.headcount} guests</DetailRow>
      )}
      {event.quoteNumber && (
        <DetailRow icon="💰">
          {event.quoteNumber}
          {event.totalAmount != null ? ` · ${formatCurrency(event.totalAmount)}` : ""}
        </DetailRow>
      )}
      {event.setupTime && (
        <DetailRow icon="🕐">Setup: {formatTime(event.setupTime)}</DetailRow>
      )}
      {event.takedownTime && (
        <DetailRow icon="🕐">Takedown: {formatTime(event.takedownTime)}</DetailRow>
      )}
    </div>
  );
}

function ManualDetails({ event }: { event: CalendarEvent }) {
  return (
    <div className="space-y-2.5">
      <DetailRow icon="📅">
        {formatEventDateTime(event.start, event.end, event.allDay)}
      </DetailRow>
      {event.location && <DetailRow icon="📍">{event.location}</DetailRow>}
      {event.description && (
        <div className="mt-3 rounded-md bg-muted/60 px-3 py-2.5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {event.description}
          </p>
        </div>
      )}
    </div>
  );
}

function BirthdayDetails({ event }: { event: CalendarEvent }) {
  return (
    <div className="space-y-2.5">
      <DetailRow icon="📅">
        {formatEventDateTime(event.start, event.end, event.allDay)}
      </DetailRow>
      {event.department && (
        <DetailRow icon="🏢">{event.department}</DetailRow>
      )}
    </div>
  );
}

function EventActions({
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
      <div className="flex gap-2">
        <Button
          className="flex-1"
          style={{ backgroundColor: typeColor, color: "#fff", borderColor: typeColor }}
          onClick={() => onEditEvent?.(event.eventId!)}
        >
          Edit Event
        </Button>
        <Button variant="outline" className="flex-1">
          Delete
        </Button>
      </div>
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

export function EventDetailSidebar({ event, onEditEvent }: EventDetailSidebarProps) {
  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      <AnimatePresence mode="wait">
        {event === null ? (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <CalendarDays className="size-10 text-muted-foreground" />
            </motion.div>
            <p className="text-sm text-muted-foreground">
              Hover over an event to see details
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Colored top border */}
            {(() => {
              const cfg = getTypeConfig(event);
              return (
                <>
                  <div
                    className="h-1 w-full shrink-0"
                    style={{ background: cfg.color }}
                  />

                  {/* Header */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div
                        className="size-2 rounded-full shrink-0"
                        style={{ background: cfg.color }}
                      />
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
                    <h3 className="text-lg font-bold leading-tight">{event.title}</h3>
                  </div>

                  {/* Details */}
                  <div className="flex-1 overflow-y-auto px-5 pb-4">
                    {event.source === "catering" && <CateringDetails event={event} />}
                    {event.source === "manual" && <ManualDetails event={event} />}
                    {event.source === "birthday" && <BirthdayDetails event={event} />}
                  </div>

                  {/* Action buttons */}
                  <div className="shrink-0 border-t border-border px-5 py-4">
                    <EventActions
                      event={event}
                      typeColor={cfg.color}
                      onEditEvent={onEditEvent}
                    />
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
