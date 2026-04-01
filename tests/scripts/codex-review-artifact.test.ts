import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildRuntimePrompt,
  formatLatestFindings,
  parseReviewOutput,
  recordReviewArtifact,
} from "../../scripts/codex-review-artifact.mjs";

describe("codex review artifact helper", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("builds a focused runtime prompt with exact scope commands", () => {
    const prompt = buildRuntimePrompt({
      template: "Base prompt body",
      baseRef: "main",
      headSha: "abc123",
      focusPaths: ["src/domains/quote/service.ts"],
      changedFiles: [
        "src/domains/quote/service.ts",
        "scripts/codex-review-local.sh",
      ],
      reviewedFiles: ["src/domains/quote/service.ts"],
    });

    expect(prompt).toContain("Focused review mode: active");
    expect(prompt).toContain("- src/domains/quote/service.ts");
    expect(prompt).toContain(
      "git diff --unified=0 'main...HEAD' -- 'src/domains/quote/service.ts'",
    );
    expect(prompt).toContain(
      "Your SCOPE section must name the concrete files, functions, and areas you actually inspected.",
    );
  });

  it("parses the structured review report sections", () => {
    const parsed = parseReviewOutput(`RESULT: FAIL
SUMMARY: Two workflow regressions need fixes
LIVE-FINDING: src/domains/quote/service.ts blocks legacy conversion.
SCOPE:
- scripts/codex-review-local.sh focused-mode argument parsing
- scripts/ship-check.sh stamp freshness reporting
FINDINGS:
- scripts/codex-review-local.sh rejects repeated --focus flags after a positional base ref.
- scripts/ship-check.sh reports a stale stamp as fresh when CODEX_REVIEW_HEAD is unset.
`);

    expect(parsed.result).toBe("FAIL");
    expect(parsed.summary).toBe("Two workflow regressions need fixes");
    expect(parsed.scopeItems).toEqual([
      "scripts/codex-review-local.sh focused-mode argument parsing",
      "scripts/ship-check.sh stamp freshness reporting",
    ]);
    expect(parsed.findings).toHaveLength(2);
  });

  it("records latest artifacts, keeps latest pointers, and prunes history", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "codex-review-artifact-"));
    tempDirs.push(tempDir);

    const latestDir = path.join(tempDir, "laportal");
    const historyDir = path.join(latestDir, "review-history");
    mkdirSync(historyDir, { recursive: true });

    for (let index = 0; index < 25; index += 1) {
      const stamp = `20260101T0000${String(index).padStart(2, "0")}Z`;
      writeFileSync(
        path.join(historyDir, `codex-review-${stamp}-deadbeefcafe.json`),
        "{}\n",
      );
      writeFileSync(
        path.join(historyDir, `codex-review-${stamp}-deadbeefcafe.txt`),
        "old\n",
      );
    }

    const textReportPath = path.join(latestDir, "codex-review.txt");
    const jsonReportPath = path.join(latestDir, "codex-review.json");
    writeFileSync(
      textReportPath,
      `RESULT: FAIL
SUMMARY: Focused review found one blocker
SCOPE:
- src/domains/quote/service.ts updateQuoteStatus()
FINDINGS:
- src/domains/quote/service.ts updateQuoteStatus() no longer guards expired quotes.
`,
    );

    const artifact = recordReviewArtifact({
      textReportPath,
      jsonReportPath,
      historyDir,
      headSha: "0123456789abcdef0123456789abcdef01234567",
      baseRef: "main",
      createdAt: "2026-03-31T17:42:00Z",
      focusPaths: ["src/domains/quote/service.ts"],
      changedFiles: [
        "src/domains/quote/service.ts",
        "scripts/codex-review-local.sh",
      ],
      reviewedFiles: ["src/domains/quote/service.ts"],
    });

    const latestArtifact = JSON.parse(readFileSync(jsonReportPath, "utf8"));
    const historyJsonFiles = readdirSync(historyDir).filter((entry) =>
      /^codex-review-.*\.json$/.test(entry),
    );

    expect(artifact.result).toBe("FAIL");
    expect(latestArtifact.scope.focusPaths).toEqual([
      "src/domains/quote/service.ts",
    ]);
    expect(latestArtifact.scope.reviewedFiles).toEqual([
      "src/domains/quote/service.ts",
    ]);
    expect(latestArtifact.scope.summary).toContain("Focused review of 1 changed file");
    expect(latestArtifact.findings[0].status).toBe("unresolved");
    expect(historyJsonFiles).toHaveLength(20);
    expect(readdirSync(historyDir)).toContain("latest.json");
    expect(readdirSync(historyDir)).toContain("latest.txt");
  });

  it("formats unresolved findings from the latest artifact", () => {
    const output = formatLatestFindings({
      result: "FAIL",
      headSha: "abc123",
      baseRef: "main",
      createdAt: "2026-03-31T18:00:00Z",
      scope: {
        summary: "Reviewed 2 changed files across scripts.",
      },
      findings: [
        {
          id: "F1",
          status: "unresolved",
          text: "scripts/codex-review-local.sh does not write the JSON artifact on FAIL.",
        },
        {
          id: "F2",
          status: "resolved",
          text: "ignore me",
        },
      ],
    });

    expect(output).toContain("Latest Codex review: FAIL for abc123");
    expect(output).toContain("1. scripts/codex-review-local.sh does not write the JSON artifact on FAIL.");
    expect(output).not.toContain("ignore me");
  });
});
