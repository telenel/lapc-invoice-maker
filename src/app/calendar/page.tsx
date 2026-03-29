"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { CalendarDays, Plus } from "lucide-react";
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
        const quoteId = info.event.extendedProps.quoteId as string | undefined;
        if (quoteId) router.push(`/quotes/${quoteId}`);
      } else if (source === "manual") {
        const eventId = info.event.extendedProps.eventId as string | undefined;
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
        const staffId = info.event.extendedProps.staffId as string | undefined;
        if (staffId) {
          router.push(`/staff/${staffId}`);
        } else {
          router.push("/staff");
        }
      }
    },
    [router],
  );

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">Catering, events, and staff birthdays</p>
          </div>
        </div>
        <AddEventModal
          onSave={refetchEvents}
          trigger={
            <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          }
        />
      </div>

      {/* Legend */}
      <div className="mb-5">
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
          onClose={() => setSelectedEvent(undefined)}
          trigger={<span />}
        />
      )}

      {/* Calendar */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4">
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
            nowIndicator
            eventMaxStack={3}
            dayMaxEvents={4}
          />
        </div>
      </div>
    </div>
  );
}
