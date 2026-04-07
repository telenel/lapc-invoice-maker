import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { authOptions } from "@/lib/auth";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <AnalyticsDashboard />;
}
