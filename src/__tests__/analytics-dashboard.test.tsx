import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsResponse } from "@/domains/analytics/types";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { formatHourLabel } from "@/components/analytics/hourly-sales-chart";

vi.mock("@/components/analytics/finance-dashboard", () => ({
  FinanceDashboard: ({ data }: { data: AnalyticsResponse }) => (
    <div>Finance dashboard {data.summary.count}</div>
  ),
}));

vi.mock("@/components/analytics/operations-dashboard", () => ({
  OperationsDashboard: ({ data }: { data: AnalyticsResponse["operations"] }) => (
    <div>Operations dashboard {data.overview.receipts}</div>
  ),
}));

function buildAnalyticsResponse(): AnalyticsResponse {
  return {
    summary: {
      count: 3,
      total: 1800,
      finalizedCount: 2,
      finalizedTotal: 1200,
      expectedCount: 1,
      expectedTotal: 600,
    },
    byCategory: [],
    byMonth: [],
    byDepartment: [],
    trend: [],
    byUser: [],
    operations: {
      overview: {
        revenue: 9450,
        units: 382,
        receipts: 118,
        averageBasket: 80,
        deadStockCost: 0,
        lowStockHighDemandCount: 0,
        reorderBreachCount: 0,
        lastSyncStartedAt: null,
        lastSyncStatus: null,
        txnsAdded: null,
      },
      highlights: [],
      salesPatterns: {
        monthly: [],
        weekdays: [],
        hourly: [],
        hourlyAvailable: false,
        hourlyFallbackMessage: null,
      },
      productPerformance: {
        topSelling: [],
        topRevenue: [],
        accelerating: [],
        decelerating: [],
        newItems: [],
        categoryMix: [],
        revenueConcentration: {
          topProductShare: 0,
          skuCountFor80Percent: 0,
          totalSkuCount: 0,
          percentOfSkusFor80Percent: 0,
        },
      },
      inventoryHealth: {
        deadStockCost: 0,
        lowStockHighDemandCount: 0,
        reorderBreachesByLocation: [],
        staleInventoryByLocation: [],
        deadInventory: [],
        slowMoving: [],
        lowStockHighDemand: [],
      },
      copyTech: {
        summary: {
          invoiceRevenue: 0,
          quoteRevenue: 0,
          invoiceCount: 0,
          quoteCount: 0,
        },
        monthly: [],
        serviceMix: [],
        topRequesters: [],
        limitations: [],
      },
      limitations: [],
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AnalyticsDashboard", () => {
  it("clears stale analytics results and shows an inline validation error when the date range is inverted", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      <AnalyticsDashboard
        initialData={buildAnalyticsResponse()}
        initialDateFrom="2026-04-01"
        initialDateTo="2026-04-30"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Operations dashboard 118")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-05-01" } });

    await waitFor(() => {
      expect(screen.getByText("dateFrom must be less than or equal to dateTo")).toBeInTheDocument();
    });
    expect(screen.queryByText("Operations dashboard 118")).not.toBeInTheDocument();
  });

  it("fetches operations first and defers finance until the tab is selected", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("/api/analytics/operations")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(buildAnalyticsResponse().operations),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          summary: buildAnalyticsResponse().summary,
          byCategory: [],
          byMonth: [],
          byDepartment: [],
          trend: [],
          byUser: [],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AnalyticsDashboard
        initialDateFrom="2026-04-01"
        initialDateTo="2026-04-30"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Operations dashboard 118")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/analytics/operations");

    fireEvent.click(screen.getByRole("tab", { name: "Finance" }));

    await waitFor(() => {
      expect(screen.getByText("Finance dashboard 3")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/analytics/finance");
  });
});

describe("formatHourLabel", () => {
  it("uses uppercase meridiem labels for hourly analytics", () => {
    expect(formatHourLabel(4)).toBe("4 AM");
    expect(formatHourLabel(12)).toBe("12 PM");
    expect(formatHourLabel(16)).toBe("4 PM");
  });
});
