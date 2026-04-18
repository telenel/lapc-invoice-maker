"use client";

import { DashboardBootstrapProvider } from "@/components/dashboard/dashboard-bootstrap-provider";
import { DashboardOperatorView } from "@/components/dashboard/dashboard-operator-view";
import type { DashboardBootstrapData } from "@/domains/dashboard/types";

export function DeferredDashboard({
  currentUserId,
  currentUserName,
  initialData,
}: {
  currentUserId: string | null;
  currentUserName: string;
  initialData: DashboardBootstrapData | null;
}) {
  return (
    <DashboardBootstrapProvider value={initialData}>
      <DashboardOperatorView
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </DashboardBootstrapProvider>
  );
}
