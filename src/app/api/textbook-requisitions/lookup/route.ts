import { NextRequest, NextResponse } from "next/server";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { requisitionLookupSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "anonymous";

  const maxAttempts = ip === "anonymous" ? 3 : 10;
  const rateResult = await checkRateLimit(`requisition-lookup:${ip}`, {
    maxAttempts,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateResult.retryAfterMs ?? 0) / 1000)) },
      },
    );
  }

  const employeeId = req.nextUrl.searchParams.get("employeeId") ?? "";
  const parsed = requisitionLookupSchema.safeParse({ employeeId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid employee ID", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results = await requisitionService.lookupByEmployeeId(parsed.data.employeeId);
  return NextResponse.json(results);
}
