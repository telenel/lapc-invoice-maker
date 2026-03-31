import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { notificationService } from "@/domains/notification/service";
import { prisma } from "@/lib/prisma";
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
      user: {
        findMany: vi.fn(),
      },
    } as never) as never);

    await checkAndSendReminders();

    expect(notificationService.createAndPublish).not.toHaveBeenCalled();
  });

  it("uses a transaction-scoped advisory lock before scanning reminders", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
      event: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendReminders();

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.event.findMany).toHaveBeenCalledOnce();
  });
});
