import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { POST } from "@/app/api/setup/route";

describe("POST /api/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as never);
  });

  it("returns 400 when request body is malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/setup", {
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
      new NextRequest("http://localhost/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(["bad"]),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
  });

  it("returns 400 when name is not a string", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: 123,
          email: "admin@example.com",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Name is required" });
  });
});
