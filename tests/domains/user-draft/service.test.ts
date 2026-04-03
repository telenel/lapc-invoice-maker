import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/user-draft/repository", () => ({
  findByUserAndRouteKey: vi.fn(),
  upsert: vi.fn(),
  deleteByUserAndRouteKey: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  safePublish: vi.fn(),
}));

import * as userDraftRepository from "@/domains/user-draft/repository";
import { safePublish } from "@/lib/sse";
import { userDraftService } from "@/domains/user-draft/service";

const mockRepository = vi.mocked(userDraftRepository, true);
const mockSafePublish = vi.mocked(safePublish);

describe("userDraftService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no draft exists", async () => {
    mockRepository.findByUserAndRouteKey.mockResolvedValue(null);

    await expect(userDraftService.get("user-1", "/quotes/new")).resolves.toBeNull();
  });

  it("deletes expired drafts before returning", async () => {
    mockRepository.findByUserAndRouteKey.mockResolvedValue({
      routeKey: "/quotes/new",
      data: { notes: "stale" },
      savedAt: new Date("2026-04-01T00:00:00.000Z"),
      expiresAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    } as never);

    vi.setSystemTime(new Date("2026-04-03T00:00:00.000Z"));

    await expect(userDraftService.get("user-1", "/quotes/new")).resolves.toBeNull();
    expect(mockRepository.deleteByUserAndRouteKey).toHaveBeenCalledWith("user-1", "/quotes/new");
  });

  it("saves drafts with a seven day expiry and publishes a change event", async () => {
    vi.setSystemTime(new Date("2026-04-03T08:00:00.000Z"));
    mockRepository.upsert.mockResolvedValue({
      routeKey: "/quotes/new",
      data: { notes: "draft" },
      savedAt: new Date("2026-04-03T08:00:00.000Z"),
      expiresAt: new Date("2026-04-10T08:00:00.000Z"),
      updatedAt: new Date("2026-04-03T08:00:00.000Z"),
    } as never);

    const result = await userDraftService.save("user-1", "/quotes/new", { notes: "draft" });

    expect(mockRepository.upsert).toHaveBeenCalledWith(
      "user-1",
      "/quotes/new",
      { notes: "draft" },
      new Date("2026-04-03T08:00:00.000Z"),
      new Date("2026-04-10T08:00:00.000Z"),
    );
    expect(mockSafePublish).toHaveBeenCalledWith("user-1", {
      type: "draft-changed",
      routeKey: "/quotes/new",
      savedAt: "2026-04-03T08:00:00.000Z",
    });
    expect(result).toEqual({
      routeKey: "/quotes/new",
      data: { notes: "draft" },
      savedAt: "2026-04-03T08:00:00.000Z",
      expiresAt: "2026-04-10T08:00:00.000Z",
      updatedAt: "2026-04-03T08:00:00.000Z",
    });
  });

  it("publishes deletion events when drafts are cleared", async () => {
    mockRepository.deleteByUserAndRouteKey.mockResolvedValue({ count: 1 } as never);

    await userDraftService.delete("user-1", "/quotes/new");

    expect(mockRepository.deleteByUserAndRouteKey).toHaveBeenCalledWith("user-1", "/quotes/new");
    expect(mockSafePublish).toHaveBeenCalledWith("user-1", {
      type: "draft-changed",
      routeKey: "/quotes/new",
      deleted: true,
    });
  });
});
