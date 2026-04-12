"use client";

import { Pin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MiniMonth } from "@/components/calendar/mini-month";
import { formatLosAngelesDateTimeRange, formatWallClockTime } from "@/lib/time";

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
  /** Event to display (hover preview or pinned) */
  event: CalendarEvent | null;
  /** Whether the current event is pinned (click-selected) */
  pinned: boolean;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  onUnpin?: () => void;
  /** Mini month props */
  displayMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick: (dateStr: string) => void;
  activeRange?: { start: string; end: string };
  /** Slot for the Add Event trigger (rendered at bottom of default state) */
  addEventTrigger?: React.ReactNode;
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
  return formatLosAngelesDateTimeRange(start, end, allDay);
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

function EventDetails({ event }: { event: CalendarEvent }) {
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
        <DetailRow icon="🕐">Setup: {formatWallClockTime(event.setupTime)}</DetailRow>
      )}
      {event.takedownTime && (
        <DetailRow icon="🕐">Takedown: {formatWallClockTime(event.takedownTime)}</DetailRow>
      )}
      {event.department && <DetailRow icon="🏢">{event.department}</DetailRow>}
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

function EventActions({
  event,
  typeColor,
  onEditEvent,
  onDeleteEvent,
}: {
  event: CalendarEvent;
  typeColor: string;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
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
        {onDeleteEvent && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onDeleteEvent(event.eventId!)}
          >
            Delete
          </Button>
        )}
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

const LEGEND = (["MEETING", "SEMINAR", "VENDOR", "OTHER", "catering", "birthday"] as const).map(
  (key) => TYPE_CONFIG[key],
);

function EventDetailContent({
  event,
  pinned,
  onUnpin,
  onEditEvent,
  onDeleteEvent,
}: {
  event: CalendarEvent;
  pinned: boolean;
  onUnpin?: () => void;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
}) {
  const cfg = getTypeConfig(event);
  return (
    <>
      {/* Colored top border */}
      <div className="h-1 w-full shrink-0" style={{ background: cfg.color }} />

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="size-2 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
            {event.source === "catering" && event.quoteStatus && (
              <QuoteStatusBadge status={event.quoteStatus} />
            )}
          </div>
          {pinned && (
            <button
              onClick={onUnpin}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Unpin event"
              aria-label="Unpin event"
            >
              <Pin className="size-3.5 fill-current" />
            </button>
          )}
        </div>
        <h3 className="text-base font-bold leading-tight">{event.title}</h3>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <EventDetails event={event} />
      </div>

      {/* Action buttons */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <EventActions event={event} typeColor={cfg.color} onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent} />
      </div>

      {/* Hint */}
      <div className="text-center pb-2">
        <span className="text-[10px] text-muted-foreground">
          {pinned ? "Click event to unpin" : "Click to pin · Hover to preview"}
        </span>
      </div>
    </>
  );
}

export function EventDetailSidebar({
  event,
  pinned,
  onEditEvent,
  onDeleteEvent,
  onUnpin,
  displayMonth,
  onMonthChange,
  onDateClick,
  activeRange,
  addEventTrigger,
}: EventDetailSidebarProps) {
  const showEvent = event !== null;

  return (
    <div data-calendar-sidebar className="relative flex min-h-[20rem] w-full shrink-0 flex-col overflow-hidden border-b border-border bg-card lg:h-full lg:w-[260px] lg:border-r lg:border-b-0">
      {/* Default state — always mounted, toggled via opacity */}
      <div
        className="absolute inset-0 flex flex-col h-full p-4 gap-4 transition-opacity duration-150"
        style={{ opacity: showEvent ? 0 : 1, pointerEvents: showEvent ? "none" : "auto" }}
        aria-hidden={showEvent || undefined}
        ref={(el) => {
          if (el) {
            if (showEvent) el.setAttribute("inert", "");
            else el.removeAttribute("inert");
          }
        }}
      >
        {/* Add Event button */}
        {addEventTrigger && (
          <div>{addEventTrigger}</div>
        )}

        {/* Mini month calendar */}
        <MiniMonth
          displayMonth={displayMonth}
          onMonthChange={onMonthChange}
          onDateClick={onDateClick}
          activeRange={activeRange}
        />

        {/* Legend */}
        <div className="border-t border-border pt-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Legend
          </div>
          <div className="flex flex-col gap-1.5">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: item.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.icon} {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event detail state — always mounted, toggled via opacity */}
      <div
        className="absolute inset-0 flex flex-col h-full overflow-hidden transition-opacity duration-150"
        style={{ opacity: showEvent ? 1 : 0, pointerEvents: showEvent ? "auto" : "none" }}
        aria-hidden={!showEvent || undefined}
        ref={(el) => {
          if (el) {
            if (!showEvent) el.setAttribute("inert", "");
            else el.removeAttribute("inert");
          }
        }}
      >
            {event != null && (
              <EventDetailContent
                event={event}
                pinned={pinned}
                onUnpin={onUnpin}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
              />
            )}
      </div>
    </div>
  );
}
