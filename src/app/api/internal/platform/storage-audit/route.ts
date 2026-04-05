import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { getLegacyStorageAudit } from "@/lib/storage-audit";

export const runtime = "nodejs";

export const GET = withCronAuth(async () => {
  try {
    const audit = await getLegacyStorageAudit();
    return NextResponse.json({
      ok: true,
      audit,
    });
  } catch (error) {
    console.error("GET /api/internal/platform/storage-audit failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Storage audit unavailable",
      },
      { status: 500 },
    );
  }
});
