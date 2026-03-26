import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const quote = await prisma.invoice.findUnique({ where: { id } });

    if (!quote || quote.type !== "QUOTE") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    if (quote.quoteStatus !== "DRAFT") {
      return NextResponse.json({ error: "Only draft quotes can be marked as sent" }, { status: 400 });
    }

    await prisma.invoice.update({
      where: { id },
      data: { quoteStatus: "SENT" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/quotes/[id]/send failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
