import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { printPricingService } from "@/domains/print-pricing/service";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

  if (ipv4Pattern.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every(part => part >= 0 && part <= 255);
  }
  return ipv6Pattern.test(ip);
}

function getClientIP(req: Request): string {
  // In production behind a trusted proxy, parse X-Forwarded-For
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0]?.trim();
    if (firstIP && isValidIP(firstIP)) {
      return firstIP;
    }
  }

  const realIP = req.headers.get("x-real-ip")?.trim();
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  return "anonymous";
}

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
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
    const body = await req.json().catch(() => {
      throw new SyntaxError("INVALID_JSON");
    });
    const session = await getServerSession(authOptions);
    const createdBy = (session?.user as { id?: string } | undefined)?.id ?? null;
    const quote = await printPricingService.generateQuote(body, createdBy);
    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError && error.message === "INVALID_JSON") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
