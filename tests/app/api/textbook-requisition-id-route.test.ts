import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/textbook-requisition/service", () => ({
  requisitionService: {
    getById: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    archive: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { DELETE, GET, PATCH, PUT } from "@/app/api/textbook-requisitions/[id]/route";
import { POST as notifyRequisition } from "@/app/api/textbook-requisitions/[id]/notify/route";

const BASE_REQUISITION = {
  id: "req-1",
  createdBy: "staff-user",
};

describe("GET /api/textbook-requisitions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "staff-user", role: "user" },
    } as never);
    vi.mocked(requisitionService.getById).mockResolvedValue(BASE_REQUISITION as never);
  });

  it("normalizes a whitespace id", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/textbook-requisitions/%20req-1%20"),
      { params: Promise.resolve({ id: "  req-1  " }) },
    );

    expect(response.status).toBe(200);
    expect(requisitionService.getById).toHaveBeenCalledWith("req-1");
  });

  it("rejects an empty id", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/textbook-requisitions/%20"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid requisition id" });
    expect(requisitionService.getById).not.toHaveBeenCalled();
  });
});

describe("PUT /api/textbook-requisitions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "staff-user", role: "user" },
    } as never);
    vi.mocked(requisitionService.getById).mockResolvedValue(BASE_REQUISITION as never);
    vi.mocked(requisitionService.update).mockResolvedValue(BASE_REQUISITION as never);
  });

  it("rejects non-object payloads before validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/textbook-requisitions/req-1", {
        method: "PUT",
        body: JSON.stringify(["bad"]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "req-1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(requisitionService.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/textbook-requisitions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(requisitionService.getById).mockResolvedValue({
      ...BASE_REQUISITION,
      createdBy: "other-user",
    } as never);
    vi.mocked(requisitionService.updateStatus).mockResolvedValue(BASE_REQUISITION as never);
  });

  it("rejects non-object status payloads", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/textbook-requisitions/req-1", {
        method: "PATCH",
        body: "\"bad\"",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: " req-1 " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(requisitionService.updateStatus).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/textbook-requisitions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "staff-user", role: "user" },
    } as never);
    vi.mocked(requisitionService.getById).mockResolvedValue(BASE_REQUISITION as never);
    vi.mocked(requisitionService.archive).mockResolvedValue(undefined as never);
  });

  it("normalizes the id before archiving", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/textbook-requisitions/ req-1 "),
      { params: Promise.resolve({ id: "  req-1  " }) },
    );

    expect(response.status).toBe(200);
    expect(requisitionService.archive).toHaveBeenCalledWith("req-1", "staff-user");
  });
});

describe("POST /api/textbook-requisitions/:id/notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(requisitionService.getById).mockResolvedValue({
      ...BASE_REQUISITION,
      createdBy: "other-user",
    } as never);
    vi.mocked(requisitionService.sendNotification).mockResolvedValue({
      outcome: "sent",
      emailSent: true,
      requisition: BASE_REQUISITION as never,
    } as never);
  });

  it("rejects invalid email type values", async () => {
    const response = await notifyRequisition(
      new NextRequest("http://localhost/api/textbook-requisitions/req-1/notify", {
        method: "POST",
        body: JSON.stringify({ emailType: "bad" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "req-1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid email type" });
    expect(requisitionService.sendNotification).not.toHaveBeenCalled();
  });

  it("normalizes id before notifying", async () => {
    const response = await notifyRequisition(
      new NextRequest("http://localhost/api/textbook-requisitions/ req-1 /notify", {
        method: "POST",
        body: JSON.stringify({ emailType: "ordered" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "  req-1  " }) },
    );

    expect(response.status).toBe(200);
    expect(requisitionService.sendNotification).toHaveBeenCalledWith("req-1", "ordered", "admin-user");
  });

  it("rejects non-object notify payloads", async () => {
    const response = await notifyRequisition(
      new NextRequest("http://localhost/api/textbook-requisitions/req-1/notify", {
        method: "POST",
        body: JSON.stringify(["ordered"]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "req-1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(requisitionService.sendNotification).not.toHaveBeenCalled();
  });
});
