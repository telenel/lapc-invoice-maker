import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma,
}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows a request when under the limit", async () => {
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      rateLimitEvent: {
        deleteMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    }));

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("chat:user-1", { maxAttempts: 2, windowMs: 1000 });

    expect(result).toEqual({ allowed: true });
  });

  it("returns retryAfterMs when the key is blocked", async () => {
    const oldestAttempt = new Date(Date.now() - 500);
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      rateLimitEvent: {
        deleteMany: vi.fn(),
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({ createdAt: oldestAttempt }),
        create: vi.fn(),
      },
    }));

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("chat:user-1", { maxAttempts: 2, windowMs: 1000 });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("rejects invalid configuration", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");

    await expect(checkRateLimit("login:test", { maxAttempts: 0 })).rejects.toThrow(
      "checkRateLimit: maxAttempts must be a positive integer",
    );
  });
});
