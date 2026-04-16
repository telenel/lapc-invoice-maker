import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpRepository } from "@/domains/follow-up/repository";

export const GET = withAuth(async () => {
  const rows = await followUpRepository.getPendingAccountsSummary();
  const items = rows.map((row: (typeof rows)[number]) => {
    const attempt =
      ((row.metadata as Record<string, unknown>)?.attempt as number) ?? 1;
    return {
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      quoteNumber: row.invoice.quoteNumber,
      type: row.invoice.type,
      staffName: row.invoice.staff?.name ?? "Unknown",
      creatorName: row.invoice.creator?.name ?? "Unknown",
      creatorId: row.invoice.createdBy,
      currentAttempt: attempt,
      maxAttempts: row.maxAttempts ?? 5,
      seriesStatus: row.seriesStatus ?? "ACTIVE",
    };
  });

  return NextResponse.json({ count: items.length, items });
});
