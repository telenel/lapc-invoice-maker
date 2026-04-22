import { describe, expect, it } from "vitest";
import { config } from "@/middleware";

const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("middleware matcher", () => {
  it("does not apply auth middleware to the prism-pull sync endpoint", () => {
    expect(matcher.test("/api/sync/prism-pull")).toBe(false);
  });

  it("keeps other sync endpoints protected", () => {
    expect(matcher.test("/api/sync/other")).toBe(true);
  });

  it("keeps normal authenticated routes protected", () => {
    expect(matcher.test("/api/quotes")).toBe(true);
  });
});