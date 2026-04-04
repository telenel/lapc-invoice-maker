import { describe, it, expect, vi, afterEach } from "vitest";
import { buildSystemPrompt } from "@/domains/chat/system-prompt";

const mockUser = { id: "user-1", name: "Test User", role: "user" as const };

describe("buildSystemPrompt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should use local date, not UTC, for today's date", () => {
    // 2026-04-04 11:30pm Pacific = 2026-04-05 UTC
    // If using toISOString(), this would wrongly return "2026-04-05"
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T23:30:00-07:00"));

    const prompt = buildSystemPrompt(mockUser);

    // Should be April 4 (local), not April 5 (UTC)
    expect(prompt).toContain("2026-04-04");
    expect(prompt).not.toMatch(/today's date.*2026-04-05/i);
  });

  it("should include the local date in all date references", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:00:00-08:00"));

    const prompt = buildSystemPrompt(mockUser);

    // Should be Dec 31 local, not Jan 1 UTC
    expect(prompt).toContain("2026-12-31");
    expect(prompt).not.toContain("2027-01-01");
  });
});
