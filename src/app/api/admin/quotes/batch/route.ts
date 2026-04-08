import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import type { BatchActionInput } from "@/domains/admin/types";

const VALID_ACTIONS = ["status", "reassign", "delete"] as const;
const VALID_STATUSES = [
  "DRAFT", "SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL",
  "ACCEPTED", "DECLINED", "REVISED", "EXPIRED",
] as const;

export const PATCH = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const typedBody = body as BatchActionInput;

  if (!Array.isArray(typedBody.ids) || typedBody.ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(typedBody.action as typeof VALID_ACTIONS[number])) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (
    typedBody.action === "status"
    && !VALID_STATUSES.includes(typedBody.value as typeof VALID_STATUSES[number])
  ) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }
  if (typedBody.action === "reassign" && !typedBody.value) {
    return NextResponse.json({ error: "userId required for reassign" }, { status: 400 });
  }

  const result = await adminService.batchQuotes(typedBody);
  return NextResponse.json(result);
});
