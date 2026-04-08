import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { POST } from "@/app/api/user-quick-picks/route";

describe("POST /api/user-quick-picks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1" },
    } as never);
  });

  it("returns 400 when request body is malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user-quick-picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
  });

  it("returns 400 when request body is not an object", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user-quick-picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify("bad"),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
  });

  it("returns 400 when required fields are invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user-quick-picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: "Item",
          unitPrice: "bad-price",
          department: "Office",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing required fields" });
  });
});
