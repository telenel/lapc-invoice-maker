import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/user-preference/repository", () => ({
  findByUserAndKey: vi.fn(),
  upsert: vi.fn(),
  deleteByUserAndKey: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  safePublish: vi.fn(),
}));

import * as userPreferenceRepository from "@/domains/user-preference/repository";
import { safePublish } from "@/lib/sse";
import { userPreferenceService } from "@/domains/user-preference/service";

const mockRepository = vi.mocked(userPreferenceRepository, true);
const mockSafePublish = vi.mocked(safePublish);

describe("userPreferenceService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns null when a preference has not been saved", async () => {
    mockRepository.findByUserAndKey.mockResolvedValue(null);

    await expect(userPreferenceService.get("user-1", "ui-scale")).resolves.toBeNull();
  });

  it("maps stored preference values to the API response shape", async () => {
    mockRepository.findByUserAndKey.mockResolvedValue({
      key: "ui-scale",
      value: "1.2",
      updatedAt: new Date("2026-04-03T12:00:00.000Z"),
    } as never);

    await expect(userPreferenceService.get("user-1", "ui-scale")).resolves.toEqual({
      key: "ui-scale",
      value: "1.2",
      updatedAt: "2026-04-03T12:00:00.000Z",
    });
  });

  it("upserts preferences and publishes a change event", async () => {
    mockRepository.upsert.mockResolvedValue({
      key: "ui-scale",
      value: "1.2",
      updatedAt: new Date("2026-04-03T12:00:00.000Z"),
    } as never);

    const result = await userPreferenceService.save("user-1", "ui-scale", "1.2");

    expect(mockRepository.upsert).toHaveBeenCalledWith("user-1", "ui-scale", "1.2");
    expect(mockSafePublish).toHaveBeenCalledWith("user-1", {
      type: "user-preference-changed",
      key: "ui-scale",
      deleted: false,
    });
    expect(result).toEqual({
      key: "ui-scale",
      value: "1.2",
      updatedAt: "2026-04-03T12:00:00.000Z",
    });
  });

  it("publishes deletion events when a preference is removed", async () => {
    mockRepository.deleteByUserAndKey.mockResolvedValue({ count: 1 } as never);

    await userPreferenceService.delete("user-1", "ui-scale");

    expect(mockRepository.deleteByUserAndKey).toHaveBeenCalledWith("user-1", "ui-scale");
    expect(mockSafePublish).toHaveBeenCalledWith("user-1", {
      type: "user-preference-changed",
      key: "ui-scale",
      deleted: true,
    });
  });
});
