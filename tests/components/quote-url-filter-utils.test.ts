import { describe, expect, it } from "vitest";
import { getNextQuoteFilterState } from "@/components/quotes/url-filter-utils";

describe("getNextQuoteFilterState", () => {
  it("preserves creator scope while filters change", () => {
    expect(
      getNextQuoteFilterState(
        {
          creatorId: "user-123",
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        {
          search: "music",
          quoteStatus: "DRAFT",
          category: "",
          department: "",
          dateFrom: "",
          dateTo: "",
          amountMin: "",
          amountMax: "",
        },
      ),
    ).toMatchObject({
      search: "music",
      quoteStatus: "DRAFT",
      creatorId: "user-123",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });
});
