"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_ORDER } from "./dashboard-widget-stack";
import { SortableDashboard } from "./sortable-dashboard";
import { useDashboardOrder } from "./use-dashboard-order";

export function DraggableDashboard({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const {
    order: storedOrder,
    setPersistedOrder,
  } = useDashboardOrder(DEFAULT_ORDER);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    setOrder(storedOrder);
  }, [storedOrder]);

  const handleOrderChange = useCallback((nextOrder: string[]) => {
    setOrder(nextOrder);
    setPersistedOrder(nextOrder);
  }, [setPersistedOrder]);

  return (
    <div className="relative">
      <SortableDashboard
        currentUserId={currentUserId}
        order={order}
        onOrderChange={handleOrderChange}
      />
    </div>
  );
}
