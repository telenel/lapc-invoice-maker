import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";

function makeRequest(authHeader?: string) {
  return new NextRequest("http://localhost/api/internal/jobs/test", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

describe("withCronAuth", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    const response = await withCronAuth(handler)(makeRequest());

    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid bearer tokens", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    const response = await withCronAuth(handler)(makeRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the handler when the bearer token matches", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const request = makeRequest("Bearer expected-secret");

    await withCronAuth(handler)(request);

    expect(handler).toHaveBeenCalledWith(request);
  });
});
