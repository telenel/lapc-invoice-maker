import { beforeEach, describe, expect, it, vi } from "vitest";
import { listViews } from "@/domains/product/views-api";

describe("listViews", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces backend error detail for saved-view load failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "saved_searches relation unavailable" }),
    }));

    await expect(listViews()).rejects.toThrow(
      "GET /api/products/views failed (500): saved_searches relation unavailable",
    );
  });
});
