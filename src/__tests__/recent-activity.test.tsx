import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecentActivity } from "@/components/dashboard/recent-invoices";
import { DashboardBootstrapProvider } from "@/components/dashboard/dashboard-bootstrap-provider";

vi.mock("@/components/dashboard/use-deferred-dashboard-realtime", () => ({
  useDeferredDashboardRealtime: vi.fn(),
}));

describe("RecentActivity", () => {
  it("shows a payment follow-up badge next to accepted quote activity items", () => {
    render(
      <DashboardBootstrapProvider
        value={{
          todaysEvents: [],
          yourFocus: null,
          stats: {
            summary: {
              invoicesThisMonth: 0,
              totalThisMonth: 0,
              invoicesLastMonth: 0,
              totalLastMonth: 0,
            },
            teamUsers: [],
          },
          pendingAccounts: [],
          pendingCharges: [],
          runningInvoices: [],
          recentActivity: {
            items: [
              {
                type: "quote",
                id: "quote-1",
                number: "Q-001",
                name: "Alex Client",
                department: "CopyTech",
                date: "2026-04-12T00:00:00.000Z",
                amount: 240,
                status: "ACCEPTED",
                creatorId: "user-1",
                creatorName: "Mia",
                createdAt: "2026-04-12T00:00:00.000Z",
                paymentFollowUpBadge: {
                  seriesStatus: "ACTIVE",
                  currentAttempt: 1,
                  maxAttempts: 5,
                },
              },
            ],
            badgeStates: {},
          },
        }}
      >
        <RecentActivity currentUserId={null} />
      </DashboardBootstrapProvider>,
    );

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Follow Up 1/5")).toBeInTheDocument();
  });
});
