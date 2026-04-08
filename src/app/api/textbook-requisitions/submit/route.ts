import { NextRequest, NextResponse } from "next/server";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { publicRequisitionSubmitSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit by IP. Prefer x-forwarded-for (set by Traefik), fall back to
  // x-real-ip, then to a shared "anonymous" bucket that catches spoofed/missing
  // headers — unknown callers share a tighter global limit.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "anonymous";
  // Anonymous bucket gets a tighter limit since it's shared by all unidentifiable callers
  const maxAttempts = ip === "anonymous" ? 3 : 10;
  const rateResult = await checkRateLimit(`requisition-submit:${ip}`, {
    maxAttempts,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateResult.retryAfterMs ?? 0) / 1000)) },
      }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Honeypot: if the hidden field has a value, it's a bot
    if (body._hp && typeof body._hp === "string" && body._hp.trim().length > 0) {
      // Return 201 to not reveal the trap, but don't create anything
      return NextResponse.json(
        { id: "ok", submittedAt: new Date().toISOString(), department: "", course: "", term: "", reqYear: 0, bookCount: 0 },
        { status: 201 },
      );
    }

    const parsed = publicRequisitionSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ack = await requisitionService.submitPublic(parsed.data);
    return NextResponse.json(ack, { status: 201 });
  } catch (error) {
    console.error("[textbook-requisitions/submit] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
