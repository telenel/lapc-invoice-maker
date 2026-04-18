import { describe, expect, it } from "vitest";
import {
  assignColumns,
  buildAgendaStreamDays,
  buildAgendaStreamStats,
  getAgendaSourceMeta,
  toAgendaStreamEvent,
} from "@/domains/calendar/views/agenda-stream/utils";

describe("agenda stream utils", () => {
  it("maps calendar events into minute-based agenda events", () => {
    const event = toAgendaStreamEvent({
      id: "quote-1",
      title: "Board Lunch",
      start: "2026-04-14T18:30:00.000Z",
      end: "2026-04-14T20:00:00.000Z",
      allDay: false,
      color: "#fff7ed",
      borderColor: "#f97316",
      textColor: "#f97316",
      source: "catering",
      extendedProps: {
        quoteId: "quote-1",
        quoteNumber: "QT-101",
        quoteStatus: "ACCEPTED",
        location: "Library",
        headcount: 18,
      },
    });

    expect(event).toMatchObject({
      id: "quote-1",
      dateKey: "2026-04-14",
      startMin: 11 * 60 + 30,
      durMin: 90,
      source: "catering",
      title: "Board Lunch",
      readOnly: true,
      metadata: {
        amount: null,
        quoteId: "quote-1",
        quoteNumber: "QT-101",
        quoteStatus: "ACCEPTED",
        location: "Library",
        headcount: 18,
      },
    });
  });

  it("derives manual sources from extendedProps.type and falls back to OTHER", () => {
    const typedManual = toAgendaStreamEvent({
      id: "manual-1",
      title: "Staff Meeting",
      start: "2026-04-14T17:00:00.000Z",
      end: "2026-04-14T18:00:00.000Z",
      allDay: false,
      color: "#3b82f6",
      borderColor: "#3b82f6",
      textColor: "#3b82f6",
      source: "manual",
      extendedProps: {
        type: "MEETING",
        description: "Weekly sync",
        location: "Conference Room",
      },
    });
    const fallbackManual = toAgendaStreamEvent({
      id: "manual-2",
      title: "Untyped Block",
      start: "2026-04-14T19:00:00.000Z",
      end: "2026-04-14T20:00:00.000Z",
      allDay: false,
      color: "#6b7280",
      borderColor: "#6b7280",
      textColor: "#6b7280",
      source: "manual",
      extendedProps: {},
    });

    expect(typedManual.source).toBe("MEETING");
    expect(typedManual.readOnly).toBe(false);
    expect(typedManual.metadata.description).toBe("Weekly sync");
    expect(fallbackManual.source).toBe("OTHER");
  });

  it("assigns side-by-side columns for overlapping events", () => {
    const events = assignColumns([
      { id: "a", startMin: 540, durMin: 60 },
      { id: "b", startMin: 555, durMin: 45 },
      { id: "c", startMin: 660, durMin: 30 },
    ]);

    expect(events.find((event) => event.id === "a")).toMatchObject({ col: 0, colCount: 2 });
    expect(events.find((event) => event.id === "b")).toMatchObject({ col: 1, colCount: 2 });
    expect(events.find((event) => event.id === "c")).toMatchObject({ col: 0, colCount: 2 });
  });

  it("computes week stats without dropping catering totals", () => {
    const stats = buildAgendaStreamStats([
      { source: "catering", amount: 1200 },
      { source: "manual", amount: null },
      { source: "birthday", amount: null },
      { source: "catering", amount: 800 },
    ]);

    expect(stats.totalEvents).toBe(4);
    expect(stats.cateringCount).toBe(2);
    expect(stats.cateringTotal).toBe(2000);
  });

  it("builds five weekday lanes and preserves empty days", () => {
    const days = buildAgendaStreamDays("2026-04-13", [
      { id: "evt-1", dateKey: "2026-04-14", startMin: 600, durMin: 30, source: "manual" },
    ]);

    expect(days).toHaveLength(5);
    expect(days[0].dateKey).toBe("2026-04-13");
    expect(days[1].events).toHaveLength(1);
    expect(days[4].events).toHaveLength(0);
  });

  it("returns stable source metadata for all supported sources", () => {
    expect(getAgendaSourceMeta("MEETING")).toMatchObject({ label: "Meeting", color: "#3b82f6" });
    expect(getAgendaSourceMeta("SEMINAR")).toMatchObject({ label: "Seminar", color: "#8b5cf6" });
    expect(getAgendaSourceMeta("VENDOR")).toMatchObject({ label: "Vendor", color: "#14b8a6" });
    expect(getAgendaSourceMeta("OTHER")).toMatchObject({ label: "Other", color: "#6b7280" });
    expect(getAgendaSourceMeta("catering")).toMatchObject({ label: "Catering", color: "#f97316" });
    expect(getAgendaSourceMeta("birthday")).toMatchObject({ label: "Birthday", color: "#ec4899" });
  });
});
