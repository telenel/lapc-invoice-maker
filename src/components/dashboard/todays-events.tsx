"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardBootstrapData } from "./dashboard-bootstrap-provider";
import { LOS_ANGELES_TIME_ZONE } from "@/lib/date-utils";
import { calendarApi, type CalendarEvent } from "@/domains/calendar/api-client";
import { formatLosAngelesTime, formatWallClockTime } from "@/lib/time";

type TodaysEventsCacheEntry = {
  startDateKey: string;
  endDateKey: string;
  events: CalendarEvent[] | null;
  promise: Promise<CalendarEvent[]> | null;
};

// The dashboard preview swaps to the sortable stack after hydration, which would
// otherwise remount this widget and replay its loading state.
let todaysEventsCache: TodaysEventsCacheEntry | null = null;

function getDateKeyInLosAngeles(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LOS_ANGELES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive Los Angeles date key");
  }

  return `${year}-${month}-${day}`;
}

function getTodaysEventsWindow(now = new Date()) {
  return {
    startDateKey: getDateKeyInLosAngeles(now),
    endDateKey: getDateKeyInLosAngeles(
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
    ),
  };
}

function getCachedTodaysEvents(now = new Date()) {
  const { startDateKey, endDateKey } = getTodaysEventsWindow(now);

  if (
    todaysEventsCache?.startDateKey === startDateKey &&
    todaysEventsCache?.endDateKey === endDateKey
  ) {
    return todaysEventsCache;
  }

  return null;
}

async function loadTodaysEvents(now = new Date()) {
  const cached = getCachedTodaysEvents(now);
  if (cached?.events !== null && cached?.events !== undefined) {
    return cached.events;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const { startDateKey, endDateKey } = getTodaysEventsWindow(now);
  const promise = calendarApi
    .getEvents(startDateKey, endDateKey)
    .then((events) => {
      if (
        todaysEventsCache?.startDateKey === startDateKey &&
        todaysEventsCache?.endDateKey === endDateKey
      ) {
        todaysEventsCache = {
          startDateKey,
          endDateKey,
          events,
          promise: null,
        };
      }
      return events;
    })
    .catch((error) => {
      if (
        todaysEventsCache?.startDateKey === startDateKey &&
        todaysEventsCache?.endDateKey === endDateKey
      ) {
        todaysEventsCache = null;
      }
      throw error;
    });

  todaysEventsCache = {
    startDateKey,
    endDateKey,
    events: null,
    promise,
  };

  return promise;
}

export function __resetTodaysEventsCacheForTests() {
  todaysEventsCache = null;
}

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
  const dashboardBootstrap = useDashboardBootstrapData();
  const initialEvents = dashboardBootstrap?.todaysEvents ?? null;
  const cachedEvents = initialEvents ?? getCachedTodaysEvents()?.events ?? null;
  const [events, setEvents] = useState<CalendarEvent[]>(() => cachedEvents ?? []);
  const [loading, setLoading] = useState(() => cachedEvents === null);
  const [animateEntries] = useState(() => cachedEvents === null);

  useEffect(() => {
    if (initialEvents === null) {
      return;
    }

    const { startDateKey, endDateKey } = getTodaysEventsWindow();
    todaysEventsCache = {
      startDateKey,
      endDateKey,
      events: initialEvents,
      promise: null,
    };
  }, [initialEvents]);

  useEffect(() => {
    if (cachedEvents !== null) {
      return;
    }
    let cancelled = false;

    void loadTodaysEvents()
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
  }, [cachedEvents]);

  if (loading) {
    return (
      <Card className="card-hover" data-widget-root="todays-events">
        <CardContent className="py-3 px-4">
          <div className="skeleton h-3 w-28 mb-3" />
          <div className="skeleton h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover" data-widget-root="todays-events">
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
                className={animateEntries ? "event-slide-in" : undefined}
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
                        {formatLosAngelesTime(event.start)}
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
                            Setup {formatWallClockTime(event.extendedProps.setupTime)}
                          </span>
                        )}
                        {event.extendedProps.takedownTime && (
                          <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                            Takedown {formatWallClockTime(event.extendedProps.takedownTime)}
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
