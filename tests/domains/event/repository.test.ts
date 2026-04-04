import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import * as eventRepository from "@/domains/event/repository";

// eslint-disable-next-line @typescript-eslint/no-explicit-unknown -- Prisma generic overloads prevent vi.mocked from resolving mock methods
const mockPrisma = prisma as unknown as {
  event: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe("eventRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an event with correct data", async () => {
    const input = {
      title: "Staff Meeting",
      type: "MEETING" as const,
      date: new Date("2026-03-30"),
      color: "#3b82f6",
      allDay: false,
      startTime: "09:00",
      endTime: "10:00",
      reminderMinutes: 60,
      createdBy: "user-1",
    };
    const expected = {
      id: "evt-1",
      ...input,
      description: null,
      location: null,
      recurrence: null,
      recurrenceEnd: null,
      reminderSentDates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.event.create.mockResolvedValue(expected as never);
    const result = await eventRepository.create(input);
    expect(mockPrisma.event.create).toHaveBeenCalledWith({ data: input });
    expect(result).toEqual(expected);
  });

  it("finds events within a date range", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    await eventRepository.findByDateRange(new Date("2026-03-01"), new Date("2026-03-31"));
    expect(mockPrisma.event.findMany).toHaveBeenCalledWith({
      where: { date: { gte: new Date("2026-03-01"), lte: new Date("2026-03-31") } },
      orderBy: { date: "asc" },
    });
  });

  it("finds event by id", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);
    const result = await eventRepository.findById("evt-1");
    expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({ where: { id: "evt-1" } });
    expect(result).toBeNull();
  });

  it("updates an event", async () => {
    mockPrisma.event.update.mockResolvedValue({ id: "evt-1", title: "Updated" } as never);
    await eventRepository.update("evt-1", { title: "Updated" });
    expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: "evt-1" }, data: { title: "Updated" } });
  });

  it("deletes an event", async () => {
    mockPrisma.event.delete.mockResolvedValue({} as never);
    await eventRepository.remove("evt-1");
    expect(mockPrisma.event.delete).toHaveBeenCalledWith({ where: { id: "evt-1" } });
  });
});
