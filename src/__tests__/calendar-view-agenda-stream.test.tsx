import "@testing-library/jest-dom/vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ViewProps } from "@fullcalendar/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiniMonth } from "@/components/calendar/mini-month";
import { AgendaStreamView } from "@/domains/calendar/views/agenda-stream/AgendaStreamView";
import type { AgendaStreamEvent } from "@/domains/calendar/views/agenda-stream/types";
import type { CalendarEventItem } from "@/domains/event/types";
import type { EventResponse } from "@/domains/event/types";
import { zonedDateTimeToUtc } from "@/lib/date-utils";

const {
  calendarApiGetEvents,
  eventApiGetById,
  eventApiCreate,
  eventApiUpdate,
  createEvent,
  updateEvent,
  deleteEvent,
  toastError,
  toastSuccess,
} = vi.hoisted(() => ({
  calendarApiGetEvents: vi.fn(),
  eventApiGetById: vi.fn(),
  eventApiCreate: vi.fn(),
  eventApiUpdate: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/domains/calendar/api-client", () => ({
  calendarApi: {
    getEvents: calendarApiGetEvents,
  },
}));

vi.mock("@/domains/event/api-client", () => ({
  eventApi: {
    getById: eventApiGetById,
    create: eventApiCreate,
    update: eventApiUpdate,
  },
}));

vi.mock("@/domains/calendar/hooks", () => ({
  useCalendarSSE: vi.fn(),
}));

vi.mock("@/domains/event/hooks", () => ({
  useCreateEvent: () => ({
    createEvent,
    loading: false,
  }),
  useUpdateEvent: () => ({
    updateEvent,
    loading: false,
  }),
  useDeleteEvent: () => ({
    deleteEvent,
    loading: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname?: string };
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : href.pathname ?? "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("@fullcalendar/react", async () => {
  const React = await import("react");

  interface MockCalendarApi {
    gotoDate: ReturnType<typeof vi.fn>;
    prev: ReturnType<typeof vi.fn>;
    next: ReturnType<typeof vi.fn>;
    today: ReturnType<typeof vi.fn>;
    refetchEvents: ReturnType<typeof vi.fn>;
    updateSize: ReturnType<typeof vi.fn>;
  }

  interface MockCalendarRef {
    getApi: () => MockCalendarApi;
  }

  interface MockCalendarEventLike {
    id: string;
    title: string;
  }

  interface MockFullCalendarProps {
    initialView: string;
    plugins?: Array<{
      views?: Record<string, { content?: (props: Partial<ViewProps>) => ReactNode }>;
    }>;
    events?: (
      info: { startStr: string; endStr: string },
      successCallback: (events: MockCalendarEventLike[]) => void,
      failureCallback: () => void,
    ) => void;
    datesSet?: (info: ReturnType<typeof toDatesSetRange>) => void;
  }

  const MockFullCalendar = React.forwardRef<MockCalendarRef, MockFullCalendarProps>(function MockFullCalendar(
    props,
    ref,
  ) {
    const { initialView, plugins, events, datesSet } = props;
    const [loadedEvents, setLoadedEvents] = React.useState<MockCalendarEventLike[]>([]);
    const [currentStart, setCurrentStart] = React.useState(() =>
      toNormalizedViewStart(MOCK_TODAY, initialView),
    );
    const currentStartRef = React.useRef(currentStart);
    const apiRef = React.useRef<MockCalendarApi>({
      gotoDate: vi.fn((date: string | Date) => {
        const nextDate = typeof date === "string" ? new Date(`${date}T12:00:00.000Z`) : date;
        setCurrentStart(toNormalizedViewStart(nextDate, initialView));
      }),
      prev: vi.fn(() => {
        setCurrentStart((previous: Date) =>
          addDays(previous, initialView === "agendaStreamWeek" ? -7 : -1),
        );
      }),
      next: vi.fn(() => {
        setCurrentStart((previous: Date) =>
          addDays(previous, initialView === "agendaStreamWeek" ? 7 : 1),
        );
      }),
      today: vi.fn(() => {
        setCurrentStart(toNormalizedViewStart(MOCK_TODAY, initialView));
      }),
      refetchEvents: vi.fn(() => {
        const range = toDatesSetRange(currentStartRef.current, initialView);
        events?.(
          { startStr: range.startStr, endStr: range.endStr },
          (nextEvents) => setLoadedEvents(nextEvents),
          () => setLoadedEvents([]),
        );
      }),
      updateSize: vi.fn(),
    });

    React.useImperativeHandle(ref, () => ({
      getApi: () => apiRef.current,
    }));

    React.useEffect(() => {
      const nextStart = toNormalizedViewStart(currentStart, initialView);
      currentStartRef.current = nextStart;
      const range = toDatesSetRange(nextStart, initialView);

      datesSet?.(range);
      events?.(
        { startStr: range.startStr, endStr: range.endStr },
        (nextEvents) => setLoadedEvents(nextEvents),
        () => setLoadedEvents([]),
      );
    }, [currentStart, initialView, events, datesSet]);

    const customView = plugins
      ?.map((plugin) => plugin.views?.[initialView])
      .find((view) => view?.content);

    if (customView?.content) {
      return (
        <div data-testid="mock-fullcalendar" data-view={initialView}>
          {customView.content({
            dateProfile: {
              currentRange: {
                start: currentStartRef.current,
              },
            },
          })}
        </div>
      );
    }

    return (
      <div data-testid="mock-fullcalendar" data-view={initialView}>
        <div>{initialView}</div>
        {loadedEvents.map((event) => (
          <div key={event.id}>{event.title}</div>
        ))}
      </div>
    );
  });

  return { default: MockFullCalendar };
});

import { CalendarView } from "@/components/calendar/calendar-view";

const NOW = new Date("2026-04-16T17:45:00.000Z");
const NON_MATCHING_NOW = new Date("2026-05-01T17:45:00.000Z");
const MOCK_TODAY = new Date("2026-04-16T12:00:00.000Z");
const TIMELINE_TOP = 100;
const TIMELINE_HEIGHT = 1050;

let currentDesktopEvents: CalendarEventItem[] = [];
let currentMobileEvents: CalendarEventItem[] = [];

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toNormalizedViewStart(date: Date, initialView: string): Date {
  const next = new Date(date.getTime());
  next.setUTCHours(12, 0, 0, 0);

  if (initialView !== "agendaStreamWeek") {
    return next;
  }

  const dayOfWeek = next.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  next.setUTCDate(next.getUTCDate() + offset);
  return next;
}

function toDatesSetRange(start: Date, initialView: string) {
  const rangeStart = toNormalizedViewStart(start, initialView);
  const rangeEnd = addDays(rangeStart, initialView === "agendaStreamWeek" ? 7 : 1);

  return {
    startStr: `${rangeStart.toISOString().split("T")[0]}T00:00:00.000Z`,
    endStr: `${rangeEnd.toISOString().split("T")[0]}T00:00:00.000Z`,
    view: {
      currentStart: rangeStart,
    },
  };
}

function buildAgendaEvents(): AgendaStreamEvent[] {
  return [
    {
      id: "catering-1",
      calendarEventId: "catering-1",
      dateKey: "2026-04-13",
      startMin: 9 * 60,
      durMin: 90,
      source: "catering",
      title: "Board Lunch",
      metadata: {
        amount: 1250,
        location: "Library",
        headcount: 18,
        quoteId: "quote-1",
        quoteNumber: "QT-101",
        quoteStatus: "ACCEPTED",
        staffId: null,
        eventId: null,
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: true,
      allDay: false,
      original: {
        id: "catering-1",
        title: "Board Lunch",
        start: "2026-04-13T16:00:00.000Z",
        end: "2026-04-13T17:30:00.000Z",
        allDay: false,
        color: "#fff7ed",
        borderColor: "#f97316",
        textColor: "#7c2d12",
        source: "catering",
        extendedProps: {
          location: "Library",
          headcount: 18,
          quoteId: "quote-1",
          quoteNumber: "QT-101",
          quoteStatus: "ACCEPTED",
        },
      },
    },
    {
      id: "meeting-1",
      calendarEventId: "meeting-1",
      dateKey: "2026-04-16",
      startMin: 10 * 60,
      durMin: 60,
      source: "MEETING",
      title: "Ops Sync",
      metadata: {
        amount: null,
        location: "Admin 201",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: "staff-1",
        eventId: "evt-1",
        description: "Weekly operations check-in",
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "meeting-1",
        title: "Ops Sync",
        start: "2026-04-16T17:00:00.000Z",
        end: "2026-04-16T18:00:00.000Z",
        allDay: false,
        color: "#dbeafe",
        borderColor: "#3b82f6",
        textColor: "#1d4ed8",
        source: "manual",
        extendedProps: {
          type: "MEETING",
          location: "Admin 201",
          staffId: "staff-1",
          eventId: "evt-1",
          description: "Weekly operations check-in",
        },
      },
    },
    {
      id: "vendor-1",
      calendarEventId: "vendor-1",
      dateKey: "2026-04-17",
      startMin: 13 * 60 + 30,
      durMin: 45,
      source: "VENDOR",
      title: "Rental Walkthrough",
      metadata: {
        amount: null,
        location: "Gym",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: "staff-2",
        eventId: "evt-2",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "vendor-1",
        title: "Rental Walkthrough",
        start: "2026-04-17T20:30:00.000Z",
        end: "2026-04-17T21:15:00.000Z",
        allDay: false,
        color: "#ccfbf1",
        borderColor: "#14b8a6",
        textColor: "#0f766e",
        source: "manual",
        extendedProps: {
          type: "VENDOR",
          location: "Gym",
          staffId: "staff-2",
          eventId: "evt-2",
        },
      },
    },
  ];
}

function buildCalendarEvents(): CalendarEventItem[] {
  return buildAgendaEvents().map((event) => event.original);
}

function buildCalendarBootstrapData() {
  return {
    desktop: {
      start: "2026-04-13",
      end: "2026-04-20",
      events: [
        {
          id: "quote-evt",
          title: "Dean Lunch",
          start: "2026-04-16T18:00:00.000Z",
          end: "2026-04-16T19:00:00.000Z",
          allDay: false,
          color: "#fff7ed",
          borderColor: "#f97316",
          textColor: "#7c2d12",
          source: "catering" as const,
          extendedProps: {
            quoteId: "quote-123",
            quoteNumber: "QT-123",
            quoteStatus: "ACCEPTED",
            totalAmount: 2400,
            location: "Library",
            headcount: 24,
          },
        },
        {
          id: "manual-evt",
          title: "Ops Sync",
          start: "2026-04-16T17:00:00.000Z",
          end: "2026-04-16T18:00:00.000Z",
          allDay: false,
          color: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1d4ed8",
          source: "manual" as const,
          extendedProps: {
            type: "MEETING" as const,
            eventId: "evt-1",
            location: "Admin 201",
            description: "Weekly operations check-in",
          },
        },
        {
          id: "birthday-evt",
          title: "Sam's Birthday",
          start: "2026-04-17",
          end: null,
          allDay: true,
          color: "#fce7f3",
          borderColor: "#ec4899",
          textColor: "#9d174d",
          source: "birthday" as const,
          extendedProps: {
            staffId: "staff-77",
            description: "Bring cake",
          },
        },
      ],
    },
    mobile: {
      start: "2026-04-16",
      end: "2026-04-17",
      events: [
        {
          id: "mobile-evt",
          title: "Mobile View Event",
          start: "2026-04-16T18:00:00.000Z",
          end: "2026-04-16T19:00:00.000Z",
          allDay: false,
          color: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1d4ed8",
          source: "manual" as const,
          extendedProps: {
            type: "MEETING" as const,
            eventId: "evt-mobile",
          },
        },
      ],
    },
  };
}

function cloneCalendarEventItem(event: CalendarEventItem): CalendarEventItem {
  return {
    ...event,
    extendedProps: {
      ...event.extendedProps,
    },
  };
}

function buildDesktopEventsState(): CalendarEventItem[] {
  return buildCalendarBootstrapData().desktop.events.map(cloneCalendarEventItem);
}

function buildMobileEventsState(): CalendarEventItem[] {
  return buildCalendarBootstrapData().mobile.events.map(cloneCalendarEventItem);
}

function buildNextWeekEvents(): CalendarEventItem[] {
  return [
    {
      id: "next-week-evt",
      title: "Budget Review",
      start: "2026-04-21T18:00:00.000Z",
      end: "2026-04-21T19:00:00.000Z",
      allDay: false,
      color: "#dbeafe",
      borderColor: "#3b82f6",
      textColor: "#1d4ed8",
      source: "manual",
      extendedProps: {
        type: "MEETING",
        eventId: "evt-next",
        location: "Admin 301",
      },
    },
  ];
}

function buildManualEventResponse(): EventResponse {
  return {
    id: "evt-1",
    title: "Ops Sync",
    description: "Weekly operations check-in",
    type: "MEETING",
    date: "2026-04-16",
    startTime: "10:00",
    endTime: "11:00",
    allDay: false,
    location: "Admin 201",
    color: "#3b82f6",
    recurrence: null,
    recurrenceEnd: null,
    reminderMinutes: 60,
    createdBy: "user-1",
    createdAt: "2026-04-01T12:00:00.000Z",
  };
}

function buildEventResponseFromInput(
  id: string,
  input: {
    title: string;
    type: EventResponse["type"];
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    allDay?: boolean;
    location?: string | null;
    description?: string | null;
  },
): EventResponse {
  return {
    id,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    date: input.date,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    allDay: input.allDay ?? false,
    location: input.location ?? null,
    color: "#3b82f6",
    recurrence: null,
    recurrenceEnd: null,
    reminderMinutes: 60,
    createdBy: "user-1",
    createdAt: "2026-04-01T12:00:00.000Z",
  };
}

function toIsoRange(date: string, time: string | null | undefined): string {
  return time ? zonedDateTimeToUtc(date, time).toISOString() : date;
}

function buildManualCalendarItemFromInput(
  id: string,
  input: {
    title: string;
    type: EventResponse["type"];
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    allDay?: boolean;
    location?: string | null;
    description?: string | null;
  },
): CalendarEventItem {
  return {
    id,
    title: input.title,
    start: toIsoRange(input.date, input.allDay ? null : input.startTime ?? null),
    end: input.allDay ? null : toIsoRange(input.date, input.endTime ?? null),
    allDay: input.allDay ?? false,
    color: "#dbeafe",
    borderColor: "#3b82f6",
    textColor: "#1d4ed8",
    source: "manual",
    extendedProps: {
      type: input.type,
      eventId: id,
      location: input.location ?? null,
      description: input.description ?? null,
    },
  };
}

function updateManualCalendarItem(
  event: CalendarEventItem,
  input: {
    title?: string;
    type?: EventResponse["type"];
    date?: string;
    startTime?: string | null;
    endTime?: string | null;
    allDay?: boolean;
    location?: string | null;
    description?: string | null;
  },
): CalendarEventItem {
  const nextDate = input.date ?? event.start.split("T")[0];
  const nextAllDay = input.allDay ?? event.allDay;
  const nextTitle = input.title ?? event.title;
  const nextType = input.type ?? event.extendedProps.type ?? "MEETING";
  const nextStartTime = input.startTime ?? (nextAllDay ? null : event.start.split("T")[1]?.slice(0, 5) ?? null);
  const nextEndTime = input.endTime ?? (nextAllDay ? null : event.end?.split("T")[1]?.slice(0, 5) ?? null);

  return {
    ...event,
    title: nextTitle,
    start: toIsoRange(nextDate, nextAllDay ? null : nextStartTime),
    end: nextAllDay ? null : toIsoRange(nextDate, nextEndTime),
    allDay: nextAllDay,
    extendedProps: {
      ...event.extendedProps,
      type: nextType,
      location: input.location ?? event.extendedProps.location ?? null,
      description: input.description ?? event.extendedProps.description ?? null,
    },
  };
}

function setTimelineRect(element: HTMLElement) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: TIMELINE_TOP,
      width: 640,
      height: TIMELINE_HEIGHT,
      top: TIMELINE_TOP,
      right: 640,
      bottom: TIMELINE_TOP + TIMELINE_HEIGHT,
      left: 0,
      toJSON: () => ({}),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentDesktopEvents = buildDesktopEventsState();
  currentMobileEvents = buildMobileEventsState();
  calendarApiGetEvents.mockImplementation(async (start: string, end: string) => {
    if (start === "2026-04-13" && end === "2026-04-20") {
      return currentDesktopEvents.map(cloneCalendarEventItem);
    }

    if (start === "2026-04-16" && end === "2026-04-17") {
      return currentMobileEvents.map(cloneCalendarEventItem);
    }

    if (start === "2026-04-20" && end === "2026-04-27") {
      return buildNextWeekEvents();
    }

    return [];
  });
  eventApiGetById.mockResolvedValue(buildManualEventResponse());
  eventApiCreate.mockImplementation(async (input) => {
    const createdId = "evt-created";
    currentDesktopEvents = [
      ...currentDesktopEvents,
      buildManualCalendarItemFromInput(createdId, {
        title: input.title,
        type: input.type,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        allDay: input.allDay,
        location: input.location,
        description: input.description,
      }),
    ];
    return buildEventResponseFromInput(createdId, input);
  });
  eventApiUpdate.mockImplementation(async (id, input) => {
    const existing = currentDesktopEvents.find((event) => event.extendedProps.eventId === id || event.id === id);
    const updated = buildEventResponseFromInput(id, {
      title: input.title ?? existing?.title ?? "Updated Event",
      type: input.type ?? existing?.extendedProps.type ?? "MEETING",
      date: input.date ?? existing?.start.split("T")[0] ?? "2026-04-16",
      startTime: input.startTime ?? existing?.start.split("T")[1]?.slice(0, 5) ?? null,
      endTime: input.endTime ?? existing?.end?.split("T")[1]?.slice(0, 5) ?? null,
      allDay: input.allDay ?? existing?.allDay ?? false,
      location: input.location ?? existing?.extendedProps.location ?? null,
      description: input.description ?? existing?.extendedProps.description ?? null,
    });

    currentDesktopEvents = currentDesktopEvents.map((event) => (
      event.extendedProps.eventId === id || event.id === id
        ? updateManualCalendarItem(event, input)
        : event
    ));

    return updated;
  });

  Object.defineProperty(window, "innerWidth", {
    value: 1280,
    configurable: true,
    writable: true,
  });

  class ResizeObserverMock {
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function buildFullCalendarLikeViewProps(): Partial<ViewProps> {
  return {
    dateProfile: {
      currentRange: {
        start: new Date("2026-04-13T07:00:00.000Z"),
      },
    },
  } as Partial<ViewProps>;
}

function buildMayFullCalendarLikeViewProps(): Partial<ViewProps> {
  return {
    dateProfile: {
      currentRange: {
        start: new Date("2026-05-04T07:00:00.000Z"),
      },
    },
  } as Partial<ViewProps>;
}

function buildBoundaryAgendaEvents(): AgendaStreamEvent[] {
  return [
    ...buildAgendaEvents(),
    {
      id: "all-day-1",
      calendarEventId: "all-day-1",
      dateKey: "2026-04-13",
      startMin: 0,
      durMin: 24 * 60,
      source: "SEMINAR",
      title: "All-day Conference",
      metadata: {
        amount: null,
        location: "Student Union",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-all-day",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: true,
      original: {
        id: "all-day-1",
        title: "All-day Conference",
        start: "2026-04-13",
        end: null,
        allDay: true,
        color: "#ede9fe",
        borderColor: "#8b5cf6",
        textColor: "#6d28d9",
        source: "manual",
        extendedProps: {
          type: "SEMINAR",
          location: "Student Union",
          eventId: "evt-all-day",
        },
      },
    },
    {
      id: "early-1",
      calendarEventId: "early-1",
      dateKey: "2026-04-13",
      startMin: 6 * 60,
      durMin: 45,
      source: "OTHER",
      title: "Sunrise Setup",
      metadata: {
        amount: null,
        location: "Quad",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-early",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "early-1",
        title: "Sunrise Setup",
        start: "2026-04-13T13:00:00.000Z",
        end: "2026-04-13T13:45:00.000Z",
        allDay: false,
        color: "#f3f4f6",
        borderColor: "#6b7280",
        textColor: "#374151",
        source: "manual",
        extendedProps: {
          type: "OTHER",
          location: "Quad",
          eventId: "evt-early",
        },
      },
    },
    {
      id: "late-1",
      calendarEventId: "late-1",
      dateKey: "2026-04-13",
      startMin: 20 * 60,
      durMin: 60,
      source: "VENDOR",
      title: "Evening Breakdown",
      metadata: {
        amount: null,
        location: "Gym",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-late",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "late-1",
        title: "Evening Breakdown",
        start: "2026-04-14T03:00:00.000Z",
        end: "2026-04-14T04:00:00.000Z",
        allDay: false,
        color: "#ccfbf1",
        borderColor: "#14b8a6",
        textColor: "#0f766e",
        source: "manual",
        extendedProps: {
          type: "VENDOR",
          location: "Gym",
          eventId: "evt-late",
        },
      },
    },
  ];
}

function buildDenseAgendaEvents(): AgendaStreamEvent[] {
  return [
    {
      id: "overlap-a",
      calendarEventId: "overlap-a",
      dateKey: "2026-04-14",
      startMin: 9 * 60,
      durMin: 60,
      source: "MEETING",
      title: "Morning Sync",
      metadata: {
        amount: null,
        location: "Admin 201",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-a",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "overlap-a",
        title: "Morning Sync",
        start: "2026-04-14T16:00:00.000Z",
        end: "2026-04-14T17:00:00.000Z",
        allDay: false,
        color: "#dbeafe",
        borderColor: "#3b82f6",
        textColor: "#1d4ed8",
        source: "manual",
        extendedProps: { type: "MEETING", eventId: "evt-a" },
      },
    },
    {
      id: "overlap-b",
      calendarEventId: "overlap-b",
      dateKey: "2026-04-14",
      startMin: 9 * 60 + 15,
      durMin: 60,
      source: "SEMINAR",
      title: "Training Block",
      metadata: {
        amount: null,
        location: "Room 2",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-b",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "overlap-b",
        title: "Training Block",
        start: "2026-04-14T16:15:00.000Z",
        end: "2026-04-14T17:15:00.000Z",
        allDay: false,
        color: "#ede9fe",
        borderColor: "#8b5cf6",
        textColor: "#6d28d9",
        source: "manual",
        extendedProps: { type: "SEMINAR", eventId: "evt-b" },
      },
    },
    {
      id: "overlap-c",
      calendarEventId: "overlap-c",
      dateKey: "2026-04-14",
      startMin: 9 * 60 + 30,
      durMin: 45,
      source: "OTHER",
      title: "Vendor Prep",
      metadata: {
        amount: null,
        location: "Dock",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-c",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "overlap-c",
        title: "Vendor Prep",
        start: "2026-04-14T16:30:00.000Z",
        end: "2026-04-14T17:15:00.000Z",
        allDay: false,
        color: "#f3f4f6",
        borderColor: "#6b7280",
        textColor: "#374151",
        source: "manual",
        extendedProps: { type: "OTHER", eventId: "evt-c" },
      },
    },
    {
      id: "solo-late",
      calendarEventId: "solo-late",
      dateKey: "2026-04-14",
      startMin: 13 * 60,
      durMin: 45,
      source: "MEETING",
      title: "Solo Review",
      metadata: {
        amount: null,
        location: "Office",
        headcount: null,
        quoteId: null,
        quoteNumber: null,
        quoteStatus: null,
        staffId: null,
        eventId: "evt-solo",
        description: null,
        setupTime: null,
        takedownTime: null,
      },
      readOnly: false,
      allDay: false,
      original: {
        id: "solo-late",
        title: "Solo Review",
        start: "2026-04-14T20:00:00.000Z",
        end: "2026-04-14T20:45:00.000Z",
        allDay: false,
        color: "#dbeafe",
        borderColor: "#3b82f6",
        textColor: "#1d4ed8",
        source: "manual",
        extendedProps: { type: "MEETING", eventId: "evt-solo" },
      },
    },
  ];
}

describe("CalendarView agenda stream integration", () => {
  it("uses the agenda stream on desktop and preserves quote, birthday, and manual-event affordances", async () => {
    const user = userEvent.setup();

    render(<CalendarView initialData={buildCalendarBootstrapData()} />);

    expect(screen.getByTestId("mock-fullcalendar")).toHaveAttribute("data-view", "agendaStreamWeek");
    expect(await screen.findByText("Show past")).toBeInTheDocument();
    expect(screen.getByText("$2,400")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add event/i }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Dean Lunch/i }));
    expect(screen.getAllByText(/QT-123/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /view quote/i })).toHaveAttribute("href", "/quotes/quote-123");

    await user.click(screen.getByRole("button", { name: /Sam's Birthday/i }));
    expect(screen.getByRole("link", { name: /view staff/i })).toHaveAttribute("href", "/staff/staff-77");

    await user.click(screen.getByRole("button", { name: /Ops Sync/i }));
    expect(screen.getByText("Weekly operations check-in")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit event/i }));
    expect(eventApiGetById).toHaveBeenCalledWith("evt-1");
    expect(await screen.findByRole("heading", { name: /edit event/i })).toBeInTheDocument();
  });

  it("routes agenda stream next and today controls through the outer calendar state", async () => {
    const user = userEvent.setup();

    render(<CalendarView initialData={buildCalendarBootstrapData()} />);

    expect(await screen.findByText("Week of Apr 13, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dean Lunch/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next week/i }));

    expect(await screen.findByText("Week of Apr 20, 2026")).toBeInTheDocument();
    expect(calendarApiGetEvents).toHaveBeenCalledWith("2026-04-20", "2026-04-27");
    expect(await screen.findByRole("button", { name: /Budget Review/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dean Lunch/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Today$/i }));

    expect(await screen.findByText("Week of Apr 13, 2026")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Dean Lunch/i })).toBeInTheDocument();
  });

  it("keeps mobile on the familiar timeGridDay flow", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 390,
      configurable: true,
      writable: true,
    });

    render(<CalendarView initialData={buildCalendarBootstrapData()} />);

    expect(screen.getByTestId("mock-fullcalendar")).toHaveAttribute("data-view", "timeGridDay");
    expect(screen.getByText("timeGridDay")).toBeInTheDocument();
    expect(screen.queryByText("Show past")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add event/i }).length).toBeGreaterThan(0);
  });

  it("creates manual events from agenda stream quick add defaults and refreshes the desktop view", async () => {
    const user = userEvent.setup();

    render(<CalendarView initialData={buildCalendarBootstrapData()} />);

    const laneToggle = screen.getByRole("button", { name: /Thursday, April 16, 2026/i });
    await user.click(laneToggle);

    const timelineCanvas = screen.getByTestId("expanded-timeline-canvas-2026-04-16");
    setTimelineRect(timelineCanvas);

    fireEvent.doubleClick(timelineCanvas, { clientY: TIMELINE_TOP + 252 });

    const quickAddHeading = await screen.findByRole("heading", { name: /quick add event/i });
    const quickAddForm = quickAddHeading.closest("form");
    if (!quickAddForm) {
      throw new Error("Expected quick add form");
    }

    await user.type(within(quickAddForm).getByPlaceholderText(/event title/i), "Ops Review");
    await user.click(within(quickAddForm).getByRole("button", { name: /^Add Event$/i }));

    expect(eventApiCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: "Ops Review",
      type: "MEETING",
      date: "2026-04-16",
      startTime: "10:00",
      endTime: "11:00",
      allDay: false,
    }));

    expect(await screen.findByRole("button", { name: /Ops Review/i })).toBeInTheDocument();
    expect(calendarApiGetEvents).toHaveBeenCalledWith("2026-04-13", "2026-04-20");
  });

  it("updates only manual events during agenda stream drag reschedule and keeps the sidebar in sync", async () => {
    const user = userEvent.setup();

    render(<CalendarView initialData={buildCalendarBootstrapData()} />);

    await user.click(screen.getByRole("button", { name: /Ops Sync/i }));
    expect(screen.getByText(/Thursday, April 16, 2026 · 10:00 AM/i)).toBeInTheDocument();

    const laneToggle = screen.getByRole("button", { name: /Thursday, April 16, 2026/i });
    await user.click(laneToggle);

    const timelineCanvas = screen.getByTestId("expanded-timeline-canvas-2026-04-16");
    setTimelineRect(timelineCanvas);

    fireEvent.mouseDown(screen.getByTestId("expanded-event-manual-evt"), { clientY: TIMELINE_TOP + 252 });
    fireEvent.mouseMove(window, { clientY: TIMELINE_TOP + 336 });
    fireEvent.mouseUp(window, { clientY: TIMELINE_TOP + 336 });

    expect(eventApiUpdate).toHaveBeenCalledWith("evt-1", expect.objectContaining({
      date: "2026-04-16",
      startTime: "11:00",
      endTime: "12:00",
      allDay: false,
    }));

    expect(await screen.findByText(/Thursday, April 16, 2026 · 11:00 AM/i)).toBeInTheDocument();

    const updateCallCount = eventApiUpdate.mock.calls.length;
    fireEvent.mouseDown(screen.getByTestId("expanded-event-quote-evt"), { clientY: TIMELINE_TOP + 336 });
    fireEvent.mouseMove(window, { clientY: TIMELINE_TOP + 420 });
    fireEvent.mouseUp(window, { clientY: TIMELINE_TOP + 420 });

    await user.click(screen.getByRole("button", { name: /Friday, April 17, 2026/i }));
    fireEvent.mouseDown(screen.getAllByRole("button", { name: /Sam's Birthday/i })[0], { clientY: TIMELINE_TOP + 100 });
    fireEvent.mouseMove(window, { clientY: TIMELINE_TOP + 180 });
    fireEvent.mouseUp(window, { clientY: TIMELINE_TOP + 180 });

    expect(eventApiUpdate).toHaveBeenCalledTimes(updateCallCount);
  });
});

describe("AgendaStreamView", () => {
  it("renders from direct fullcalendar-like props plus local test data", () => {
    render(
      <AgendaStreamView
        {...buildFullCalendarLikeViewProps()}
        agendaEvents={buildAgendaEvents()}
        now={NON_MATCHING_NOW}
      />,
    );

    expect(screen.getByRole("heading", { name: "April 2026" })).toBeTruthy();
    expect(screen.getByText("Week of Apr 13, 2026")).toBeTruthy();
    expect(screen.getAllByText("3 events").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,250")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Show past" }) as HTMLInputElement).checked).toBe(true);

    expect(screen.getByText("Jump to")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();

    expect(screen.getByRole("button", { name: /Monday, April 13, 2026/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /Tuesday, April 14, 2026/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /Wednesday, April 15, 2026/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /Thursday, April 16, 2026/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /Friday, April 17, 2026/i }).getAttribute("aria-expanded")).toBe("false");

    expect(screen.getAllByText("Board Lunch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ops Sync").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rental Walkthrough").length).toBeGreaterThan(0);
    expect(screen.getByText("9:00 AM - 10:30 AM")).toBeTruthy();
  });

  it("expands a lane into the hour grid scaffold when its plate is clicked", async () => {
    const user = userEvent.setup();

    render(
      <AgendaStreamView
        weekStart="2026-04-13"
        displayMonth={new Date("2026-04-01T12:00:00.000Z")}
        events={buildCalendarEvents()}
        now={NOW}
      />,
    );

    const laneToggle = screen.getByRole("button", { name: /Thursday, April 16, 2026/i });
    await user.click(laneToggle);

    expect(laneToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Double-click empty space to add")).toBeTruthy();
    expect(screen.getByText("Drag event to reschedule")).toBeTruthy();

    const expandedLane = laneToggle.closest("section");
    expect(expandedLane).not.toBeNull();
    if (!expandedLane) {
      throw new Error("Expected expanded lane section");
    }

    expect(within(expandedLane).getByText("7 AM")).toBeTruthy();
    expect(within(expandedLane).getByText("12 PM")).toBeTruthy();
    expect(within(expandedLane).getByText("Ops Sync")).toBeTruthy();
  });

  it("syncs the displayed month when the parent-driven fullcalendar date profile changes", () => {
    const { rerender } = render(
      <AgendaStreamView
        {...buildFullCalendarLikeViewProps()}
        agendaEvents={buildAgendaEvents()}
        now={NON_MATCHING_NOW}
      />,
    );

    expect(screen.getAllByText("April 2026").length).toBeGreaterThan(0);
    expect(screen.getByText("Week of Apr 13, 2026")).toBeTruthy();

    rerender(
      <AgendaStreamView
        {...buildMayFullCalendarLikeViewProps()}
        agendaEvents={buildAgendaEvents()}
        now={NON_MATCHING_NOW}
      />,
    );

    expect(screen.getAllByText("May 2026").length).toBeGreaterThan(1);
    expect(screen.getByText("Week of May 4, 2026")).toBeTruthy();
  });

  it("keeps all-day and off-hours events in cards while excluding them from the timeline display", async () => {
    const user = userEvent.setup();

    render(
      <AgendaStreamView
        weekStart="2026-04-13"
        agendaEvents={buildBoundaryAgendaEvents()}
        now={NOW}
      />,
    );

    expect(screen.getAllByText("All-day Conference").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sunrise Setup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evening Breakdown").length).toBeGreaterThan(0);

    const laneToggle = screen.getByRole("button", { name: /Monday, April 13, 2026/i });
    await user.click(laneToggle);

    const expandedLane = laneToggle.closest("section");
    expect(expandedLane).not.toBeNull();
    if (!expandedLane) {
      throw new Error("Expected expanded lane section");
    }

    expect(within(expandedLane).queryByTestId("expanded-event-all-day-1")).toBeNull();
    expect(within(expandedLane).queryByTestId("expanded-event-early-1")).toBeNull();
    expect(within(expandedLane).queryByTestId("expanded-event-late-1")).toBeNull();
    expect(within(expandedLane).getByText("All day")).toBeTruthy();
  });

  it("grows the compact track for dense overlaps and keeps later solo expanded events full width", async () => {
    const user = userEvent.setup();

    render(
      <AgendaStreamView
        weekStart="2026-04-13"
        agendaEvents={buildDenseAgendaEvents()}
        now={NOW}
      />,
    );

    const compactTrack = screen.getByTestId("compact-track-2026-04-14");
    expect(compactTrack.getAttribute("style") ?? "").toContain("height: 66px");

    const laneToggle = screen.getByRole("button", { name: /Tuesday, April 14, 2026/i });
    await user.click(laneToggle);

    const overlapEvent = screen.getByTestId("expanded-event-overlap-a");
    const soloEvent = screen.getByTestId("expanded-event-solo-late");

    expect(overlapEvent.getAttribute("style") ?? "").toContain("width: calc(33.3333% - 8px)");
    expect(soloEvent.getAttribute("style") ?? "").toContain("width: calc(100% - 8px)");
  });
});

describe("MiniMonth agenda stream extensions", () => {
  it("renders density dots and a week-row jump affordance without breaking day selection", async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    const onMonthChange = vi.fn();
    const onWeekRowClick = vi.fn();

    render(
      <MiniMonth
        displayMonth={new Date("2026-04-01T12:00:00.000Z")}
        onMonthChange={onMonthChange}
        onDateClick={onDateClick}
        activeRange={{ start: "2026-04-13", end: "2026-04-18" }}
        densityByDate={{
          "2026-04-13": 1,
          "2026-04-14": 2,
          "2026-04-16": 4,
        }}
        selectedWeekStart="2026-04-13"
        onWeekRowClick={onWeekRowClick}
      />,
    );

    expect(screen.getAllByLabelText(/Jump to week of/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Events on April 16, 2026: 4")).toBeTruthy();

    await user.click(screen.getByLabelText("Jump to week of April 13, 2026"));
    expect(onWeekRowClick).toHaveBeenCalledWith("2026-04-13");

    await user.click(screen.getByLabelText("April 16, 2026"));
    expect(onDateClick).toHaveBeenCalledWith("2026-04-16");
    expect(onMonthChange).not.toHaveBeenCalled();
  });
});
