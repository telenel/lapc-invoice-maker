"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { CalendarEvent } from "@/domains/calendar/api-client";

function getEmoji(event: CalendarEvent): string {
  if (event.source === "catering") return "\u{1F37D}";
  if (event.source === "birthday") return "\u{1F382}";
  const type = event.extendedProps.type;
  if (type === "MEETING") return "\u{1F4C5}";
  if (type === "SEMINAR") return "\u{1F393}";
  if (type === "VENDOR") return "\u{1F69A}";
  return "\u{1F4CC}";
}

function getLink(event: CalendarEvent): string {
  if (event.source === "catering" && event.extendedProps.quoteId) {
    return `/quotes/${event.extendedProps.quoteId}`;
  }
  return "/calendar";
}

export function TodaysEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    let cancelled = false;

    void import("@/domains/calendar/api-client")
      .then(({ calendarApi }) => calendarApi.getEvents(today, tomorrowStr))
      .then((data) => {
        if (!cancelled) {
          setEvents(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch events:", err);
        void import("sonner")
          .then(({ toast }) => {
            toast.error("Failed to load events");
          })
          .catch(() => {});
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="card-hover">
        <CardContent className="py-3 px-4">
          <div className="skeleton h-3 w-28 mb-3" />
          <div className="skeleton h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Today&apos;s Events
            </span>
            {events.length > 0 && (
              <span
                className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full"
                style={{ backgroundColor: events[0]?.borderColor ?? "#f97316" }}
              >
                {events.length}
              </span>
            )}
          </div>
          <Link
            href="/calendar"
            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Calendar →
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No events today
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event, i) => (
              <div
                key={event.id}
                className="event-slide-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
              <Link
                href={getLink(event)}
                className="block rounded-lg p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  borderWidth: "1px",
                  borderColor: `${event.borderColor}33`,
                  backgroundColor: event.color,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">
                    {getEmoji(event)} {event.title}
                  </span>
                  {!event.allDay && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: event.borderColor }}
                    >
                      {new Date(event.start).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {event.extendedProps.location && (
                    <span>{"\u{1F4CD}"} {event.extendedProps.location}</span>
                  )}
                  {event.extendedProps.headcount && (
                    <span>{"\u{1F465}"} {event.extendedProps.headcount}</span>
                  )}
                </div>
                {event.source === "catering" &&
                  (event.extendedProps.setupTime || event.extendedProps.takedownTime) && (
                    <div className="flex gap-1.5 mt-1.5">
                      {event.extendedProps.setupTime && (
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                          Setup {event.extendedProps.setupTime}
                        </span>
                      )}
                      {event.extendedProps.takedownTime && (
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                          Takedown {event.extendedProps.takedownTime}
                        </span>
                      )}
                    </div>
                  )}
              </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
