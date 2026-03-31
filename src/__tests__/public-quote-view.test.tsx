import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicQuoteView } from "@/components/quotes/public-quote-view";

vi.mock("@/domains/quote/api-client", () => ({
  quoteApi: {
    getPublicQuote: vi.fn(),
    getPublicSettings: vi.fn(),
    registerPublicView: vi.fn(),
    recordPublicViewDuration: vi.fn(),
    respondToPublicQuote: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { quoteApi } from "@/domains/quote/api-client";

describe("PublicQuoteView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      date: "2026-03-31T00:00:00.000Z",
      expirationDate: null,
      department: "IT",
      category: "SUPPLIES",
      notes: "",
      totalAmount: 10,
      recipientName: "Jane",
      recipientEmail: "jane@example.com",
      recipientOrg: "",
      staff: null,
      contact: null,
      items: [],
      isCateringEvent: true,
      cateringDetails: {
        eventDate: "",
        startTime: "",
        endTime: "",
        contactName: "",
        contactPhone: "",
        location: "",
        setupRequired: false,
        takedownRequired: false,
      },
      paymentDetailsResolved: false,
    } as never);
    vi.mocked(quoteApi.getPublicSettings).mockResolvedValue({} as never);
    vi.mocked(quoteApi.registerPublicView).mockResolvedValue({ viewId: "view-1" } as never);
    vi.mocked(quoteApi.respondToPublicQuote).mockResolvedValue({
      success: true,
      status: "ACCEPTED",
    } as never);
  });

  it("lets catering recipients supply the required schedule fields before approving", async () => {
    const user = userEvent.setup();
    render(<PublicQuoteView token="token" />);

    await screen.findByText("Event Details Required");

    await user.type(screen.getByLabelText(/Event Date/i), "2026-04-15");
    await user.type(screen.getByLabelText(/Start Time/i), "10:00");
    await user.type(screen.getByLabelText(/End Time/i), "12:00");
    await user.type(screen.getByLabelText(/Contact Name/i), "Jane");
    await user.type(screen.getByLabelText(/Contact Number/i), "555-1111");
    await user.type(screen.getByLabelText(/Event Location/i), "Campus");

    await user.click(screen.getByRole("button", { name: "Approve Quote" }));

    await waitFor(() => {
      expect(quoteApi.respondToPublicQuote).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          response: "ACCEPTED",
          cateringDetails: expect.objectContaining({
            eventDate: "2026-04-15",
            startTime: "10:00",
            endTime: "12:00",
            contactName: "Jane",
            contactPhone: "555-1111",
            location: "Campus",
          }),
        }),
      );
    });
  });
});
