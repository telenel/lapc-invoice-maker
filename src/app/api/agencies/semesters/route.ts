import { NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { listPierceSemesters } from "@/domains/agency/agency-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agencies/semesters
 *
 * Returns the distinct Pierce semester prefixes (PSP/PFA/PSU/PWI + YY) that
 * currently exist in Acct_Agency, with the count of agencies in each.
 *
 * Sorted newest-first by prefix string. Read-only.
 */
export const GET = withAdmin(async () => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  try {
    const semesters = await listPierceSemesters();
    return NextResponse.json({ semesters });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
