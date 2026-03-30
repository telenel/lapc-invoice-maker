import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { printPricingService } from "@/domains/print-pricing/service";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
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
