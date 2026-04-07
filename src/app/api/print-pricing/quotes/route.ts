import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { printPricingService } from "@/domains/print-pricing/service";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")?.trim()
      || "anonymous";
    const rateResult = await checkRateLimit(`print-pricing-quote:${ip}`, {
      maxAttempts: ip === "anonymous" ? 3 : 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateResult.retryAfterMs ?? 0) / 1000)) },
        }
      );
    }
    const body = await req.json();
    const session = await getServerSession(authOptions);
    const createdBy = (session?.user as { id?: string } | undefined)?.id ?? null;
    const quote = await printPricingService.generateQuote(body, createdBy);
    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid estimate request" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate quote" },
      { status: 500 }
    );
  }
}
