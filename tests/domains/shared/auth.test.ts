// tests/domains/shared/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import { withAuth, withAdmin } from "@/domains/shared/auth";
import { NextResponse } from "next/server";

const mockGetServerSession = vi.mocked(getServerSession);

function makeRequest(url = "http://localhost/api/test") {
  return new NextRequest(url);
}

describe("withAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with session when authenticated", async () => {
    const session = { user: { id: "u1", name: "Test", role: "user" } };
    mockGetServerSession.mockResolvedValue(session);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const req = makeRequest();
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(req, session, undefined);
  });
});

describe("withAdmin", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withAdmin(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when not admin", async () => {
    const session = { user: { id: "u1", name: "Test", role: "user" } };
    mockGetServerSession.mockResolvedValue(session);
    const handler = vi.fn();
    const wrapped = withAdmin(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when admin", async () => {
    const session = { user: { id: "u1", name: "Test", role: "admin" } };
    mockGetServerSession.mockResolvedValue(session);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAdmin(handler);
    const req = makeRequest();
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(req, session, undefined);
  });
});
