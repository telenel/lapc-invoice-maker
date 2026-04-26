import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { rollSemesterForward } from "@/domains/agency/agency-server";
import { PIERCE_SEMESTER_REGEX } from "@/domains/agency/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  source: z.string().regex(PIERCE_SEMESTER_REGEX, "Invalid source semester"),
  target: z.string().regex(PIERCE_SEMESTER_REGEX, "Invalid target semester"),
  /**
   * Subset of source AgencyIDs the user has selected to roll. If omitted,
   * every source agency without an existing target is rolled.
   */
  selectedSourceAgencyIds: z.array(z.number().int().positive()).optional(),
});

/**
 * POST /api/agencies/roll-semester
 *
 * Execute a bulk semester rollover. For each selected source agency that
 * doesn't already have a target counterpart, performs:
 *
 *   1. INSERT INTO Acct_Agency ... SELECT ... FROM source row
 *   2. EXEC SP_AcctAgencyCopyDCC      @NewAgencyID, @OldAgencyID
 *   3. EXEC SP_AcctAgencyCopyNonMerch @NewAgencyID, @OldAgencyID
 *   4. EXEC SP_ARAcctResendToPos      @AgencyID
 *
 * Each clone is its own transaction so a single failure does not block the
 * rest. The response includes created / skipped / errored arrays so the UI
 * can render a per-row status.
 *
 * Authoritative reference for the contract:
 *   docs/prism/static/actions/clone-ar-agency.md
 *   docs/prism/static/actions/agency-binary-findings.md
 *
 * NOTE for operators: the first-ever production roll should be a single
 * agency, observed with a snapshot/diff capture, before doing a bulk
 * rollover. See docs/prism/static/actions/clone-ar-agency.md §10.
 */
export const POST = withAdmin(async (request: NextRequest, session) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const { source, target, selectedSourceAgencyIds } = parsed.data;
  if (source === target) {
    return NextResponse.json(
      { error: "Source and target semesters must differ." },
      { status: 400 },
    );
  }

  try {
    const result = await rollSemesterForward({
      sourceSemester: source,
      targetSemester: target,
      selectedSourceAgencyIds: selectedSourceAgencyIds
        ? new Set(selectedSourceAgencyIds)
        : undefined,
    });

    // Lightweight audit trail until a dedicated agency_writes_log table lands.
    // Captured by the Next.js server log; useful for after-the-fact attribution.
    console.log(
      `[agency-roll-semester] user=${session.user.username}(${session.user.id}) ` +
        `source=${source} target=${target} ` +
        `created=${result.created.length} skipped=${result.skipped.length} errors=${result.errors.length}`,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
