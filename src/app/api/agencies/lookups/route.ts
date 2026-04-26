import { NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { getAgencyLookups } from "@/domains/agency/agency-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agencies/lookups
 *
 * Returns the FK lookup tables the advanced create form needs:
 *   - agencyTypes (9 rows)
 *   - statementCodes (6 rows)
 *   - nonMerchOpts (3 rows)
 *   - tenderCodes (active codes only)
 *
 * Read-only.
 */
export const GET = withAdmin(async () => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  try {
    const lookups = await getAgencyLookups();
    return NextResponse.json(lookups);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
