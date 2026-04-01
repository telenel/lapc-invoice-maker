import {
  batchSignature,
  buildSummaryText,
  buildAutopilotPrompt,
  formatEventLine,
  parseAutopilotArgs,
  selectDispatchableBatches,
} from "../../scripts/codex-review-autopilot.mjs";

describe("codex review autopilot helper", () => {
  it("keeps passthrough args and recognizes help", () => {
    expect(
      parseAutopilotArgs(["--base-ref", "release", "--focus", "src/domains/quote/service.ts"]),
    ).toEqual({
      help: false,
      passthrough: ["--base-ref", "release", "--focus", "src/domains/quote/service.ts"],
    });

    expect(parseAutopilotArgs(["--help"])).toEqual({
      help: true,
      passthrough: [],
    });
  });

  it("uses finding text as the batch signature", () => {
    expect(
      batchSignature({
        findings: [{ text: "b" }, { text: "a" }],
      }),
    ).toBe("a\n---\nb");
  });

  it("tolerates malformed findings when building a batch signature", () => {
    expect(
      batchSignature({
        findings: [{}, { text: "a" }],
      }),
    ).toBe("\n---\na");
  });

  it("defers live worker batches until they have gone quiet", () => {
    const recentBatch = {
      id: "B1",
      mode: "worker-candidate",
      files: ["src/domains/quote/follow-ups.ts"],
      findings: [
        {
          id: "L1",
          text: "src/domains/quote/follow-ups.ts still notifies the wrong owner.",
          createdAt: "2026-03-31T22:00:03Z",
        },
      ],
    };
    const staleBatch = {
      ...recentBatch,
      id: "B2",
      findings: [
        {
          id: "L2",
          text: "src/domains/quote/follow-ups.ts needs retry backoff.",
          createdAt: "2026-03-31T21:59:40Z",
        },
      ],
    };

    expect(
      selectDispatchableBatches({
        plan: [recentBatch, staleBatch],
        launchedSignatures: new Set(),
        activeFiles: new Set(),
        nowMs: Date.parse("2026-03-31T22:00:05Z"),
        liveMode: true,
      }).map((batch) => batch.id),
    ).toEqual(["B2"]);
  });

  it("skips overlapping live batches and keeps final dispatch unconstrained by quiet time", () => {
    const batch = {
      id: "B1",
      mode: "main-agent",
      files: ["src/domains/quote/service.ts"],
      findings: [
        {
          id: "F1",
          text: "src/domains/quote/service.ts still strands converted quotes.",
          createdAt: "2026-03-31T22:00:03Z",
        },
      ],
    };

    expect(
      selectDispatchableBatches({
        plan: [batch],
        launchedSignatures: new Set(),
        activeFiles: new Set(["src/domains/quote/service.ts"]),
        nowMs: Date.parse("2026-03-31T22:00:20Z"),
        liveMode: false,
      }),
    ).toEqual([]);

    expect(
      selectDispatchableBatches({
        plan: [batch],
        launchedSignatures: new Set(),
        activeFiles: new Set(),
        nowMs: Date.parse("2026-03-31T22:00:04Z"),
        liveMode: false,
      }).map((entry) => entry.id),
    ).toEqual(["B1"]);
  });

  it("builds an autopilot prompt with explicit branch and commit requirements", () => {
    const prompt = buildAutopilotPrompt({
      artifact: {
        headSha: "abc123",
        baseRef: "main",
        result: "FAIL",
        summary: "One issue remains",
      },
      batch: {
        id: "B1",
        files: ["src/domains/quote/service.ts"],
        findings: [
          {
            id: "F1",
            text: "src/domains/quote/service.ts still strands converted quotes.",
          },
        ],
      },
      worktreePath: "/tmp/laportal-autopilot/B1",
      branchName: "autopilot/abc123/worker-b1",
      commitMessage: "autopilot(B1): remediate codex findings",
      role: "worker",
    });

    expect(prompt).toContain("Autopilot requirements:");
    expect(prompt).toContain("Role: worker");
    expect(prompt).toContain("Worktree branch: autopilot/abc123/worker-b1");
    expect(prompt).toContain(
      "Commit all completed changes in this worktree before exiting using exactly: autopilot(B1): remediate codex findings",
    );
  });

  it("formats a human-readable session summary", () => {
    const summary = buildSummaryText({
      sessionId: "session-1",
      startedAt: "2026-03-31T21:00:00Z",
      repoRoot: "/repo",
      branch: "feature",
      headSha: "abc123",
      worktreeRoot: "/tmp/laportal-codex-autopilot-abc123",
      producerExitCode: 0,
      liveStatePath: "/repo/.git/laportal/codex-review.live.json",
      finalArtifactPath: "/repo/.git/laportal/codex-review.json",
      eventsPath: "/repo/.git/laportal/autopilot/session-1/events.jsonl",
      producerLogPath: "/repo/.git/laportal/autopilot/session-1/producer.log",
      sessionCleanup: {
        worktreeRoot: "/tmp/laportal-codex-autopilot-abc123",
        worktreeRootRemoved: true,
        reason: null,
        error: null,
      },
      tasks: [
        {
          batchId: "B1",
          role: "worker",
          status: "completed",
          branchName: "autopilot/abc123/worker-b1",
          exitCode: 0,
          integratedCommits: ["deadbeef"],
          logPath: "/tmp/B1.log",
        },
      ],
    });

    expect(summary).toContain("LAPortal review autopilot summary");
    expect(summary).toContain("session: session-1");
    expect(summary).toContain("session temp root: /tmp/laportal-codex-autopilot-abc123");
    expect(summary).toContain("- B1 [worker] completed | branch=autopilot/abc123/worker-b1 | exit=0 | integrated=1");
    expect(summary).toContain("Session cleanup: removed=yes | path=/tmp/laportal-codex-autopilot-abc123");
  });

  it("formats readable event lines", () => {
    expect(
      formatEventLine({
        type: "session-start",
        sessionId: "session-1",
        branch: "feature",
        headSha: "abc123",
      }),
    ).toBe("AUTOPILOT session started: session-1 | branch=feature | head=abc123");

    expect(
      formatEventLine({
        type: "producer-start",
        headSha: "abc123",
        producerLogPath: "/repo/.git/laportal/autopilot/session-1/producer.log",
      }),
    ).toBe(
      "AUTOPILOT review started: head=abc123 | producer_log=/repo/.git/laportal/autopilot/session-1/producer.log",
    );

    expect(
      formatEventLine({
        type: "review-result",
        result: "FAIL",
        findingCount: 2,
        summary: "Two issues remain",
      }),
    ).toBe("AUTOPILOT review result: FAIL | findings=2 | summary=Two issues remain");

    expect(
      formatEventLine({
        type: "batch-launch",
        role: "worker",
        batchId: "B1",
        findingCount: 2,
        worktreePath: "/tmp/coordinator-b1",
      }),
    ).toBe("AUTOPILOT launched worker B1 | findings=2 | worktree=/tmp/coordinator-b1");

    expect(
      formatEventLine({
        type: "task-integrating",
        batchId: "B1",
        targetBranch: "feature",
      }),
    ).toBe("AUTOPILOT integrating B1 into feature");

    expect(
      formatEventLine({
        type: "task-integrated",
        batchId: "B1",
        targetBranch: "feature",
        commits: ["deadbeef", "cafebabe"],
      }),
    ).toBe("AUTOPILOT integrated B1 into feature (2 commits)");

    expect(
      formatEventLine({
        type: "session-cleanup",
        worktreeRootRemoved: true,
        worktreeRoot: "/tmp/laportal-codex-autopilot-abc123",
      }),
    ).toBe(
      "AUTOPILOT cleaned session temp root: removed=yes path=/tmp/laportal-codex-autopilot-abc123",
    );

    expect(
      formatEventLine({
        type: "session-complete",
        taskCount: 2,
        failedTaskCount: 1,
      }),
    ).toBe("AUTOPILOT session complete: tasks=2 failed=1 pushes=0");
  });
});
