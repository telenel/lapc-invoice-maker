import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncRun: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prism", () => ({
  isPrismConfigured: vi.fn(),
  getPrismPool: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/domains/product/prism-sync", () => ({
  runPrismPull: vi.fn(),
}));

vi.mock("@/domains/product/sales-txn-sync", () => ({
  runSalesTxnSync: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { isPrismConfigured, getPrismPool } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runPrismPull } from "@/domains/product/prism-sync";
import { runSalesTxnSync } from "@/domains/product/sales-txn-sync";
import { POST } from "@/app/api/sync/prism-pull/route";

const originalCronInternalSecret = process.env.CRON_INTERNAL_SECRET;

describe("POST /api/sync/prism-pull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPrismConfigured).mockReturnValue(true);
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(prisma.syncRun.create).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(prisma.syncRun.update).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(runPrismPull).mockResolvedValue({
      scanned: 100,
      updated: 25,
      removed: 3,
      durationMs: 1200,
    } as never);
    vi.mocked(getPrismPool).mockResolvedValue({} as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({} as never);
    vi.mocked(runSalesTxnSync).mockResolvedValue({
      txnsAdded: 0,
      aggregatesUpdated: 0,
      durationMs: 80,
    } as never);
  });

  afterEach(() => {
    if (originalCronInternalSecret === undefined) {
      delete process.env.CRON_INTERNAL_SECRET;
      return;
    }

    process.env.CRON_INTERNAL_SECRET = originalCronInternalSecret;
  });

  it("returns 403 when the request has neither an admin session nor the cron secret", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/sync/prism-pull", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Admin required" });
    expect(prisma.syncRun.create).not.toHaveBeenCalled();
    expect(runPrismPull).not.toHaveBeenCalled();
  });

  it("allows internal cron requests to run without loading a session", async () => {
    process.env.CRON_INTERNAL_SECRET = "test-cron-secret";
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/sync/prism-pull", {
        method: "POST",
        headers: { "x-internal-cron-secret": "test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runId: "run-1",
      status: "ok",
      scanned: 100,
      updated: 25,
      removed: 3,
    });
    expect(getServerSession).not.toHaveBeenCalled();
    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        triggeredBy: "scheduled",
        status: "running",
      },
    });
    expect(runPrismPull).toHaveBeenCalledTimes(1);
  });

  it("still allows admin session requests without the cron secret", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/sync/prism-pull", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runId: "run-1",
      status: "ok",
    });
    expect(getServerSession).toHaveBeenCalledTimes(1);
    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        triggeredBy: "manual:admin-1",
        status: "running",
      },
    });
  });

  it("marks the run partial when transaction sync is skipped", async () => {
    vi.mocked(runSalesTxnSync).mockResolvedValue({
      txnsAdded: 0,
      aggregatesUpdated: 0,
      durationMs: 80,
      skipped: "backfill-not-completed",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/sync/prism-pull", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runId: "run-1",
      status: "partial",
      txnSyncSkipped: "backfill-not-completed",
      txnSyncError: "Transaction sync skipped: backfill-not-completed",
    });
    expect(prisma.syncRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "partial",
        error: "Transaction sync skipped: backfill-not-completed",
      }),
    }));
  });

  it("marks the run partial when transaction sync throws after the catalog step succeeds", async () => {
    vi.mocked(runSalesTxnSync).mockRejectedValue(new Error("aggregate refresh failed"));

    const response = await POST(
      new NextRequest("http://localhost/api/sync/prism-pull", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runId: "run-1",
      status: "partial",
      txnSyncError: "aggregate refresh failed",
    });
    expect(prisma.syncRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "partial",
        error: "aggregate refresh failed",
      }),
    }));
  });
});