import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { searchAgencies } from "@/domains/agency/agency-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agencies/search?q=foo&limit=25
 *
 * Search Pierce agencies by AgencyNumber or Name. Used by the
 * single-account-create form's template-picker.
 *
 * Read-only.
 */
export const GET = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(parseInt(limitRaw, 10) || 25, 100)) : 25;

  if (q.length === 0) {
    return NextResponse.json({ agencies: [] });
  }

  try {
    const agencies = await searchAgencies(q, limit);
    return NextResponse.json({ agencies });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
