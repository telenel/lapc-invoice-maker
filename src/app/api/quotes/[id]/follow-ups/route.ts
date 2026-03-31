import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;

  const followUps = await prisma.quoteFollowUp.findMany({
    where: { invoiceId: id },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json(
    followUps.map((fu) => ({
      id: fu.id,
      type: fu.type,
      recipientEmail: fu.recipientEmail,
      subject: fu.subject,
      sentAt: fu.sentAt.toISOString(),
      metadata: fu.metadata,
    }))
  );
});
