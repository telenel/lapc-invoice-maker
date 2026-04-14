import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(),
    },
    staff: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/domains/event/service", () => ({
  eventService: {
    listForDateRange: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { eventService } from "@/domains/event/service";
import { listCalendarEventsForRange } from "@/domains/calendar/service";

describe("calendar service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([] as never);
    vi.mocked(eventService.listForDateRange).mockResolvedValue([] as never);
  });

  it("excludes archived catering quotes from calendar events", async () => {
    await listCalendarEventsForRange("2026-04-14", "2026-04-15");

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "QUOTE",
          isCateringEvent: true,
          archivedAt: null,
        }),
      }),
    );
  });
});
