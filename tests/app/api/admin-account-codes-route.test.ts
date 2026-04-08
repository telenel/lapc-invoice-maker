import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/admin/service", () => ({
  adminService: {
    createAccountCode: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { adminService } from "@/domains/admin/service";
import { POST } from "@/app/api/admin/account-codes/route";

describe("POST /api/admin/account-codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
  });

  it("rejects non-string staffId values", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/account-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: 123, accountCode: "CODE" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Staff member is required" });
    expect(adminService.createAccountCode).not.toHaveBeenCalled();
  });

  it("normalizes staffId and accountCode before createAccountCode", async () => {
    vi.mocked(adminService.createAccountCode).mockResolvedValue({
      id: "ac1",
      staffId: "s1",
      accountCode: "CODE",
      description: "desc",
      createdAt: "2026-01-01T00:00:00.000Z",
      staff: { id: "s1", name: "Staff", department: "Dept" },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/admin/account-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: "  s1  ",
          accountCode: " CODE  ",
          description: "  desc  ",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(adminService.createAccountCode).toHaveBeenCalledWith({
      staffId: "s1",
      accountCode: "CODE",
      description: "desc",
    });
  });
});
