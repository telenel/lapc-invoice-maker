import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicQuoteView } from "@/components/quotes/public-quote-view";
import { ApiError } from "@/domains/shared/types";

const pushMock = vi.fn();

vi.mock("@/domains/quote/api-client", () => ({
  quoteApi: {
    getPublicQuote: vi.fn(),
    getPublicSettings: vi.fn(),
    registerPublicView: vi.fn(),
    recordPublicViewDuration: vi.fn(),
    respondToPublicQuote: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
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
    pushMock.mockReset();
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      paymentLinkAvailable: true,
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

  it("waits for public view registration before submitting an approval", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValueOnce({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      paymentLinkAvailable: true,
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
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
    } as never);

    let resolveRegistration!: (value: { viewId: string }) => void;
    const registrationPromise = new Promise<{ viewId: string }>((resolve) => {
      resolveRegistration = resolve;
    });
    vi.mocked(quoteApi.registerPublicView).mockReturnValue(registrationPromise as never);

    const user = userEvent.setup();
    render(<PublicQuoteView token="token" />);

    await screen.findByText("Approve Quote");
    await user.click(screen.getByRole("button", { name: "Approve Quote" }));

    expect(quoteApi.respondToPublicQuote).not.toHaveBeenCalled();

    resolveRegistration({ viewId: "view-1" });

    await waitFor(() => {
      expect(quoteApi.respondToPublicQuote).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          response: "ACCEPTED",
          viewId: "view-1",
        }),
      );
    });
  });

  it("records the unload duration after a fast navigation once the view registration resolves", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValueOnce({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      paymentLinkAvailable: true,
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
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
    } as never);

    let resolveRegistration!: (value: { viewId: string }) => void;
    const registrationPromise = new Promise<{ viewId: string }>((resolve) => {
      resolveRegistration = resolve;
    });
    vi.mocked(quoteApi.registerPublicView).mockReturnValue(registrationPromise as never);

    let now = 1_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      render(<PublicQuoteView token="token" />);

      await screen.findByText("Approve Quote");

      now = 4_000;
      window.dispatchEvent(new Event("beforeunload"));

      expect(quoteApi.recordPublicViewDuration).not.toHaveBeenCalled();

      resolveRegistration({ viewId: "view-1" });

      await waitFor(() => {
        expect(quoteApi.recordPublicViewDuration).toHaveBeenCalledWith("token", "view-1", 3);
      });

      expect(quoteApi.recordPublicViewDuration).toHaveBeenCalledTimes(1);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("disables approval when setup is requested without a setup time", async () => {
    const user = userEvent.setup();
    render(<PublicQuoteView token="token" />);

    await screen.findByText("Event Details Required");

    await user.type(screen.getByLabelText(/Event Date/i), "2026-04-15");
    await user.type(screen.getByLabelText(/Start Time/i), "10:00");
    await user.type(screen.getByLabelText(/End Time/i), "12:00");
    await user.type(screen.getByLabelText(/Contact Name/i), "Jane");
    await user.type(screen.getByLabelText(/Contact Number/i), "555-1111");
    await user.type(screen.getByLabelText(/Event Location/i), "Campus");
    await user.click(screen.getByRole("checkbox", { name: /Setup Needed/i }));

    expect(screen.getByRole("button", { name: "Approve Quote" })).toBeDisabled();
    expect(quoteApi.respondToPublicQuote).not.toHaveBeenCalled();
  });

  it("disables approval when takedown is requested without a takedown time", async () => {
    const user = userEvent.setup();
    render(<PublicQuoteView token="token" />);

    await screen.findByText("Event Details Required");

    await user.type(screen.getByLabelText(/Event Date/i), "2026-04-15");
    await user.type(screen.getByLabelText(/Start Time/i), "10:00");
    await user.type(screen.getByLabelText(/End Time/i), "12:00");
    await user.type(screen.getByLabelText(/Contact Name/i), "Jane");
    await user.type(screen.getByLabelText(/Contact Number/i), "555-1111");
    await user.type(screen.getByLabelText(/Event Location/i), "Campus");
    await user.click(screen.getByRole("checkbox", { name: /Takedown Needed/i }));

    expect(screen.getByRole("button", { name: "Approve Quote" })).toBeDisabled();
    expect(quoteApi.respondToPublicQuote).not.toHaveBeenCalled();
  });

  it("keeps the quote visible if analytics registration fails", async () => {
    vi.mocked(quoteApi.registerPublicView).mockRejectedValueOnce(new Error("boom"));

    render(<PublicQuoteView token="token" />);

    await waitFor(() => {
      expect(screen.getByText("Approve Quote")).toBeInTheDocument();
    });

    expect(screen.queryByText("Quote Not Found")).not.toBeInTheDocument();
  });

  it("shows a transient load error for non-404 quote failures", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockRejectedValueOnce(new ApiError(500, "boom"));

    render(<PublicQuoteView token="token" />);

    await screen.findByText("Unable to Load Quote");
    expect(screen.getByText("We couldn't load this quote right now. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("Quote Not Found")).not.toBeInTheDocument();
  });

  it("still shows quote not found for actual 404 failures", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockRejectedValueOnce(new ApiError(404, "missing"));

    render(<PublicQuoteView token="token" />);

    await screen.findByText("Quote Not Found");
  });

  it("routes accepted quotes without payment details to the payment page", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValueOnce({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "ACCEPTED",
      paymentLinkAvailable: true,
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
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
    } as never);

    render(<PublicQuoteView token="token" />);

    await screen.findByText("Provide Payment Details");

    await userEvent.click(screen.getByRole("button", { name: "Provide Payment Details" }));

    expect(pushMock).toHaveBeenCalledWith("/quotes/payment/token");
  });

  it("renders public line items with the same uppercase casing treatment as other quote surfaces", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValueOnce({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      paymentLinkAvailable: true,
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
      items: [
        {
          id: "i1",
          description: "Mixed Case Widget",
          quantity: 1,
          unitPrice: 10,
          extendedPrice: 10,
          sortOrder: 0,
          isTaxable: true,
        },
      ],
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
    } as never);

    render(<PublicQuoteView token="token" />);

    const cell = await screen.findByText("Mixed Case Widget");
    expect(cell).toHaveClass("uppercase");
  });

  it("does not show the payment CTA when public payment collection is closed", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValueOnce({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "ACCEPTED",
      paymentLinkAvailable: false,
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
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
    } as never);

    render(<PublicQuoteView token="token" />);

    await screen.findByText(/Payment collection for this quote is now closed/i);
    expect(screen.queryByRole("button", { name: "Provide Payment Details" })).not.toBeInTheDocument();
  });

  it("hides public response actions when the quote is no longer open online", async () => {
    vi.mocked(quoteApi.getPublicQuote).mockResolvedValueOnce({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      paymentLinkAvailable: false,
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
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
    } as never);

    render(<PublicQuoteView token="token" />);

    await screen.findByText("This quote is no longer open for online approval or payment submission.");
    expect(screen.queryByRole("button", { name: "Approve Quote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline Quote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Provide Payment Details" })).not.toBeInTheDocument();
  });
});
