import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    markRead: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/domains/event/service", () => ({
  eventService: {
    getById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/domains/admin/service", () => ({
  adminService: {
    updateUser: vi.fn(),
    resetPassword: vi.fn(),
    deleteUser: vi.fn(),
    deleteAccountCode: vi.fn(),
  },
}));

vi.mock("@/domains/template/service", () => ({
  templateService: {
    getById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getViews: vi.fn(),
    getFollowUps: vi.fn(),
    createRevision: vi.fn(),
    duplicate: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { notificationService } from "@/domains/notification/service";
import { eventService } from "@/domains/event/service";
import { adminService } from "@/domains/admin/service";
import { templateService } from "@/domains/template/service";
import { invoiceService } from "@/domains/invoice/service";
import { quoteService } from "@/domains/quote/service";

import { PATCH as patchNotification } from "@/app/api/notifications/[id]/route";
import { GET as getEvent, PUT as putEvent } from "@/app/api/events/[id]/route";
import {
  DELETE as deleteAdminUser,
  PUT as updateAdminUser,
} from "@/app/api/admin/users/[id]/route";
import { DELETE as deleteAdminAccountCode } from "@/app/api/admin/account-codes/[id]/route";
import { DELETE as deleteTemplate } from "@/app/api/templates/[id]/route";
import { GET as getInvoice, PUT as updateInvoice } from "@/app/api/invoices/[id]/route";
import { GET as getQuoteById, PUT as updateQuote } from "@/app/api/quotes/[id]/route";
import { GET as getQuoteViews } from "@/app/api/quotes/[id]/views/route";
import { GET as getQuoteFollowUps } from "@/app/api/quotes/[id]/follow-ups/route";
import { POST as reviseQuote } from "@/app/api/quotes/[id]/revise/route";
import { POST as duplicateQuote } from "@/app/api/quotes/[id]/duplicate/route";
import { GET as getQuotePdf } from "@/app/api/quotes/[id]/pdf/route";

describe("GET /api/notifications/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "admin" } } as never);
  });

  it("rejects blank notification ids", async () => {
    const response = await patchNotification(
      new NextRequest("http://localhost/api/notifications/%20", { method: "PATCH" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid notification ID" });
    expect(notificationService.markRead).not.toHaveBeenCalled();
    expect(notificationService.delete).not.toHaveBeenCalled();
  });
});

describe("GET /api/events/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "admin" } } as never);
  });

  it("rejects blank event ids", async () => {
    const response = await getEvent(
      new NextRequest("http://localhost/api/events/%20"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid event id" });
    expect(eventService.getById).not.toHaveBeenCalled();
  });

  it("rejects non-object event update payloads", async () => {
    const response = await putEvent(
      new NextRequest("http://localhost/api/events/e1", {
        method: "PUT",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "e1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(eventService.update).not.toHaveBeenCalled();
  });
});

describe("admin user/id routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-user", role: "admin" } } as never);
  });

  it("rejects non-object admin user update bodies", async () => {
    const response = await updateAdminUser(
      new NextRequest("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify("bad"),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(adminService.updateUser).not.toHaveBeenCalled();
    expect(adminService.resetPassword).not.toHaveBeenCalled();
  });

  it("rejects empty admin user ids", async () => {
    const response = await deleteAdminUser(
      new NextRequest("http://localhost/api/admin/users/%20", { method: "DELETE" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid user id" });
    expect(adminService.deleteUser).not.toHaveBeenCalled();
  });
});

describe("admin account-code delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-user", role: "admin" } } as never);
  });

  it("rejects blank account code ids", async () => {
    const response = await deleteAdminAccountCode(
      new NextRequest("http://localhost/api/admin/account-codes/%20", { method: "DELETE" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid account code id" });
    expect(adminService.deleteAccountCode).not.toHaveBeenCalled();
  });
});

describe("templates id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
  });

  it("rejects blank template ids", async () => {
    const response = await deleteTemplate(
      new NextRequest("http://localhost/api/templates/%20", { method: "DELETE" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid template id" });
    expect(templateService.getById).not.toHaveBeenCalled();
    expect(templateService.delete).not.toHaveBeenCalled();
  });
});

describe("invoices id routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "admin" } } as never);
  });

  it("rejects blank invoice ids", async () => {
    const response = await getInvoice(
      new NextRequest("http://localhost/api/invoices/%20"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid invoice id" });
    expect(invoiceService.getById).not.toHaveBeenCalled();
  });

  it("rejects non-object invoice update payloads", async () => {
    const response = await updateInvoice(
      new NextRequest("http://localhost/api/invoices/inv1", {
        method: "PUT",
        body: "\"bad\"",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "inv1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(invoiceService.update).not.toHaveBeenCalled();
  });
});

describe("quotes id routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
  });

  it("rejects blank quote ids", async () => {
    const response = await getQuoteById(
      new NextRequest("http://localhost/api/quotes/%20"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
  });

  it("rejects non-object quote update payloads", async () => {
    const response = await updateQuote(
      new NextRequest("http://localhost/api/quotes/q1", {
        method: "PUT",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(quoteService.update).not.toHaveBeenCalled();
  });
});

describe("quote child id routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
    vi.mocked(quoteService.getById).mockResolvedValue({ id: "q1", creatorId: "u1" } as never);
    vi.mocked(quoteService.getViews).mockResolvedValue([] as never);
    vi.mocked(quoteService.getFollowUps).mockResolvedValue([] as never);
  });

  it("rejects blank ids when fetching quote views", async () => {
    const response = await getQuoteViews(
      new NextRequest("http://localhost/api/quotes/%20/views"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
  });

  it("rejects blank ids when fetching quote follow-ups", async () => {
    const response = await getQuoteFollowUps(
      new NextRequest("http://localhost/api/quotes/%20/follow-ups"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
  });

  it("rejects blank ids when revising quotes", async () => {
    const response = await reviseQuote(
      new NextRequest("http://localhost/api/quotes/%20/revise", { method: "POST" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
    expect(quoteService.createRevision).not.toHaveBeenCalled();
  });

  it("rejects blank ids when duplicating quotes", async () => {
    const response = await duplicateQuote(
      new NextRequest("http://localhost/api/quotes/%20/duplicate", { method: "POST" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
    expect(quoteService.duplicate).not.toHaveBeenCalled();
  });

  it("rejects blank ids when rendering quote PDFs", async () => {
    const response = await getQuotePdf(
      new NextRequest("http://localhost/api/quotes/%20/pdf"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
  });
});
