import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/textbook-requisition/service", () => ({
  requisitionService: {
    list: vi.fn(),
    create: vi.fn(),
    submitPublic: vi.fn(),
    lookupByEmployeeId: vi.fn(),
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { GET as listRequisitions, POST as createRequisition } from "@/app/api/textbook-requisitions/route";
import { POST as submitRequisition } from "@/app/api/textbook-requisitions/submit/route";
import { GET as lookupRequisition } from "@/app/api/textbook-requisitions/lookup/route";
import { checkRateLimit } from "@/lib/rate-limit";

describe("GET /api/textbook-requisitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "staff-user", role: "user" },
    } as never);
    vi.mocked(requisitionService.list).mockResolvedValue({
      requisitions: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);
  });

  it("normalizes search and term filters", async () => {
    const response = await listRequisitions(
      new NextRequest(
        "http://localhost/api/textbook-requisitions?search=%20Alice%20&term=%20Fall%20&page=2&pageSize=5&status= PENDING ",
      ),
    );

    expect(response.status).toBe(200);
    expect(requisitionService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "Alice",
        term: "Fall",
        page: 2,
        pageSize: 5,
        status: "PENDING",
      }),
    );
  });

  it("rejects a non-integer page", async () => {
    const response = await listRequisitions(
      new NextRequest("http://localhost/api/textbook-requisitions?page=2.5"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid page value" });
    expect(requisitionService.list).not.toHaveBeenCalled();
  });

  it("rejects a non-integer pageSize", async () => {
    const response = await listRequisitions(
      new NextRequest("http://localhost/api/textbook-requisitions?page=1&pageSize=abc"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid pageSize value" });
    expect(requisitionService.list).not.toHaveBeenCalled();
  });

  it("rejects an invalid year value", async () => {
    const response = await listRequisitions(
      new NextRequest("http://localhost/api/textbook-requisitions?year=2026.5"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid year value" });
    expect(requisitionService.list).not.toHaveBeenCalled();
  });
});

describe("POST /api/textbook-requisitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "staff-user", role: "admin" },
    } as never);
    vi.mocked(requisitionService.create).mockResolvedValue({
      id: "r1",
    } as never);
  });

  it("rejects non-object request bodies", async () => {
    const response = await createRequisition(
      new NextRequest("http://localhost/api/textbook-requisitions", {
        method: "POST",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    expect(requisitionService.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/textbook-requisitions/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requisitionService.submitPublic).mockResolvedValue({
      id: "r1",
      submittedAt: "2026-03-01T00:00:00.000Z",
      department: "ENG",
      course: "ENG-101",
      term: "Fall",
      reqYear: 2026,
      bookCount: 1,
    } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    } as never);
  });

  it("rejects non-object public submission payloads", async () => {
    const response = await submitRequisition(
      new NextRequest("http://localhost/api/textbook-requisitions/submit", {
        method: "POST",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    expect(requisitionService.submitPublic).not.toHaveBeenCalled();
  });
});

describe("GET /api/textbook-requisitions/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    } as never);
    vi.mocked(requisitionService.lookupByEmployeeId).mockResolvedValue([] as never);
  });

  it("returns 400 for invalid employee IDs", async () => {
    const response = await lookupRequisition(
      new NextRequest("http://localhost/api/textbook-requisitions/lookup?employeeId=abc123"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid employee ID",
      details: expect.any(Object),
    });
    expect(requisitionService.lookupByEmployeeId).not.toHaveBeenCalled();
  });
});
