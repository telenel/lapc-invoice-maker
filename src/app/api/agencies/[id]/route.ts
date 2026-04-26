import { NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { getAgencyById } from "@/domains/agency/agency-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agencies/[id]
 *
 * Read one Acct_Agency row by ID. Used by the mirror-mode form to confirm
 * the picked template's details before submission.
 *
 * Read-only. Returns 404 if no row exists.
 */
export const GET = withAdmin(async (_req, _session, ctx) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const params = await ctx?.params;
  const id = parseInt(params?.id ?? "", 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid agency id" }, { status: 400 });
  }

  try {
    const agency = await getAgencyById(id);
    if (!agency) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ agency });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
