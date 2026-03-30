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
import {
  EventDetailSidebar,
  type CalendarEvent,
} from "@/components/calendar/event-detail-sidebar";
import { AddEventModal } from "@/components/calendar/add-event-modal";
import { useCalendarSSE } from "@/domains/calendar/hooks";

export default function CalendarPage() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventResponse | undefined>(undefined);
  const [editModalKey, setEditModalKey] = useState(0);
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();

  function refetchEvents() {
    calendarRef.current?.getApi().refetchEvents();
  }

  useCalendarSSE(refetchEvents);

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

  const handleEventMouseEnter = useCallback(
    (info: {
      event: {
        id: string;
        title: string;
        startStr: string;
        endStr?: string;
        allDay: boolean;
        extendedProps: Record<string, unknown>;
      };
    }) => {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        const ep = info.event.extendedProps;
        setHoveredEvent({
          id: info.event.id,
          title: info.event.title,
          start: info.event.startStr,
          end: info.event.endStr ?? null,
          allDay: info.event.allDay,
          source: (ep.source as "catering" | "manual" | "birthday") ?? "manual",
          type: ep.type as string | undefined,
          location: ep.location as string | undefined,
          description: ep.description as string | undefined,
          eventId: ep.eventId as string | undefined,
          quoteId: ep.quoteId as string | undefined,
          quoteStatus: ep.quoteStatus as string | undefined,
          quoteNumber: ep.quoteNumber as string | undefined,
          totalAmount: ep.totalAmount as number | undefined,
          headcount: ep.headcount as number | undefined,
          setupTime: ep.setupTime as string | undefined,
          takedownTime: ep.takedownTime as string | undefined,
          staffId: ep.staffId as string | undefined,
          department: ep.department as string | undefined,
        });
      }, 150);
    },
    [],
  );

  const handleEventMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    // Don't clear hoveredEvent — sticky behavior
  }, []);

  const renderEventContent = useCallback(
    (arg: {
      event: { title: string; extendedProps: Record<string, unknown> };
      timeText: string;
    }) => {
      const source = arg.event.extendedProps.source as string;
      const type = arg.event.extendedProps.type as string | undefined;
      const location = arg.event.extendedProps.location as string | undefined;
      const headcount = arg.event.extendedProps.headcount as number | undefined;

      const icon =
        source === "catering"
          ? "🍽️"
          : source === "birthday"
            ? "🎂"
            : type === "VENDOR"
              ? "🏢"
              : type === "SEMINAR"
                ? "🎓"
                : "📋";

      return (
        <div className="px-1 py-0.5 overflow-hidden">
          <div className="flex items-center gap-1">
            <span className="text-xs">{icon}</span>
            <span className="font-semibold text-[0.8rem] truncate">{arg.event.title}</span>
          </div>
          {(() => {
            const parts: string[] = [];
            if (arg.timeText) parts.push(arg.timeText);
            if (location) parts.push(location);
            if (headcount != null) parts.push(`${headcount} guests`);
            const subtitle = parts.join(" \u00b7 ");
            return subtitle ? (
              <div className="text-[0.65rem] opacity-80 truncate mt-0.5">
                {subtitle}
              </div>
            ) : null;
          })()}
        </div>
      );
    },
    [],
  );

  const handleEventDidMount = useCallback((info: { el: HTMLElement }) => {
    info.el.addEventListener("mouseenter", () =>
      info.el.classList.add("event-hovered"),
    );
    info.el.addEventListener("mouseleave", () =>
      info.el.classList.remove("event-hovered"),
    );
  }, []);

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

      <div className="flex gap-6">
        {/* Calendar */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
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
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
              eventContent={renderEventContent}
              eventDidMount={handleEventDidMount}
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

        {/* Sidebar */}
        <div className="hidden lg:block">
          <EventDetailSidebar
            event={hoveredEvent}
            onEditEvent={(eventId) => {
              eventApi
                .getById(eventId)
                .then((eventData) => {
                  setSelectedEvent(eventData);
                  setEditModalKey((prev) => prev + 1);
                })
                .catch(() => {
                  toast.error("Failed to load event details");
                });
            }}
          />
        </div>
      </div>
    </div>
  );
}
