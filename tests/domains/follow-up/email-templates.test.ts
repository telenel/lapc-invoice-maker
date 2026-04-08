import { describe, it, expect } from "vitest";
import { buildAccountFollowUpEmail } from "@/domains/follow-up/email-templates";

describe("buildAccountFollowUpEmail", () => {
  const baseParams = {
    recipientName: "Jane Smith",
    invoiceNumber: "INV-0042",
    type: "INVOICE" as const,
    description: "Office Supplies",
    totalAmount: 250.00,
    creatorName: "John Doe",
    formUrl: "https://laportal.montalvo.io/account-request/abc-123",
    attempt: 1,
    maxAttempts: 5,
  };

  it("should return friendly tone for attempt 1", () => {
    const { subject, html } = buildAccountFollowUpEmail(baseParams);
    expect(subject).toBe("Account number needed — INV-0042");
    expect(html).toContain("Jane Smith");
    expect(html).toContain("INV-0042");
    expect(html).toContain("$250.00");
    expect(html).toContain("account-request/abc-123");
    expect(html).toContain("1 of 5");
  });

  it("should return urgent tone for attempt 4", () => {
    const { subject, html } = buildAccountFollowUpEmail({ ...baseParams, attempt: 4 });
    expect(subject).toBe("Urgent: Account number overdue — INV-0042");
    expect(html).toContain("4 of 5");
  });

  it("should return final notice for attempt 5", () => {
    const { subject, html } = buildAccountFollowUpEmail({ ...baseParams, attempt: 5 });
    expect(subject).toBe("Final notice: Account number required — INV-0042");
    expect(html).toContain("5 of 5");
    expect(html).toContain("final");
  });

  it("should escape HTML in user-provided values", () => {
    const { html } = buildAccountFollowUpEmail({
      ...baseParams,
      recipientName: '<script>alert("xss")</script>',
      description: "O'Malley & Sons",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("O&#39;Malley &amp; Sons");
  });

  it("should use quote number when type is QUOTE", () => {
    const { subject } = buildAccountFollowUpEmail({
      ...baseParams,
      invoiceNumber: null,
      quoteNumber: "QTE-0018",
      type: "QUOTE",
      attempt: 2,
    });
    expect(subject).toBe("Reminder: Account number still needed — QTE-0018");
  });
});
