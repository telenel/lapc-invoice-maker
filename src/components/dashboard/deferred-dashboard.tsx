"use client";

import { DraggableDashboard } from "@/components/dashboard/draggable-dashboard";

export function DeferredDashboard({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  return <DraggableDashboard currentUserId={currentUserId} />;
}
