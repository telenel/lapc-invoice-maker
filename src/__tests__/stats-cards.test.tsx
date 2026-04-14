import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardBootstrapProvider } from "@/components/dashboard/dashboard-bootstrap-provider";
import { StatsCards } from "@/components/dashboard/stats-cards";
import type { DashboardBootstrapData } from "@/domains/dashboard/types";

vi.mock("@/components/dashboard/use-deferred-dashboard-realtime", () => ({
  useDeferredDashboardRealtime: vi.fn(),
}));

function renderStatsCards(currentUserId = "user-1") {
  const bootstrapData: DashboardBootstrapData = {
    todaysEvents: [],
    yourFocus: null,
    pendingAccounts: [],
    runningInvoices: [],
    recentActivity: { items: [], badgeStates: {} },
    stats: {
      summary: {
        invoicesThisMonth: 4,
        totalThisMonth: 3000,
        invoicesLastMonth: 3,
        totalLastMonth: 2400,
        expectedCount: 2,
        expectedTotal: 1200,
      },
      teamUsers: [
        { id: "user-2", name: "Jordan Miles", invoiceCount: 3, totalAmount: 1800 },
        { id: "user-1", name: "Alex Chen", invoiceCount: 2, totalAmount: 1200 },
      ],
    },
  };

  return render(
    <DashboardBootstrapProvider value={bootstrapData}>
      <StatsCards currentUserId={currentUserId} />
    </DashboardBootstrapProvider>,
  );
}

describe("StatsCards", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the team funding leaderboard with every user name, including the current user", () => {
    renderStatsCards();

    const teamActivityCard = screen.getByText("Team Activity").closest("[data-slot='card']") as HTMLElement | null;

    expect(teamActivityCard).not.toBeNull();

    expect(within(teamActivityCard!).getByText("Jordan Miles")).toBeInTheDocument();
    expect(within(teamActivityCard!).getByText(/\$1,800\.00/)).toBeInTheDocument();
    expect(within(teamActivityCard!).getByText(/Alex Chen/i)).toBeInTheDocument();
    expect(within(teamActivityCard!).getByText(/\(You\)/i)).toBeInTheDocument();
    expect(within(teamActivityCard!).getByText(/\$1,200\.00/)).toBeInTheDocument();
  });
});
