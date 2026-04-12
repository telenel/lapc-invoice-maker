"use client";

import dynamic from "next/dynamic";

const StatsCards = dynamic(
  () => import("./stats-cards").then((m) => m.StatsCards),
  { ssr: false },
);
const PendingCharges = dynamic(
  () => import("./pending-charges").then((m) => m.PendingCharges),
  { ssr: false },
);
const RunningInvoices = dynamic(
  () => import("./running-invoices").then((m) => m.RunningInvoices),
  { ssr: false },
);
const RecentActivity = dynamic(
  () => import("./recent-invoices").then((m) => m.RecentActivity),
  { ssr: false },
);

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
