import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductsSummaryStrip } from "@/components/products/products-summary-strip";

describe("ProductsSummaryStrip", () => {
  it("shows the highest-value analysis cards and a partial analytics warning", () => {
    const onAnalysisWindowChange = vi.fn();

    render(
      <ProductsSummaryStrip
        summary={{
          analysisWindow: "30d",
          metrics: {
            resultCount: 27,
            stockUnits: 190,
            stockCost: 2100,
            stockRetailValue: 3340,
            revenueWindowValue: 540,
            grossProfit1y: 820,
            inventoryAtRiskCost: 650,
            noSalesCount1y: 8,
            stockoutRiskCount: 3,
            unitsPerReceipt1y: 2.4,
          },
          freshness: {
            latestSyncStatus: "partial",
            latestSyncCompletedAt: "2026-04-18T12:44:53.171Z",
            analyticsPendingCount: 4,
            staleAnalyticsCount: 0,
            analyticsTrust: "partial",
          },
        }}
        analysisWindow="30d"
        onAnalysisWindowChange={onAnalysisWindowChange}
      />,
    );

    expect(screen.getByText("Inventory At Risk")).toBeTruthy();
    expect(screen.getByText("$650")).toBeTruthy();
    expect(screen.getByText(/analytics partial/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "90d" })).toBeTruthy();
  });
});
