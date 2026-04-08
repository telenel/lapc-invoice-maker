import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import type { BatchActionInput } from "@/domains/admin/types";

const VALID_STATUSES = ["DRAFT", "FINAL", "PENDING_CHARGE"] as const;

export const PATCH = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { ids, action, value } = body as {
    ids?: unknown;
    action?: unknown;
    value?: unknown;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const normalizedIds = Array.isArray(ids)
    ? ids
      .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
      .filter((id) => id.length > 0)
    : [];

  if (normalizedIds.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  if (action !== "status" && action !== "reassign" && action !== "delete") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const typedAction = action as BatchActionInput["action"];

  let normalizedValue: string | undefined;

  if (action === "status") {
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
    normalizedValue = value.trim();
    if (!VALID_STATUSES.includes(normalizedValue as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
  }

  if (action === "reassign") {
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: "userId required for reassign" }, { status: 400 });
    }
    normalizedValue = value.trim();
  }

  if (ids.length !== normalizedIds.length) {
    return NextResponse.json({ error: "ids must contain valid values" }, { status: 400 });
  }

  const typedBody: BatchActionInput = {
    ids: normalizedIds,
    action: typedAction,
    ...(normalizedValue !== undefined ? { value: normalizedValue } : {}),
  };

  const result = await adminService.batchInvoices(typedBody);
  return NextResponse.json(result);
});
