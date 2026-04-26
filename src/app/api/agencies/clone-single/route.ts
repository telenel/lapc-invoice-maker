import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { cloneAgency } from "@/domains/agency/agency-server";
import { ACCT_AGENCY_NAME_MAX, ACCT_AGENCY_NUMBER_MAX } from "@/domains/agency/validation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sourceAgencyId: z.number().int().positive(),
  newAgencyNumber: z.string().min(1).max(ACCT_AGENCY_NUMBER_MAX),
  newName: z.string().min(1).max(ACCT_AGENCY_NAME_MAX),
});

/**
 * POST /api/agencies/clone-single
 *
 * Clone one Acct_Agency from an existing template (mirror mode).
 *
 * Issues:
 *   1. INSERT INTO Acct_Agency ... SELECT ... FROM source row
 *   2. EXEC SP_AcctAgencyCopyDCC      @NewAgencyID, @OldAgencyID
 *   3. EXEC SP_AcctAgencyCopyNonMerch @NewAgencyID, @OldAgencyID
 *   4. EXEC SP_ARAcctResendToPos      @AgencyID
 *
 * Same write contract as the bulk roll-semester flow — single row at a time.
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

  const { sourceAgencyId, newAgencyNumber, newName } = parsed.data;

  try {
    const result = await cloneAgency({ sourceAgencyId, newAgencyNumber, newName });

    console.log(
      `[agency-clone-single] user=${session.user.username}(${session.user.id}) ` +
        `source=${sourceAgencyId} new=${result.newAgencyId} (${result.newAgencyNumber})`,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
