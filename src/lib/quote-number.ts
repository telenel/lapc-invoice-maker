import { prisma } from "@/lib/prisma";
import { getYearInLosAngeles } from "@/lib/date-utils";

/**
 * Generates the next quote number in the format Q-YYYY-NNNN.
 * Finds the highest existing number for the current year and increments.
 */
export async function generateQuoteNumber(): Promise<string> {
  const year = getYearInLosAngeles();
  const prefix = `Q-${year}-`;

  const latest = await prisma.invoice.findFirst({
    where: {
      type: "QUOTE",
      quoteNumber: { startsWith: prefix },
    },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  let nextSeq = 1;
  if (latest?.quoteNumber) {
    const seqStr = latest.quoteNumber.replace(prefix, "");
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}
