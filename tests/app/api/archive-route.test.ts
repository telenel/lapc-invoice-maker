import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/archive/service", () => ({
  archiveService: {
    list: vi.fn(),
    restore: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { archiveService } from "@/domains/archive/service";
import { GET } from "@/app/api/archive/route";
import { POST } from "@/app/api/archive/[id]/restore/route";

describe("GET /api/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(archiveService.list).mockResolvedValue({
      documents: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);
  });

  it("lists archived documents scoped to the current user for non-admins", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/archive?type=QUOTE&page=2&pageSize=10&search=vendor"),
    );

    expect(response.status).toBe(200);
    expect(archiveService.list).toHaveBeenCalledWith(
      {
        type: "QUOTE",
        search: "vendor",
        page: 2,
        pageSize: 10,
      },
      "u1",
      false,
    );
  });
});

describe("POST /api/archive/[id]/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(archiveService.restore).mockResolvedValue({
      id: "q1",
      type: "QUOTE",
    } as never);
  });

  it("restores an archived document for the requesting user", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/archive/q1/restore", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: " q1 " }) },
    );

    expect(response.status).toBe(200);
    expect(archiveService.restore).toHaveBeenCalledWith("q1", "u1", false);
  });
});
