import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { authOptions } from "@/lib/auth";
import { getDateKeyInLosAngeles, shiftDateKey } from "@/lib/date-utils";

function getDefaultDateRange() {
  const dateTo = getDateKeyInLosAngeles();
  return {
    dateFrom: shiftDateKey(dateTo, { years: -1 }),
    dateTo,
  };
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const initialDateRange = getDefaultDateRange();

  return (
    <AnalyticsDashboard
      initialDateFrom={initialDateRange.dateFrom}
      initialDateTo={initialDateRange.dateTo}
    />
  );
}
