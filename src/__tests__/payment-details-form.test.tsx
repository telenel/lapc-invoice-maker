import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentDetailsForm } from "@/components/quotes/payment-details-form";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/domains/quote/api-client", () => ({
  quoteApi: {
    submitPublicPaymentDetails: vi.fn(),
  },
}));

import { toast } from "sonner";
import { quoteApi } from "@/domains/quote/api-client";

describe("PaymentDetailsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a not found state for missing quotes", () => {
    render(<PaymentDetailsForm token="token" initialQuote={null} />);

    expect(screen.getByText("Quote Not Found")).toBeInTheDocument();
  });

  it("shows a resolved state when payment details are already on file", () => {
    render(
      <PaymentDetailsForm
        token="token"
        initialQuote={{
          quoteStatus: "ACCEPTED",
          paymentDetailsResolved: true,
          quoteNumber: "Q-1",
        }}
      />,
    );

    expect(screen.getByText("Payment Details Already On File")).toBeInTheDocument();
    expect(screen.getByText(/Q-1/)).toBeInTheDocument();
  });

  it("shows the payment form for accepted quotes that still need payment details", () => {
    render(
      <PaymentDetailsForm
        token="token"
        initialQuote={{
          quoteStatus: "ACCEPTED",
          paymentDetailsResolved: false,
          quoteNumber: "Q-1",
        }}
      />,
    );

    expect(screen.getByText("Provide Payment Details")).toBeInTheDocument();
    expect(screen.getByText("Submit Payment Details")).toBeInTheDocument();
  });

  it("shows a closed state when public payment collection is no longer available", () => {
    render(
      <PaymentDetailsForm
        token="token"
        initialQuote={{
          quoteStatus: "ACCEPTED",
          paymentDetailsResolved: false,
          paymentLinkAvailable: false,
          quoteNumber: "Q-1",
        }}
      />,
    );

    expect(screen.getByText("Payment Link Closed")).toBeInTheDocument();
  });

  it("surfaces string throwables in the error toast", async () => {
    vi.mocked(quoteApi.submitPublicPaymentDetails).mockRejectedValueOnce("Gateway unavailable");
    const user = userEvent.setup();

    render(
      <PaymentDetailsForm
        token="token"
        initialQuote={{
          quoteStatus: "ACCEPTED",
          paymentDetailsResolved: false,
          quoteNumber: "Q-1",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Account Number" }));
    await user.type(screen.getByPlaceholderText("Enter your SAP account number"), "SAP-12345");
    await user.click(screen.getByRole("button", { name: "Submit Payment Details" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Gateway unavailable");
    });
  });
});
