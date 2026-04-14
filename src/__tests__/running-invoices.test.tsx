import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunningInvoices } from "@/components/dashboard/running-invoices";
import { DashboardBootstrapProvider } from "@/components/dashboard/dashboard-bootstrap-provider";

describe("RunningInvoices", () => {
  it("shows requestor details for running invoices, including legacy pending charges", () => {
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
              expectedCount: 0,
              expectedTotal: 0,
            },
            teamUsers: [],
          },
          pendingAccounts: [],
          runningInvoices: [
            {
              id: "inv-1",
              creatorId: "user-1",
              creatorName: "Marcos",
              department: "Catering",
              totalAmount: 240,
              runningTitle: "",
              itemCount: 3,
              requestorName: "Denise Robb",
              detail: "Staff lunch invoice",
            } as never,
          ],
          recentActivity: {
            items: [],
            badgeStates: {},
          },
        }}
      >
        <RunningInvoices currentUserId={null} />
      </DashboardBootstrapProvider>,
    );

    expect(screen.getByText(/Denise Robb .* Catering .* Marcos/)).toBeInTheDocument();
    expect(screen.getByText("Staff lunch invoice")).toBeInTheDocument();
  });
});
