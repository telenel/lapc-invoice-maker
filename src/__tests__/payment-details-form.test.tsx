import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentDetailsForm } from "@/components/quotes/payment-details-form";

describe("PaymentDetailsForm", () => {
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
});
