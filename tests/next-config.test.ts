import { describe, expect, it } from "vitest";

describe("next.config", () => {
  it("enables the Next instrumentation hook", async () => {
    const configModule = await import("../next.config.mjs");

    expect(configModule.default.experimental?.instrumentationHook).toBe(true);
  });
});
