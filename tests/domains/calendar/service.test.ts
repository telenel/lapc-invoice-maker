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
import { getCalendarBootstrapData, listCalendarEventsForRange } from "@/domains/calendar/service";

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

  it("bootstraps the desktop agenda range from the selected Monday business week", async () => {
    await getCalendarBootstrapData(new Date("2026-04-22T19:00:00.000Z"));

    expect(eventService.listForDateRange).toHaveBeenCalledWith(
      new Date("2026-04-20T00:00:00.000Z"),
      new Date("2026-04-27T00:00:00.000Z"),
    );
  });
});
