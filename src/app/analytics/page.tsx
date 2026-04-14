import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { authOptions } from "@/lib/auth";
import { analyticsService } from "@/domains/analytics/service";

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: to.toISOString().split("T")[0],
  };
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const initialDateRange = getDefaultDateRange();
  const initialData = await analyticsService.getAnalytics(initialDateRange);

  return (
    <AnalyticsDashboard
      initialData={initialData}
      initialDateFrom={initialDateRange.dateFrom}
      initialDateTo={initialDateRange.dateTo}
    />
  );
}
