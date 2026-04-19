interface BackfillProgressRow {
  TranDtlID: number | string;
  TransactionID: number | string;
  ProcessDate: Date;
}

export function getBackfillPageProgress(
  rows: BackfillProgressRow[],
  currentMaxTransactionId: number,
): {
  nextCursor: number;
  maxTransactionId: number;
  maxProcessDate: Date | null;
} {
  let nextCursor = 0;
  let maxTransactionId = currentMaxTransactionId;
  let maxProcessDate: Date | null = null;

  for (const row of rows) {
    nextCursor = Math.max(nextCursor, Number(row.TranDtlID));
    maxTransactionId = Math.max(maxTransactionId, Number(row.TransactionID));
    if (!maxProcessDate || row.ProcessDate > maxProcessDate) {
      maxProcessDate = row.ProcessDate;
    }
  }

  return {
    nextCursor,
    maxTransactionId,
    maxProcessDate,
  };
}
