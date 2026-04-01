import {
  normalizeFindingText,
  parseReviewArgs,
} from "../../scripts/codex-review-live.mjs";

describe("codex review live helper", () => {
  it("normalizes live finding lines into queue payload text", () => {
    expect(
      normalizeFindingText(
        "LIVE-FINDING: src/domains/quote/service.ts blocks legacy conversion.",
      ),
    ).toBe("src/domains/quote/service.ts blocks legacy conversion.");
  });

  it("preserves review args for the live runner", () => {
    expect(
      parseReviewArgs([
        "--base-ref",
        "main",
        "--focus",
        "src/domains/quote/service.ts",
        "--json",
      ]),
    ).toEqual({
      passthrough: [
        "--base-ref",
        "main",
        "--focus",
        "src/domains/quote/service.ts",
        "--json",
      ],
      baseRef: "main",
      focusPaths: ["src/domains/quote/service.ts"],
      json: true,
    });
  });
});
