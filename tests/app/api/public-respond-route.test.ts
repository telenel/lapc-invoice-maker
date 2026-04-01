import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getByShareToken: vi.fn(),
    respondToQuote: vi.fn(),
  },
}));

import { quoteService } from "@/domains/quote/service";
import { POST } from "@/app/api/quotes/public/[token]/respond/route";

describe("POST /api/quotes/public/[token]/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: false,
    } as never);
  });

  it("does not persist catering details when payment validation fails", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "ACCOUNT_NUMBER",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("rejects catering approval when required schedule fields are missing", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "",
            startTime: "",
            endTime: "",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only required catering fields", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "   ",
            contactName: "   ",
            contactPhone: "   ",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("rejects catering approval when setup time is missing after setup is requested", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
            setupRequired: true,
            setupTime: "",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("blocks responses for quotes that have already been converted to invoices", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: false,
      convertedToInvoice: { id: "inv1" },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "DECLINED",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("rejects catering details for non-catering quotes", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("passes catering details through the quote response flow for catering quotes", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "ACCEPTED",
      undefined,
      {
        paymentMethod: "CHECK",
        accountNumber: null,
      },
      expect.objectContaining({
        eventDate: "2026-04-15",
        startTime: "10:00",
        endTime: "12:00",
        location: "Campus",
        contactName: "Jane",
        contactPhone: "555-1111",
        setupRequired: false,
        takedownRequired: false,
      }),
    );
  });

  it("preserves staff-only catering metadata from the existing quote", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
      cateringDetails: {
        eventName: "Internal Event Name",
        contactEmail: "hidden@example.com",
        setupInstructions: "Internal setup note",
        takedownInstructions: "Internal takedown note",
      },
    } as never);
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
            eventName: "Attacker override",
            contactEmail: "attacker@example.com",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const cateringDetails = vi.mocked(quoteService.respondToQuote).mock.calls[0]?.[4] as Record<string, unknown> | undefined;
    expect(cateringDetails).toBeDefined();
    expect(cateringDetails).toHaveProperty("eventName", "Internal Event Name");
    expect(cateringDetails).toHaveProperty("contactEmail", "hidden@example.com");
    expect(cateringDetails).toHaveProperty("setupInstructions", "Internal setup note");
    expect(cateringDetails).toHaveProperty("takedownInstructions", "Internal takedown note");
  });

  it("does not preserve omitted optional catering fields from the existing quote", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
      cateringDetails: {
        eventDate: "2026-04-15",
        startTime: "10:00",
        endTime: "12:00",
        location: "Bookstore",
        contactName: "Jane",
        contactPhone: "555-1111",
        contactEmail: "jane@example.com",
        setupRequired: true,
        setupInstructions: "Keep the prep table against the north wall.",
        takedownRequired: false,
        takedownInstructions: "Leave equipment by the loading dock.",
      },
    } as never);
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "ACCEPTED",
      undefined,
      {
        paymentMethod: "CHECK",
        accountNumber: null,
      },
      expect.objectContaining({
        eventDate: "2026-04-15",
        startTime: "10:00",
        endTime: "12:00",
        location: "Campus",
        contactName: "Jane",
        contactPhone: "555-1111",
        setupRequired: false,
        takedownRequired: false,
      }),
    );
    const cateringDetails = vi.mocked(quoteService.respondToQuote).mock.calls[0]?.[4] as Record<string, unknown> | undefined;
    expect(cateringDetails).toBeDefined();
    expect(cateringDetails).not.toHaveProperty("headcount");
    expect(cateringDetails).not.toHaveProperty("setupTime");
    expect(cateringDetails).not.toHaveProperty("takedownTime");
    expect(cateringDetails).not.toHaveProperty("specialInstructions");
    expect(cateringDetails).toHaveProperty("setupInstructions", "Keep the prep table against the north wall.");
    expect(cateringDetails).toHaveProperty("takedownInstructions", "Leave equipment by the loading dock.");
  });

  it("persists submitted setup and takedown instructions when they are provided publicly", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
      cateringDetails: {
        eventDate: "2026-04-15",
        startTime: "10:00",
        endTime: "12:00",
        location: "Bookstore",
        contactName: "Jane",
        contactPhone: "555-1111",
        setupRequired: true,
        setupTime: "08:00",
        setupInstructions: "Old setup note",
        takedownRequired: true,
        takedownTime: "14:00",
        takedownInstructions: "Old takedown note",
      },
    } as never);
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
            setupRequired: true,
            setupTime: "08:00",
            setupInstructions: "New setup note",
            takedownRequired: true,
            takedownTime: "14:00",
            takedownInstructions: "New takedown note",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const cateringDetails = vi.mocked(quoteService.respondToQuote).mock.calls[0]?.[4] as Record<string, unknown> | undefined;
    expect(cateringDetails).toBeDefined();
    expect(cateringDetails).toHaveProperty("setupInstructions", "New setup note");
    expect(cateringDetails).toHaveProperty("takedownInstructions", "New takedown note");
  });

  it("clears setup and takedown times when those requirements are unchecked", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
      cateringDetails: {
        eventDate: "2026-04-15",
        startTime: "10:00",
        endTime: "12:00",
        location: "Bookstore",
        contactName: "Jane",
        contactPhone: "555-1111",
        setupRequired: true,
        setupTime: "08:00",
        takedownRequired: true,
        takedownTime: "14:00",
      },
    } as never);
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
            setupRequired: false,
            takedownRequired: false,
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const cateringDetails = vi.mocked(quoteService.respondToQuote).mock.calls[0]?.[4] as Record<string, unknown> | undefined;
    expect(cateringDetails).toBeDefined();
    expect(cateringDetails).toHaveProperty("setupRequired", false);
    expect(cateringDetails).toHaveProperty("takedownRequired", false);
    expect(cateringDetails).toHaveProperty("setupTime", null);
    expect(cateringDetails).toHaveProperty("takedownTime", null);
  });
  it("passes the raw account number shape through to the quote service", async () => {
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-12345",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "ACCEPTED",
      undefined,
      {
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "SAP-12345",
      },
      undefined,
    );
  });

  it("trims payment details before passing them to the quote service", async () => {
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: " check ",
          accountNumber: "  SAP-12345  ",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "ACCEPTED",
      undefined,
      {
        paymentMethod: "CHECK",
        accountNumber: null,
      },
      undefined,
    );
  });

  it("ignores payment and catering fields when declining a quote", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "DECLINED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "DECLINED",
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "",
          cateringDetails: {
            eventDate: "",
            startTime: "",
            endTime: "",
            location: "",
            contactName: "",
            contactPhone: "",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "DECLINED",
      undefined,
      undefined,
      undefined,
    );
  });

  it("requires catering details when approving a catering quote", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("returns 409 when approval-time payment details are already resolved", async () => {
    vi.mocked(quoteService.respondToQuote).mockRejectedValue(
      Object.assign(new Error("Payment details have already been provided"), {
        code: "PAYMENT_ALREADY_RESOLVED",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-12345",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(409);
  });
});
