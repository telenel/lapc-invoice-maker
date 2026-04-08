import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/staff/service", () => ({
  staffService: {
    list: vi.fn(),
    listPaginated: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { staffService } from "@/domains/staff/service";
import { GET } from "@/app/api/staff/route";

describe("GET /api/staff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(staffService.listPaginated).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);
    vi.mocked(staffService.list).mockResolvedValue([]);
  });

  it("returns 400 for non-integer page", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/staff?paginated=true&page=2.5"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid page value" });
  });

  it("returns 400 for non-integer pageSize", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/staff?paginated=true&pageSize=abc"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid pageSize value" });
  });

  it("returns 400 for zero page", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/staff?paginated=true&page=0"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid page value" });
  });

  it("passes normalized pagination values to staff list", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/staff?paginated=true&page=3&pageSize=150"),
    );

    expect(response.status).toBe(200);
    expect(staffService.listPaginated).toHaveBeenCalledWith({
      search: undefined,
      page: 3,
      pageSize: 100,
    });
  });
});
