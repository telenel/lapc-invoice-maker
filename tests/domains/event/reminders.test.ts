import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/event/repository", () => ({
  findDueReminders: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      findMany: vi.fn(),
    },
  },
}));

import * as eventRepository from "@/domains/event/repository";
import { notificationService } from "@/domains/notification/service";
import { prisma } from "@/lib/prisma";
import { checkAndSendReminders } from "@/domains/event/reminders";

const mockRepo = vi.mocked(eventRepository);

describe("checkAndSendReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when another process already holds the advisory lock", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ acquired: false }] as never);

    await checkAndSendReminders();

    expect(mockRepo.findDueReminders).not.toHaveBeenCalled();
    expect(notificationService.createAndPublish).not.toHaveBeenCalled();
  });

  it("releases the advisory lock after processing", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ acquired: true }] as never)
      .mockResolvedValueOnce([] as never);
    mockRepo.findDueReminders.mockResolvedValue([] as never);

    await checkAndSendReminders();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
