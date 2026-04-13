"use client";

import { DashboardBootstrapProvider } from "@/components/dashboard/dashboard-bootstrap-provider";
import type { DashboardBootstrapData } from "@/domains/dashboard/types";
import { DraggableDashboard } from "@/components/dashboard/draggable-dashboard";

export function DeferredDashboard({
  currentUserId,
  initialData,
}: {
  currentUserId: string | null;
  initialData: DashboardBootstrapData | null;
}) {
  return (
    <DashboardBootstrapProvider value={initialData}>
      <DraggableDashboard currentUserId={currentUserId} />
    </DashboardBootstrapProvider>
  );
}
