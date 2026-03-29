import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/event/repository", () => ({
  create: vi.fn(),
  findByDateRange: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findDueReminders: vi.fn(),
}));

import * as eventRepository from "@/domains/event/repository";
import { eventService } from "@/domains/event/service";

const mockRepo = vi.mocked(eventRepository);

const baseEvent = {
  id: "evt-1",
  title: "Staff Meeting",
  description: null,
  type: "MEETING",
  date: new Date("2026-03-30T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  location: null,
  color: "#3b82f6",
  recurrence: null,
  recurrenceEnd: null,
  reminderMinutes: 60,
  reminderSentDates: [],
  createdBy: "user-1",
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
};

describe("eventService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("auto-assigns color from type", async () => {
      mockRepo.create.mockResolvedValue(baseEvent as never);

      await eventService.create(
        { title: "Staff Meeting", type: "MEETING", date: "2026-03-30" },
        "user-1"
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: "#3b82f6", type: "MEETING" })
      );
    });

    it("defaults reminderMinutes to 60 when not provided", async () => {
      mockRepo.create.mockResolvedValue(baseEvent as never);

      await eventService.create(
        { title: "Staff Meeting", type: "MEETING", date: "2026-03-30" },
        "user-1"
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reminderMinutes: 60 })
      );
    });

    it("uses provided reminderMinutes when specified", async () => {
      mockRepo.create.mockResolvedValue({ ...baseEvent, reminderMinutes: 30 } as never);

      await eventService.create(
        { title: "Staff Meeting", type: "MEETING", date: "2026-03-30", reminderMinutes: 30 },
        "user-1"
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reminderMinutes: 30 })
      );
    });
  });

  describe("expandRecurring", () => {
    it("expands weekly event within range (3 occurrences for Mar 9-23, weekly from Mar 2)", () => {
      const event = {
        ...baseEvent,
        date: new Date("2026-03-02T00:00:00.000Z"),
        recurrence: "WEEKLY",
        recurrenceEnd: null,
      };

      const results = eventService.expandRecurring(
        event as never,
        new Date("2026-03-09T00:00:00.000Z"),
        new Date("2026-03-23T00:00:00.000Z")
      );

      expect(results).toHaveLength(3);
      expect(results[0].start).toBe("2026-03-09T09:00:00");
      expect(results[1].start).toBe("2026-03-16T09:00:00");
      expect(results[2].start).toBe("2026-03-23T09:00:00");
    });

    it("stops at recurrenceEnd (5 occurrences for daily Mar 1-5)", () => {
      const event = {
        ...baseEvent,
        date: new Date("2026-03-01T00:00:00.000Z"),
        recurrence: "DAILY",
        recurrenceEnd: new Date("2026-03-05T00:00:00.000Z"),
      };

      const results = eventService.expandRecurring(
        event as never,
        new Date("2026-03-01T00:00:00.000Z"),
        new Date("2026-03-31T00:00:00.000Z")
      );

      expect(results).toHaveLength(5);
      expect(results[0].start).toBe("2026-03-01T09:00:00");
      expect(results[4].start).toBe("2026-03-05T09:00:00");
    });

    it("returns single occurrence for non-recurring event in range", () => {
      const event = {
        ...baseEvent,
        date: new Date("2026-03-15T00:00:00.000Z"),
        recurrence: null,
        recurrenceEnd: null,
      };

      const results = eventService.expandRecurring(
        event as never,
        new Date("2026-03-01T00:00:00.000Z"),
        new Date("2026-03-31T00:00:00.000Z")
      );

      expect(results).toHaveLength(1);
      expect(results[0].start).toBe("2026-03-15T09:00:00");
      expect(results[0].source).toBe("manual");
    });

    it("returns empty array for non-recurring event outside range", () => {
      const event = {
        ...baseEvent,
        date: new Date("2026-04-15T00:00:00.000Z"),
        recurrence: null,
        recurrenceEnd: null,
      };

      const results = eventService.expandRecurring(
        event as never,
        new Date("2026-03-01T00:00:00.000Z"),
        new Date("2026-03-31T00:00:00.000Z")
      );

      expect(results).toHaveLength(0);
    });
  });
});
