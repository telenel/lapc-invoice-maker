import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { isPrismConfigured, probePrism } from "@/lib/prism";

export const dynamic = "force-dynamic";

/**
 * Reports whether Prism (the WinPRISM SQL Server backend) is reachable from
 * this server. Used by the UI to conditionally show write features.
 *
 * - On the campus dev machine: returns { available: true }
 * - On the cloud VPS (laportal.montalvo.io): returns { available: false }
 *   because the VPS can't reach the LACCD intranet.
 */
export const GET = withAuth(async () => {
  if (!isPrismConfigured()) {
    return NextResponse.json({
      available: false,
      configured: false,
      reason: "Prism env vars are not set in this environment.",
    });
  }

  const probe = await probePrism();
  return NextResponse.json({
    available: probe.available,
    configured: true,
    reason: probe.error ?? null,
  });
});
