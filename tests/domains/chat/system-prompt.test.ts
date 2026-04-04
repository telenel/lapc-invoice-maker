import { describe, it, expect, vi, afterEach } from "vitest";
import { buildSystemPrompt } from "@/domains/chat/system-prompt";

const mockUser = { id: "user-1", name: "Test User", role: "user" as const };

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("buildSystemPrompt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should use local date methods, not toISOString", () => {
    vi.useFakeTimers();
    const fakeNow = new Date("2026-07-15T14:00:00Z");
    vi.setSystemTime(fakeNow);

    const prompt = buildSystemPrompt(mockUser);
    const expected = localDateStr(fakeNow);

    expect(prompt).toContain(expected);
  });

  it("should include the local date in all three date references", () => {
    vi.useFakeTimers();
    const fakeNow = new Date("2026-11-03T10:30:00Z");
    vi.setSystemTime(fakeNow);

    const prompt = buildSystemPrompt(mockUser);
    const expected = localDateStr(fakeNow);

    // The date appears 3 times in the prompt
    const occurrences = prompt.split(expected).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });
});
