import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { previewRollSemester } from "@/domains/agency/agency-server";
import { PIERCE_SEMESTER_REGEX } from "@/domains/agency/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  source: z.string().regex(PIERCE_SEMESTER_REGEX, "Invalid source semester"),
  target: z.string().regex(PIERCE_SEMESTER_REGEX, "Invalid target semester"),
});

/**
 * GET /api/agencies/preview-roll?source=PWI25&target=PWI26
 *
 * Read-only preview of a semester rollover. Returns every source agency, its
 * computed target AgencyNumber/Name, and whether the target already exists.
 *
 * The client renders this list with checkboxes; the user selects which to
 * roll, and the selection is sent to POST /api/agencies/roll-semester.
 */
export const GET = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    source: url.searchParams.get("source"),
    target: url.searchParams.get("target"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const { source, target } = parsed.data;

  if (source === target) {
    return NextResponse.json(
      { error: "Source and target semesters must differ." },
      { status: 400 },
    );
  }

  try {
    const plan = await previewRollSemester(source, target);
    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
