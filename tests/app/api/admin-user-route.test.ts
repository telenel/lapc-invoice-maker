import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/admin/service", () => ({
  adminService: {
    resetPassword: vi.fn(),
    updateUser: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { adminService } from "@/domains/admin/service";
import { PUT as updateUser } from "@/app/api/admin/users/[id]/route";

describe("PUT /api/admin/users/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
  });

  it("requires resetPassword to be explicitly true", async () => {
    const response = await updateUser(
      new NextRequest("http://localhost/api/admin/users/u1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: "yes" }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "resetPassword must be true to trigger a reset",
    });
    expect(adminService.resetPassword).not.toHaveBeenCalled();
  });

  it("resets password when resetPassword is true", async () => {
    vi.mocked(adminService.resetPassword).mockResolvedValue({
      id: "u1",
      temporaryPassword: "temp",
      name: "User One",
      username: "user1",
      email: null,
      role: "user",
      active: true,
      setupComplete: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    } as never);

    const response = await updateUser(
      new NextRequest("http://localhost/api/admin/users/u1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true, name: "Ignored" }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ temporaryPassword: "temp" });
    expect(adminService.resetPassword).toHaveBeenCalledWith("u1");
    expect(adminService.updateUser).not.toHaveBeenCalled();
  });
});
