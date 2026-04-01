import {
  buildRemediationPlan,
  buildWorkerPrompt,
  formatRemediationPlan,
} from "../../scripts/codex-review-remediation.mjs";

describe("codex review remediation helper", () => {
  const repoRoot = "/Users/montalvo/lapc-invoice-maker";

  it("groups overlapping findings into a single main-agent batch", () => {
    const artifact = {
      headSha: "abc123",
      baseRef: "main",
      result: "FAIL",
      summary: "Three issues remain",
      createdAt: "2026-03-31T22:00:00Z",
      findings: [
        {
          id: "F1",
          status: "unresolved",
          text: "- [src/domains/quote/service.ts:1007](/Users/montalvo/lapc-invoice-maker/src/domains/quote/service.ts) blocks conversion for legacy accepted quotes and [src/components/quotes/quote-detail.tsx:558](/Users/montalvo/lapc-invoice-maker/src/components/quotes/quote-detail.tsx) offers no repair path.",
        },
        {
          id: "F2",
          status: "unresolved",
          text: "- [src/domains/quote/service.ts:259](/Users/montalvo/lapc-invoice-maker/src/domains/quote/service.ts) can throw NOT_FOUND but [src/app/api/quotes/public/[token]/payment/route.ts:30](/Users/montalvo/lapc-invoice-maker/src/app/api/quotes/public/[token]/payment/route.ts) maps it to 500.",
        },
        {
          id: "F3",
          status: "unresolved",
          text: "- [src/domains/quote/follow-ups.ts:139](/Users/montalvo/lapc-invoice-maker/src/domains/quote/follow-ups.ts) notifies the wrong owner for converted quotes.",
        },
      ],
    };

    const plan = buildRemediationPlan(artifact, repoRoot);

    expect(plan).toHaveLength(2);
    expect(plan[0].findingIds).toEqual(["F1", "F2"]);
    expect(plan[0].mode).toBe("main-agent");
    expect(plan[0].files).toContain("src/domains/quote/service.ts");
    expect(plan[0].files).toContain("src/app/api/quotes/public/[token]/payment/route.ts");
    expect(plan[0].files).not.toContain("src/components/quotes/quote-detail.ts");
    expect(plan[1].findingIds).toEqual(["F3"]);
    expect(plan[1].mode).toBe("worker-candidate");
  });

  it("formats a readable triage plan", () => {
    const artifact = {
      headSha: "abc123",
      baseRef: "main",
      result: "FAIL",
      summary: "One issue remains",
      createdAt: "2026-03-31T22:00:00Z",
      findings: [{ id: "F1", status: "unresolved", text: "src/domains/quote/service.ts still leaks state." }],
    };
    const plan = buildRemediationPlan(artifact, repoRoot);
    const output = formatRemediationPlan(artifact, plan, ".git/laportal/codex-review.json");

    expect(output).toContain("Latest Codex review: FAIL for abc123");
    expect(output).toContain("Remediation batches:");
    expect(output).toContain("npm run review:codex:prompt -- --batch <BATCH_ID>");
  });

  it("formats an in-progress live snapshot cleanly", () => {
    const artifact = {
      headSha: "abc123",
      baseRef: "main",
      result: null,
      summary: null,
      createdAt: null,
      findings: [{ id: "L1", status: "unresolved", text: "src/domains/quote/service.ts still blocks legacy conversion." }],
    };
    const plan = buildRemediationPlan(artifact, repoRoot);
    const output = formatRemediationPlan(artifact, plan, ".git/laportal/codex-review.live.json");

    expect(output).toContain("Latest Codex review: IN_PROGRESS for abc123");
    expect(output).toContain("Live review snapshot in progress");
  });

  it("builds a worker prompt with explicit ownership", () => {
    const artifact = {
      headSha: "abc123",
      baseRef: "main",
      result: "FAIL",
      summary: "One issue remains",
      createdAt: "2026-03-31T22:00:00Z",
      findings: [
        {
          id: "F1",
          status: "unresolved",
          text: "- [src/domains/quote/follow-ups.ts:139](/Users/montalvo/lapc-invoice-maker/src/domains/quote/follow-ups.ts) notifies the wrong owner for converted quotes.",
        },
      ],
    };
    const [batch] = buildRemediationPlan(artifact, repoRoot);
    const prompt = buildWorkerPrompt(artifact, batch, repoRoot);

    expect(prompt).toContain("Batch: B1");
    expect(prompt).toContain("src/domains/quote/follow-ups.ts");
    expect(prompt).toContain("Do not revert others' changes.");
  });
});
