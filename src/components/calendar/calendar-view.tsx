"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AddEventModal } from "@/components/calendar/add-event-modal";
import {
  EventDetailSidebar,
  type CalendarEvent,
} from "@/components/calendar/event-detail-sidebar";
import { Button } from "@/components/ui/button";
import { useUIScale } from "@/components/ui-scale-provider";
import { calendarApi } from "@/domains/calendar/api-client";
import { useCalendarSSE } from "@/domains/calendar/hooks";
import type { CalendarBootstrapData } from "@/domains/calendar/service";
import type { AgendaStreamEvent } from "@/domains/calendar/views/agenda-stream/types";
import {
  AgendaStreamIntegrationProvider,
  agendaStreamPlugin,
} from "@/domains/calendar/views/agenda-stream/agendaStreamPlugin";
import { eventApi } from "@/domains/event/api-client";
import type { CalendarEventItem, EventResponse } from "@/domains/event/types";
import { fromDateKey, getDateKeyInLosAngeles } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface CalendarApiHandle {
  gotoDate: (date: string) => void;
  next?: () => void;
  prev?: () => void;
  today?: () => void;
  refetchEvents: () => void;
  updateSize: () => void;
}

function getRangeKey(start: string, end: string): string {
  return `${start}|${end}`;
}

function matchesSidebarEvent(candidate: CalendarEventItem, current: CalendarEvent): boolean {
  return (
    candidate.id === current.id ||
    (!!current.eventId && candidate.extendedProps.eventId === current.eventId)
  );
}

const MOBILE_VIEWPORT_WIDTH = 1024;
const MIN_WEEK_CALENDAR_WIDTH = 920;
const DESKTOP_SIDEBAR_WIDTH = 240;
const STACKED_LAYOUT_MIN_CONTENT_WIDTH = MIN_WEEK_CALENDAR_WIDTH + DESKTOP_SIDEBAR_WIDTH;

function toEventInputs(events: CalendarEventItem[]): EventInput[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end ?? undefined,
    allDay: event.allDay,
    backgroundColor: event.color,
    borderColor: event.borderColor,
    textColor: event.textColor,
    extendedProps: {
      ...event.extendedProps,
      source: event.source,
    },
  }));
}

export function CalendarView({
  initialData = null,
}: {
  initialData?: CalendarBootstrapData | null;
}) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const { scale } = useUIScale();
  const [calendarHeight, setCalendarHeight] = useState<number>(600);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => (
    typeof window !== "undefined" ? window.innerWidth < MOBILE_VIEWPORT_WIDTH : false
  ));
  const [useStackedLayout, setUseStackedLayout] = useState<boolean>(() => (
    typeof window !== "undefined" ? window.innerWidth < STACKED_LAYOUT_MIN_CONTENT_WIDTH : false
  ));
  const eventCacheRef = useRef<Map<string, EventInput[]>>(
    new Map(
      initialData
        ? [
            [
              getRangeKey(initialData.desktop.start, initialData.desktop.end),
              toEventInputs(initialData.desktop.events),
            ],
            [
              getRangeKey(initialData.mobile.start, initialData.mobile.end),
              toEventInputs(initialData.mobile.events),
            ],
          ]
        : [],
    ),
  );
  const agendaEventCacheRef = useRef<Map<string, CalendarEventItem[]>>(
    new Map(
      initialData
        ? [
            [
              getRangeKey(initialData.desktop.start, initialData.desktop.end),
              initialData.desktop.events,
            ],
            [
              getRangeKey(initialData.mobile.start, initialData.mobile.end),
              initialData.mobile.events,
            ],
          ]
        : [],
    ),
  );
  const [desktopAgendaEvents, setDesktopAgendaEvents] = useState<CalendarEventItem[]>(
    initialData?.desktop.events ?? [],
  );

  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [pinnedEvent, setPinnedEvent] = useState<CalendarEvent | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [selectedEvent, setSelectedEvent] = useState<EventResponse | undefined>(undefined);
  const [editModalKey, setEditModalKey] = useState(0);

  const [displayMonth, setDisplayMonth] = useState(() => fromDateKey(getDateKeyInLosAngeles()));
  const [activeRange, setActiveRange] = useState<{ start: string; end: string }>();

  const getCalendarApi = useCallback(() => {
    return calendarRef.current?.getApi() as CalendarApiHandle | undefined;
  }, []);

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
        const bodyZoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
        const cssViewportH = window.innerHeight / bodyZoom;
        const cssViewportW = window.innerWidth / bodyZoom;
        const availableWidth = mainEl.clientWidth || cssViewportW;
        const mobileViewport = cssViewportW < MOBILE_VIEWPORT_WIDTH;
        const stackedLayout = availableWidth < STACKED_LAYOUT_MIN_CONTENT_WIDTH;
        setIsMobileViewport(mobileViewport);
        setUseStackedLayout(stackedLayout);

        if (stackedLayout) {
          mainEl.style.overflow = prevOverflow;
          mainEl.style.padding = prevPadding;
          mainEl.style.removeProperty("height");
          document.documentElement.style.removeProperty("--fc-slot-height");
          document.documentElement.style.removeProperty("--fc-slot-font");
          const sidebarHeight =
            document.querySelector<HTMLElement>("[data-calendar-sidebar]")?.getBoundingClientRect().height ?? 320;
          const minimumCalendarHeight = mobileViewport ? 480 : 560;
          setCalendarHeight(Math.max(cssViewportH - navH - sidebarHeight - 24, minimumCalendarHeight));
          calendarRef.current?.getApi().updateSize();
          return;
        }

        mainEl.style.overflow = "hidden";
        mainEl.style.padding = "0";
        mainEl.style.height = `${cssViewportH - navH}px`;
        setCalendarHeight(cssViewportH - navH);

        requestAnimationFrame(() => {
          const container = containerRef.current;
          if (!container) return;

          const scroller = container.querySelector<HTMLElement>(".fc-scroller-liquid-absolute");
          const allSlots = container.querySelectorAll(".fc-timegrid-slot");
          if (!scroller || allSlots.length === 0) return;

          const slotH = Math.max(scroller.clientHeight / allSlots.length, 10);
          const root = document.documentElement;
          root.style.setProperty("--fc-slot-height", `${slotH}px`);
          root.style.setProperty("--fc-slot-font", `${Math.min(Math.max(slotH * 0.85, 9), 13)}px`);
          scroller.style.overflow = "hidden";
          calendarRef.current?.getApi().updateSize();
        });
      }, 50);
    }

    syncRef.current = sync;
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

  useEffect(() => {
    return () => {
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let frameOne = 0;
    let frameTwo = 0;

    frameOne = requestAnimationFrame(() => {
      frameTwo = requestAnimationFrame(() => {
        calendarRef.current?.getApi().updateSize();
      });
    });

    return () => {
      cancelAnimationFrame(frameOne);
      cancelAnimationFrame(frameTwo);
    };
  }, [calendarHeight, isMobileViewport, useStackedLayout]);

  const refetchEvents = useCallback(() => {
    eventCacheRef.current.clear();
    agendaEventCacheRef.current.clear();
    setHoveredEvent(null);
    getCalendarApi()?.refetchEvents();
  }, [getCalendarApi]);

  useCalendarSSE(refetchEvents);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setActiveRange({
      start: info.startStr.split("T")[0],
      end: info.endStr.split("T")[0],
    });
    setDisplayMonth(info.view.currentStart);
    syncRef.current();
  }, []);

  const fetchEvents = useCallback(
    async (
      fetchInfo: { startStr: string; endStr: string },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void,
    ) => {
      try {
        const start = fetchInfo.startStr.split("T")[0];
        const end = fetchInfo.endStr.split("T")[0];
        const rangeKey = getRangeKey(start, end);
        const cached = eventCacheRef.current.get(rangeKey);
        const cachedAgendaEvents = agendaEventCacheRef.current.get(rangeKey);
        if (cached) {
          if (!isMobileViewport && cachedAgendaEvents) {
            setDesktopAgendaEvents(cachedAgendaEvents);
          }
          successCallback(cached);
          return;
        }

        const events = await calendarApi.getEvents(start, end);
        const mappedEvents = toEventInputs(events);
        eventCacheRef.current.set(rangeKey, mappedEvents);
        agendaEventCacheRef.current.set(rangeKey, events);
        if (!isMobileViewport) {
          setDesktopAgendaEvents(events);
        }
        successCallback(mappedEvents);
      } catch (err) {
        failureCallback(
          err instanceof Error ? err : new Error("Failed to fetch events"),
        );
      }
    },
    [isMobileViewport],
  );

  useEffect(() => {
    if (!isMobileViewport && activeRange) {
      const rangeKey = getRangeKey(activeRange.start, activeRange.end);
      const cachedAgendaEvents = agendaEventCacheRef.current.get(rangeKey);
      if (cachedAgendaEvents) {
        setDesktopAgendaEvents(cachedAgendaEvents);
      }
    }
  }, [activeRange, isMobileViewport]);

  useEffect(() => {
    if (isMobileViewport) {
      return;
    }

    setPinnedEvent((current) => {
      if (!current) {
        return current;
      }

      const match = desktopAgendaEvents.find((event) => matchesSidebarEvent(event, current));
      return match ? toCalendarEventFromItem(match) : null;
    });
  }, [desktopAgendaEvents, isMobileViewport]);

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

  function toCalendarEventFromItem(event: CalendarEventItem): CalendarEvent {
    const extendedProps = event.extendedProps;
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end ?? null,
      allDay: event.allDay,
      source: event.source,
      type: extendedProps.type,
      location: extendedProps.location ?? undefined,
      description: extendedProps.description ?? undefined,
      eventId: extendedProps.eventId ?? undefined,
      quoteId: extendedProps.quoteId ?? undefined,
      quoteStatus: extendedProps.quoteStatus ?? undefined,
      quoteNumber: extendedProps.quoteNumber ?? undefined,
      totalAmount: extendedProps.totalAmount ?? undefined,
      headcount: extendedProps.headcount ?? undefined,
      setupTime: extendedProps.setupTime ?? undefined,
      takedownTime: extendedProps.takedownTime ?? undefined,
      staffId: extendedProps.staffId ?? undefined,
      department: undefined,
    };
  }

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      info.jsEvent.preventDefault();
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
      const clicked = toCalendarEvent(info.event);

      if (pinnedEvent?.id === clicked.id) {
        setPinnedEvent(null);
        setHoveredEvent(null);
      } else {
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
    (el as HTMLElement & {
      __fcHoverHandlers?: { onEnter: () => void; onLeave: () => void };
    }).__fcHoverHandlers = { onEnter, onLeave };
  }, []);

  const handleEventWillUnmount = useCallback((info: { el: HTMLElement }) => {
    const el = info.el as HTMLElement & {
      __fcHoverHandlers?: { onEnter: () => void; onLeave: () => void };
    };
    if (el.__fcHoverHandlers) {
      el.removeEventListener("mouseenter", el.__fcHoverHandlers.onEnter);
      el.removeEventListener("mouseleave", el.__fcHoverHandlers.onLeave);
      delete el.__fcHoverHandlers;
    }
  }, []);

  const navigateCalendar = useCallback(
    (action: "prev" | "next" | "today" | "gotoDate", dateStr?: string) => {
      const api = getCalendarApi();
      if (!api) return;

      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
      setHoveredEvent(null);
      setPinnedEvent(null);

      if (action === "gotoDate") {
        if (dateStr) {
          api.gotoDate(dateStr);
        }
        return;
      }

      api[action]?.();
    },
    [getCalendarApi],
  );

  const handleMiniDateClick = useCallback((dateStr: string) => {
    navigateCalendar("gotoDate", dateStr);
  }, [navigateCalendar]);

  const handleAgendaEventSelect = useCallback(
    (event: AgendaStreamEvent) => {
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
      const clicked = toCalendarEventFromItem(event.original);

      if (pinnedEvent?.id === clicked.id) {
        setPinnedEvent(null);
        setHoveredEvent(null);
        return;
      }

      setPinnedEvent(clicked);
      setHoveredEvent(null);
    },
    [pinnedEvent],
  );

  const sidebarEvent = pinnedEvent ?? hoveredEvent;
  const calendarZoomCompensation = Math.max(1 / Number(scale || 1), 0.5);
  const agendaIntegrationValue = useMemo(
    () => ({
      events: desktopAgendaEvents,
      displayMonth,
      onEventSelect: handleAgendaEventSelect,
      selectedEventId: pinnedEvent?.id ?? null,
      showRail: false,
      onNavigatePreviousWeek: () => navigateCalendar("prev"),
      onNavigateNextWeek: () => navigateCalendar("next"),
      onNavigateToday: () => navigateCalendar("today"),
      onRefreshEvents: refetchEvents,
    }),
    [
      desktopAgendaEvents,
      displayMonth,
      handleAgendaEventSelect,
      navigateCalendar,
      pinnedEvent?.id,
      refetchEvents,
    ],
  );

  return (
    <div
      className={cn("flex min-w-0", useStackedLayout ? "flex-col gap-3" : "")}
      style={useStackedLayout ? undefined : { height: `${calendarHeight}px` }}
    >
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

      <div
        ref={containerRef}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 overflow-hidden border-t border-border bg-card",
          useStackedLayout ? "flex-col" : "flex-row",
        )}
      >
        <EventDetailSidebar
          event={sidebarEvent}
          pinned={pinnedEvent !== null}
          stacked={useStackedLayout}
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
                <Button className="w-full gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              }
            />
          }
        />

        <div className="min-h-[480px] w-full flex-1 min-w-0 overflow-hidden p-2">
          <div style={{ zoom: String(calendarZoomCompensation) }}>
            <AgendaStreamIntegrationProvider value={agendaIntegrationValue}>
              <FullCalendar
                key={isMobileViewport ? "mobile" : "desktop"}
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, agendaStreamPlugin]}
                initialView={isMobileViewport ? "timeGridDay" : "agendaStreamWeek"}
                headerToolbar={{
                  left: isMobileViewport ? "prev,next" : "prev,next today",
                  center: "title",
                  right: isMobileViewport ? "dayGridMonth,timeGridDay" : "dayGridMonth,agendaStreamWeek,timeGridDay",
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
                firstDay={1}
                slotMinTime="07:00:00"
                slotMaxTime="19:30:00"
                nowIndicator
                slotEventOverlap
              />
            </AgendaStreamIntegrationProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
