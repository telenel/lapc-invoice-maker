"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput, DatesSetArg } from "@fullcalendar/core";
import { Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";

export function CalendarView() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [calendarHeight, setCalendarHeight] = useState<number>(600);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  // Sidebar state
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [pinnedEvent, setPinnedEvent] = useState<CalendarEvent | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Edit modal state
  const [selectedEvent, setSelectedEvent] = useState<EventResponse | undefined>(undefined);
  const [editModalKey, setEditModalKey] = useState(0);

  // Mini month state
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [activeRange, setActiveRange] = useState<{ start: string; end: string }>();

  // Calendar fills viewport: disable main scrolling/padding, compute slot height
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const mainEl = main;
    const prevOverflow = mainEl.style.overflow;
    const prevPadding = mainEl.style.padding;

    let debounceTimer: ReturnType<typeof setTimeout>;
    function sync() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const navH = document.querySelector("nav")?.getBoundingClientRect().height ?? 64;
        const mobile = window.innerWidth < 1024;
        setIsMobile(mobile);

        if (mobile) {
          mainEl.style.overflow = prevOverflow;
          mainEl.style.padding = prevPadding;
          document.documentElement.style.removeProperty("--fc-slot-height");
          document.documentElement.style.removeProperty("--fc-slot-font");
          const sidebarHeight =
            document.querySelector<HTMLElement>("[data-calendar-sidebar]")?.getBoundingClientRect().height ?? 320;
          setCalendarHeight(Math.max(window.innerHeight - navH - sidebarHeight - 24, 480));
          calendarRef.current?.getApi().updateSize();
          return;
        }

        mainEl.style.overflow = "hidden";
        mainEl.style.padding = "0";
        setCalendarHeight(window.innerHeight - navH);

        requestAnimationFrame(() => {
          const container = containerRef.current;
          if (!container) return;

          const scroller = container.querySelector<HTMLElement>(".fc-scroller-liquid-absolute");
          const allSlots = container.querySelectorAll(".fc-timegrid-slot");
          if (!scroller || allSlots.length === 0) return;

          // Use fractional px so slots fill the scroller exactly.
          const slotH = Math.max(scroller.clientHeight / allSlots.length, 10);
          const root = document.documentElement;
          root.style.setProperty("--fc-slot-height", `${slotH}px`);
          root.style.setProperty("--fc-slot-font", `${Math.min(Math.max(slotH * 0.85, 9), 13)}px`);
          scroller.style.overflow = "hidden";
          calendarRef.current?.getApi().updateSize();
        });
      }, 50);
    }

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(mainEl);
    window.addEventListener("resize", sync, { passive: true });
    return () => {
      clearTimeout(debounceTimer);
      mainEl.style.overflow = prevOverflow;
      mainEl.style.padding = prevPadding;
      document.documentElement.style.removeProperty("--fc-slot-height");
      document.documentElement.style.removeProperty("--fc-slot-font");
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  // Clean up timers
  useEffect(() => {
    return () => {
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
    };
  }, []);

  function refetchEvents() {
    setHoveredEvent(null);
    setPinnedEvent(null);
    calendarRef.current?.getApi().refetchEvents();
  }

  useCalendarSSE(refetchEvents);

  // Track FullCalendar's visible date range for mini month highlighting
  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setActiveRange({
      start: info.startStr.split("T")[0],
      end: info.endStr.split("T")[0],
    });
    // Sync mini month to the calendar's displayed month (not padded range start)
    setDisplayMonth(info.view.currentStart);
  }, []);

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

  // Build a CalendarEvent from FullCalendar's event object
  function toCalendarEvent(fcEvent: {
    id: string;
    title: string;
    startStr: string;
    endStr?: string;
    allDay: boolean;
    extendedProps: Record<string, unknown>;
  }): CalendarEvent {
    const ep = fcEvent.extendedProps;
    return {
      id: fcEvent.id,
      title: fcEvent.title,
      start: fcEvent.startStr,
      end: fcEvent.endStr ?? null,
      allDay: fcEvent.allDay,
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
    };
  }

  // Click pins/unpins event in sidebar (no navigation)
  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      info.jsEvent.preventDefault();
      // Clear pending hover timers before changing pin state
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
      const clicked = toCalendarEvent(info.event);

      if (pinnedEvent?.id === clicked.id) {
        // Unpin
        setPinnedEvent(null);
        setHoveredEvent(null);
      } else {
        // Pin this event
        setPinnedEvent(clicked);
        setHoveredEvent(null);
      }
    },
    [pinnedEvent],
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
      // Don't update hover preview while something is pinned
      if (pinnedEvent) return;
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setHoveredEvent(toCalendarEvent(info.event));
      }, 150);
    },
    [pinnedEvent],
  );

  const handleEventMouseLeave = useCallback(() => {
    if (pinnedEvent) return;
    clearTimeout(hoverTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setHoveredEvent(null);
    }, 300);
  }, [pinnedEvent]);

  // Dense event content renderer — show as much info as the block allows
  const renderEventContent = useCallback(
    (arg: {
      event: {
        title: string;
        extendedProps: Record<string, unknown>;
        start: Date | null;
        end: Date | null;
      };
      timeText: string;
    }) => {
      const source = arg.event.extendedProps.source as string;
      const type = arg.event.extendedProps.type as string | undefined;
      const location = arg.event.extendedProps.location as string | undefined;
      const headcount = arg.event.extendedProps.headcount as number | undefined;
      const quoteNumber = arg.event.extendedProps.quoteNumber as string | undefined;
      const description = arg.event.extendedProps.description as string | undefined;

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

      // Calculate duration for layout decisions
      const start = arg.event.start;
      const end = arg.event.end;
      const durationMin =
        start && end
          ? (end.getTime() - start.getTime()) / 60000
          : 60;
      const isTall = durationMin >= 60;

      const subtitleParts: string[] = [];
      if (arg.timeText) subtitleParts.push(arg.timeText);
      if (location) subtitleParts.push(location);

      const extraParts: string[] = [];
      if (headcount != null) extraParts.push(`👥 ${headcount}`);
      if (quoteNumber) extraParts.push(quoteNumber);
      if (description && !location) extraParts.push(description);

      return (
        <div className="px-1 py-0.5 overflow-hidden w-full">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[0.7rem] shrink-0">{icon}</span>
            <span className="font-semibold text-[0.75rem] truncate">{arg.event.title}</span>
          </div>
          {isTall && subtitleParts.length > 0 && (
            <div className="text-[0.6rem] opacity-80 truncate mt-0.5">
              {subtitleParts.join(" · ")}
            </div>
          )}
          {isTall && extraParts.length > 0 && (
            <div className="text-[0.6rem] opacity-70 truncate mt-0.5">
              {extraParts.join(" · ")}
            </div>
          )}
        </div>
      );
    },
    [],
  );

  const handleEventDidMount = useCallback((info: { el: HTMLElement }) => {
    const el = info.el;
    const onEnter = () => el.classList.add("event-hovered");
    const onLeave = () => el.classList.remove("event-hovered");
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    (el as HTMLElement & { __fcHoverHandlers?: { onEnter: () => void; onLeave: () => void } }).__fcHoverHandlers = { onEnter, onLeave };
  }, []);

  const handleEventWillUnmount = useCallback((info: { el: HTMLElement }) => {
    const el = info.el as HTMLElement & { __fcHoverHandlers?: { onEnter: () => void; onLeave: () => void } };
    if (el.__fcHoverHandlers) {
      el.removeEventListener("mouseenter", el.__fcHoverHandlers.onEnter);
      el.removeEventListener("mouseleave", el.__fcHoverHandlers.onLeave);
      delete el.__fcHoverHandlers;
    }
  }, []);

  // Mini month date click navigates FullCalendar
  const handleMiniDateClick = useCallback((dateStr: string) => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.gotoDate(dateStr);
    }
  }, []);

  // The event to show in sidebar: pinned takes priority, then hovered
  const sidebarEvent = pinnedEvent ?? hoveredEvent;

  return (
    <div className={cn("flex", isMobile ? "flex-col gap-3" : "")} style={isMobile ? undefined : { height: "calc(100vh - 64px)" }}>
      {/* Edit modal triggered by sidebar Edit button */}
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

      {/* Main content: sidebar + calendar */}
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-card lg:flex-row">
        {/* Left sidebar */}
        <EventDetailSidebar
          event={sidebarEvent}
          pinned={pinnedEvent !== null}
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
          onUnpin={() => {
            setPinnedEvent(null);
            setHoveredEvent(null);
          }}
          displayMonth={displayMonth}
          onMonthChange={setDisplayMonth}
          onDateClick={handleMiniDateClick}
          activeRange={activeRange}
          addEventTrigger={
            <AddEventModal
              onSave={refetchEvents}
              trigger={
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              }
            />
          }
        />

        {/* Calendar */}
        <div className="min-h-[480px] flex-1 min-w-0 overflow-hidden p-2">
          <FullCalendar
            key={isMobile ? "mobile" : "desktop"}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
            headerToolbar={{
              left: isMobile ? "prev,next" : "prev,next today",
              center: "title",
              right: isMobile ? "dayGridMonth,timeGridDay" : "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={fetchEvents}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            eventMouseEnter={handleEventMouseEnter}
            eventMouseLeave={handleEventMouseLeave}
            eventContent={renderEventContent}
            eventDidMount={handleEventDidMount}
            eventWillUnmount={handleEventWillUnmount}
            height={calendarHeight}
            weekends={false}
            slotMinTime="07:00:00"
            slotMaxTime="19:30:00"
            nowIndicator
            slotEventOverlap
          />
        </div>
      </div>
    </div>
  );
}
