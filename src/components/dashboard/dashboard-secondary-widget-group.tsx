"use client";

import { PendingCharges } from "./pending-charges";
import { RecentActivity } from "./recent-invoices";
import { RunningInvoices } from "./running-invoices";
import { StatsCards } from "./stats-cards";

type SecondaryWidgetId =
  | "stats"
  | "pending-charges"
  | "running-invoices";

function renderSecondaryWidget(
  widgetId: SecondaryWidgetId,
  currentUserId: string | null,
) {
  switch (widgetId) {
    case "stats":
      return <StatsCards currentUserId={currentUserId} />;
    case "pending-charges":
      return <PendingCharges />;
    case "running-invoices":
      return <RunningInvoices currentUserId={currentUserId} />;
    default:
      return null;
  }
}

export function DashboardSecondaryWidgetGroup({
  currentUserId,
  widgetIds,
  includeRecentActivity = false,
}: {
  currentUserId: string | null;
  widgetIds: SecondaryWidgetId[];
  includeRecentActivity?: boolean;
}) {
  if (widgetIds.length === 0 && !includeRecentActivity) {
    return null;
  }

  return (
    <>
      {widgetIds.length > 0 ? (
        <div className="flex flex-col gap-3">
          {widgetIds.map((widgetId) => (
            <div key={widgetId}>
              {renderSecondaryWidget(widgetId, currentUserId)}
            </div>
          ))}
        </div>
      ) : null}
      {includeRecentActivity ? (
        <div className={widgetIds.length > 0 ? "mt-3 min-h-[236px]" : ""}>
          <RecentActivity currentUserId={currentUserId} />
        </div>
      ) : null}
    </>
  );
}
