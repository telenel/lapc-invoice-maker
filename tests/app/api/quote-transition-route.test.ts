import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getById: vi.fn(),
    approveManually: vi.fn(),
    declineManually: vi.fn(),
    convertToInvoice: vi.fn(),
    archive: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { quoteService } from "@/domains/quote/service";
import { POST as approveQuote } from "@/app/api/quotes/[id]/approve/route";
import { POST as declineQuote } from "@/app/api/quotes/[id]/decline/route";
import { POST as convertQuote } from "@/app/api/quotes/[id]/convert/route";
import { DELETE as deleteQuote } from "@/app/api/quotes/[id]/route";

describe("quote transition routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "q1",
      creatorId: "u1",
      quoteStatus: "SENT",
      isCateringEvent: false,
    } as never);
  });

  it("normalizes quote ids for manual approval", async () => {
    vi.mocked(quoteService.approveManually).mockResolvedValue({
      success: true,
      status: "ACCEPTED",
    } as never);

    const response = await approveQuote(
      new NextRequest("http://localhost/api/quotes/q1/approve", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "  q1  " }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.getById).toHaveBeenCalledWith("q1", { includeArchived: true });
    expect(quoteService.approveManually).toHaveBeenCalledWith("q1", {
      paymentMethod: "CHECK",
    });
  });

  it("returns 400 for an empty quote id on manual approval", async () => {
    const response = await approveQuote(
      new NextRequest("http://localhost/api/quotes//approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quote id" });
    expect(quoteService.getById).not.toHaveBeenCalled();
  });

  it("normalizes quote ids for manual decline", async () => {
    vi.mocked(quoteService.declineManually).mockResolvedValue({
      success: true,
      status: "DECLINED",
    } as never);

    const response = await declineQuote(
      new NextRequest("http://localhost/api/quotes/q1/decline", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "  q1  " }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.declineManually).toHaveBeenCalledWith("q1");
  });

  it("normalizes quote ids for convert", async () => {
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "q1",
      creatorId: "u1",
      quoteStatus: "ACCEPTED",
    } as never);
    vi.mocked(quoteService.convertToInvoice).mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-1",
    } as never);

    const response = await convertQuote(
      new NextRequest("http://localhost/api/quotes/q1/convert", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "  q1  " }) },
    );

    expect(response.status).toBe(201);
    expect(quoteService.convertToInvoice).toHaveBeenCalledWith("q1", "u1");
  });

  it("normalizes quote ids for delete", async () => {
    vi.mocked(quoteService.archive).mockResolvedValue(undefined as never);

    const response = await deleteQuote(
      new NextRequest("http://localhost/api/quotes/q1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "  q1  " }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.getById).toHaveBeenCalledWith("q1", { includeArchived: true });
    expect(quoteService.archive).toHaveBeenCalledWith("q1", "u1");
  });

  it("returns 404 when the quote cannot be found for archive", async () => {
    vi.mocked(quoteService.getById).mockResolvedValue(null as never);

    const response = await deleteQuote(
      new NextRequest("http://localhost/api/quotes/q1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Quote not found",
    });
  });
});
