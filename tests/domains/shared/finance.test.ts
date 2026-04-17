import { describe, expect, it } from "vitest";

import {
  buildExpectedFinanceWhere,
  buildIncludedFinanceWhere,
} from "@/domains/shared/finance";

describe("shared finance filters", () => {
  it("excludes archived documents from included finance queries", () => {
    expect(buildIncludedFinanceWhere()).toMatchObject({
      archivedAt: null,
    });
  });

  it("excludes archived documents from expected finance queries", () => {
    expect(buildExpectedFinanceWhere()).toMatchObject({
      archivedAt: null,
    });
  });
});
