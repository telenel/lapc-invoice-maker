import { describe, expect, it } from "vitest";
import { getQuoteViewerAccess } from "@/domains/quote/access";

describe("getQuoteViewerAccess", () => {
  it("lets read-only viewers duplicate a quote while keeping manage actions disabled", () => {
    const access = getQuoteViewerAccess(
      {
        creatorId: "owner-1",
        convertedToInvoice: null,
      },
      "viewer-2",
      false,
    );

    expect(access.canViewQuote).toBe(true);
    expect(access.canManageActions).toBe(false);
    expect(access.canDuplicateQuote).toBe(true);
    expect(access.canViewActivity).toBe(true);
    expect(access.canViewSensitiveFields).toBe(true);
  });
});
