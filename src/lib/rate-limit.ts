import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs?: number;
};

function normalizeScope(key: string): string {
  const separatorIndex = key.indexOf(":");
  if (separatorIndex <= 0) return "default";
  return key.slice(0, separatorIndex);
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function assertRateLimitOptions(maxAttempts: number, windowMs: number) {
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("checkRateLimit: maxAttempts must be a positive integer");
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("checkRateLimit: windowMs must be a positive number");
  }
}

export async function checkRateLimit(
  key: string,
  options?: { maxAttempts?: number; windowMs?: number }
): Promise<RateLimitResult> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  assertRateLimitOptions(maxAttempts, windowMs);

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const expiresAt = new Date(now.getTime() + windowMs);
  const scope = normalizeScope(key);
  const keyHash = hashKey(key);

  return prisma.$transaction(async (tx) => {
    await tx.rateLimitEvent.deleteMany({
      where: {
        scope,
        keyHash,
        expiresAt: { lte: now },
      },
    });

    const where: Prisma.RateLimitEventWhereInput = {
      scope,
      keyHash,
      createdAt: { gte: windowStart },
    };
    const [attemptCount, oldestAttempt] = await Promise.all([
      tx.rateLimitEvent.count({ where }),
      tx.rateLimitEvent.findFirst({
        where,
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    if (attemptCount >= maxAttempts && oldestAttempt) {
      const retryAfterMs = Math.max(
        0,
        windowMs - (now.getTime() - oldestAttempt.createdAt.getTime()),
      );
      return { allowed: false, retryAfterMs };
    }

    await tx.rateLimitEvent.create({
      data: {
        scope,
        keyHash,
        expiresAt,
      },
    });

    return { allowed: true };
  });
}
