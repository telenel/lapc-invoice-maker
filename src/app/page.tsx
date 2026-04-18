import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DeferredDashboard } from "@/components/dashboard/deferred-dashboard";
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
    <DeferredDashboard
      currentUserId={currentUserId}
      currentUserName={session.user.name ?? ""}
      initialData={dashboardBootstrap}
    />
  );
}
