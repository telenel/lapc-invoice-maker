import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/admin/service", () => ({
  adminService: {
    batchInvoices: vi.fn(),
    batchQuotes: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { adminService } from "@/domains/admin/service";
import { PATCH as PATCH_INVOICES } from "@/app/api/admin/invoices/batch/route";
import { PATCH as PATCH_QUOTES } from "@/app/api/admin/quotes/batch/route";

describe("PATCH /api/admin/invoices/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
  });

  it("returns 400 when ids is not a non-empty array", async () => {
    const response = await PATCH_INVOICES(
      new NextRequest("http://localhost/api/admin/invoices/batch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: "bad", action: "delete" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "ids must be a non-empty array" });
    expect(adminService.batchInvoices).not.toHaveBeenCalled();
  });

  it("returns 400 when ids contains non-string values", async () => {
    const response = await PATCH_INVOICES(
      new NextRequest("http://localhost/api/admin/invoices/batch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["inv-1", 42], action: "delete" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "ids must contain valid values" });
    expect(adminService.batchInvoices).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/quotes/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
  });

  it("returns 400 for unsupported action", async () => {
    const response = await PATCH_QUOTES(
      new NextRequest("http://localhost/api/admin/quotes/batch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["q1"], action: "bad" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid action" });
    expect(adminService.batchQuotes).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status value", async () => {
    const response = await PATCH_QUOTES(
      new NextRequest("http://localhost/api/admin/quotes/batch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["q1"], action: "status", value: "BAD" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid status value" });
    expect(adminService.batchQuotes).not.toHaveBeenCalled();
  });
});
