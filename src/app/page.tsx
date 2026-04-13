import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DeferredDashboard } from "@/components/dashboard/deferred-dashboard";
import { PersonalizedHeader } from "@/components/dashboard/personalized-header";
import { getDashboardBootstrapData } from "@/domains/dashboard/service";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const currentUserId =
    (session.user as { id?: string } | undefined)?.id ?? null;
  const dashboardBootstrap = await getDashboardBootstrapData(currentUserId);

  return (
    <div className="flex flex-col gap-3 -mt-2 pb-0">
      <div className="dashboard-enter dashboard-enter-1">
        <PersonalizedHeader name={session.user.name ?? ""} />
      </div>
      <div className="dashboard-enter dashboard-enter-2">
        <DeferredDashboard
          currentUserId={currentUserId}
          initialData={dashboardBootstrap}
        />
      </div>
    </div>
  );
}
