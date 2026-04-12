import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getEvents } = vi.hoisted(() => ({
  getEvents: vi.fn(),
}));

vi.mock("@/domains/calendar/api-client", () => ({
  calendarApi: {
    getEvents,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import {
  TodaysEvents,
  __resetTodaysEventsCacheForTests,
} from "@/components/dashboard/todays-events";

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("TodaysEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T18:00:00.000Z"));
    vi.clearAllMocks();
    __resetTodaysEventsCacheForTests();
    getEvents.mockResolvedValue([
      {
        id: "evt-1",
        title: "Board Lunch",
        start: "2026-04-12T18:00:00.000Z",
        end: "2026-04-12T19:00:00.000Z",
        allDay: false,
        color: "#fff7ed",
        borderColor: "#f97316",
        source: "catering",
        extendedProps: {
          type: "MEETING",
          quoteId: "quote-1",
          location: "Library",
          headcount: 12,
          setupTime: "10:30",
          takedownTime: "12:30",
        },
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the Los Angeles day window when fetching events", async () => {
    await act(async () => {
      render(<TodaysEvents />);
      await flushAsyncWork();
    });

    expect(getEvents).toHaveBeenCalledWith("2026-04-12", "2026-04-13");
  });

  it("reuses cached events across remounts without refetching", async () => {
    let firstRender!: ReturnType<typeof render>;

    await act(async () => {
      firstRender = render(<TodaysEvents />);
      await flushAsyncWork();
    });

    expect(getEvents).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Board Lunch/i)).toBeInTheDocument();

    firstRender.unmount();

    render(<TodaysEvents />);

    expect(screen.getByText(/Board Lunch/i)).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledTimes(1);
  });
});
