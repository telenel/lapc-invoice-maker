"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { calendarApi } from "@/domains/calendar/api-client";
import { eventApi } from "@/domains/event/api-client";
import type { EventResponse } from "@/domains/event/types";
import { EventLegend } from "@/components/calendar/event-legend";
import { AddEventModal } from "@/components/calendar/add-event-modal";

export default function CalendarPage() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventResponse | undefined>(undefined);
  const [editModalKey, setEditModalKey] = useState(0);

  function refetchEvents() {
    calendarRef.current?.getApi().refetchEvents();
  }

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
            end: e.end ?? undefined,
            allDay: e.allDay,
            backgroundColor: e.color,
            borderColor: e.borderColor,
            textColor: e.textColor,
            extendedProps: {
              ...e.extendedProps,
              source: e.source,
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
    async (info: EventClickArg) => {
      const source = info.event.extendedProps.source as string;

      if (source === "catering") {
        const quoteId = info.event.extendedProps.quoteId;
        if (quoteId) router.push(`/quotes/${quoteId}`);
      } else if (source === "manual") {
        const eventId = info.event.extendedProps.eventId as string;
        if (eventId) {
          try {
            const eventData = await eventApi.getById(eventId);
            setSelectedEvent(eventData);
            setEditModalKey((prev) => prev + 1);
          } catch {
            toast.error("Failed to load event details");
          }
        }
      } else if (source === "birthday") {
        router.push("/staff");
      }
    },
    [router],
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <AddEventModal
          onSave={refetchEvents}
          trigger={
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-1" />
              Add Event
            </Button>
          }
        />
      </div>

      <div className="mb-4">
        <EventLegend />
      </div>

      {/* Edit modal triggered by clicking a manual event */}
      {selectedEvent && (
        <AddEventModal
          key={editModalKey}
          event={selectedEvent}
          defaultOpen
          onSave={() => {
            setSelectedEvent(undefined);
            refetchEvents();
          }}
          trigger={<span />}
        />
      )}

      <FullCalendar
        ref={calendarRef}
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
