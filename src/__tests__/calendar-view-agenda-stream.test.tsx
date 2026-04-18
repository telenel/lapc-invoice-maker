import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MiniMonth } from "@/components/calendar/mini-month";
import { AgendaStreamView } from "@/domains/calendar/views/agenda-stream/AgendaStreamView";
import type { AgendaStreamEvent } from "@/domains/calendar/views/agenda-stream/types";
import type { CalendarEventItem } from "@/domains/event/types";

const NOW = new Date("2026-04-16T17:45:00.000Z");

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

describe("AgendaStreamView", () => {
  it("renders the desktop agenda stream shell with top bar, rail, lanes, and cards", () => {
    render(
      <AgendaStreamView
        weekStart="2026-04-13"
        displayMonth={new Date("2026-04-01T12:00:00.000Z")}
        agendaEvents={buildAgendaEvents()}
        now={NOW}
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
