"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { calendarApi } from "@/domains/calendar/api-client";

export default function CalendarPage() {
  const router = useRouter();

  const fetchEvents = useCallback(
    async (
      fetchInfo: { startStr: string; endStr: string },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void,
    ) => {
      try {
        const events = await calendarApi.getEvents(
          fetchInfo.startStr.split("T")[0],
          fetchInfo.endStr.split("T")[0],
        );
        successCallback(
          events.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            backgroundColor: "rgba(249, 115, 22, 0.15)",
            borderColor: "rgb(249, 115, 22)",
            textColor: "rgb(249, 115, 22)",
            extendedProps: {
              location: e.location,
              headcount: e.headcount,
              quoteId: e.quoteId,
              setupTime: e.setupTime,
              takedownTime: e.takedownTime,
            },
          })),
        );
      } catch (err) {
        failureCallback(
          err instanceof Error ? err : new Error("Failed to fetch events"),
        );
      }
    },
    [],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const quoteId = info.event.extendedProps.quoteId;
      if (quoteId) router.push(`/quotes/${quoteId}`);
    },
    [router],
  );

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Calendar</h1>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={fetchEvents}
        eventClick={handleEventClick}
        height="auto"
        weekends={false}
        slotMinTime="07:00:00"
        slotMaxTime="19:00:00"
      />
    </div>
  );
}
