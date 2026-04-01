import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sse", () => ({
  publish: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/sse";
import { checkAndSendReminders } from "@/domains/event/reminders";

describe("checkAndSendReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when another process already holds the advisory lock", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: false }]),
      event: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    } as never) as never);

    await checkAndSendReminders();

    expect(publish).not.toHaveBeenCalled();
  });

  it("persists reminder notifications inside the transaction and publishes after commit", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
      event: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            reminderMinutes: 15,
            reminderSentDates: [],
            date: new Date("2026-03-31T00:30:00.000Z"),
            startTime: "00:30",
            title: "Test Event",
            location: "Room 101",
          },
        ]),
        update: vi.fn(),
      },
      notification: {
        create: vi.fn().mockResolvedValue({
          id: "notif-1",
          type: "EVENT_REMINDER",
          title: "Reminder: Test Event",
          message: "Starting at 00:30 \u2014 Room 101",
          quoteId: null,
          read: false,
          createdAt: new Date("2026-03-31T00:15:00.000Z"),
        }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: "user-1" }]),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendReminders();

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.event.findMany).toHaveBeenCalledOnce();
    expect(tx.notification.create).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        id: "notif-1",
        type: "EVENT_REMINDER",
      }),
    );
  });
});
