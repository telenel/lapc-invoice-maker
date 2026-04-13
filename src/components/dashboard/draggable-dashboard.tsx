"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";
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
    loaded,
    setPersistedOrder,
    clearPersistedOrder,
  } = useDashboardOrder(DEFAULT_ORDER);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    setOrder(storedOrder);
  }, [storedOrder]);

  const handleOrderChange = useCallback((nextOrder: string[]) => {
    setOrder(nextOrder);
    setPersistedOrder(nextOrder);
  }, [setPersistedOrder]);

  const handleReset = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    clearPersistedOrder();
  }, [clearPersistedOrder]);

  const isCustomOrder = loaded && JSON.stringify(order) !== JSON.stringify(DEFAULT_ORDER);

  return (
    <div className="relative">
      {isCustomOrder && (
        <button
          onClick={handleReset}
          className="absolute -top-8 right-0 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          title="Reset to default layout"
          aria-label="Reset dashboard to default layout"
        >
          <RotateCcw className="h-3 w-3" />
          Reset layout
        </button>
      )}
      <SortableDashboard
        currentUserId={currentUserId}
        order={order}
        onOrderChange={handleOrderChange}
      />
    </div>
  );
}
