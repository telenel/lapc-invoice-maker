export interface QuoteUrlFilters {
  search: string;
  quoteStatus: string;
  category: string;
  department: string;
  creatorId: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  page: string;
  sortBy: string;
  sortOrder: string;
}

export interface QuoteVisibleFilters {
  search: string;
  quoteStatus: string;
  category: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export function getNextQuoteFilterState(
  current: Pick<QuoteUrlFilters, "creatorId" | "sortBy" | "sortOrder">,
  next: QuoteVisibleFilters,
): Partial<QuoteUrlFilters> {
  return {
    ...next,
    creatorId: current.creatorId,
    sortBy: current.sortBy,
    sortOrder: current.sortOrder,
  };
}
