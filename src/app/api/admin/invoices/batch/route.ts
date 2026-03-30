import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import type { BatchActionInput } from "@/domains/admin/types";

const VALID_ACTIONS = ["status", "reassign", "delete"] as const;
const VALID_STATUSES = ["DRAFT", "FINAL", "PENDING_CHARGE"] as const;

export const PATCH = withAdmin(async (req: NextRequest) => {
  const body = (await req.json()) as BatchActionInput;

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(body.action as typeof VALID_ACTIONS[number])) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (body.action === "status" && !VALID_STATUSES.includes(body.value as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }
  if (body.action === "reassign" && !body.value) {
    return NextResponse.json({ error: "userId required for reassign" }, { status: 400 });
  }

  const result = await adminService.batchInvoices(body);
  return NextResponse.json(result);
});
