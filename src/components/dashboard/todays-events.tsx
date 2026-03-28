"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { calendarApi, type CalendarEvent } from "@/domains/calendar/api-client";

export function TodaysEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    calendarApi
      .getEvents(today, today)
      .then(setEvents)
      .catch((err) => console.error("Failed to fetch events:", err))
      .finally(() => setLoading(false));
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
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-orange-500 rounded-full">
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
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/quotes/${event.quoteId}`}
                className="block border border-orange-500/20 rounded-lg p-2.5 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">🍽 {event.title}</span>
                  <span className="text-xs font-semibold text-orange-500">
                    {new Date(event.start).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {event.location && <span>📍 {event.location}</span>}
                  {event.headcount && <span>👥 {event.headcount}</span>}
                </div>
                {(event.setupTime || event.takedownTime) && (
                  <div className="flex gap-1.5 mt-1.5">
                    {event.setupTime && (
                      <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                        Setup {event.setupTime}
                      </span>
                    )}
                    {event.takedownTime && (
                      <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                        Takedown {event.takedownTime}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
