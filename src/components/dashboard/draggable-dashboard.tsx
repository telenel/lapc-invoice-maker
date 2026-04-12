"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { DEFAULT_ORDER } from "./dashboard-widget-stack";
import { useDashboardOrder } from "./use-dashboard-order";

const SortableDashboard = dynamic(
  () => import("./sortable-dashboard").then((m) => m.SortableDashboard),
  { ssr: false },
);
const DashboardPreviewStack = dynamic(
  () => import("./dashboard-preview-stack").then((m) => m.DashboardPreviewStack),
  { ssr: false },
);

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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
  const [dragReady, setDragReady] = useState(false);
  const handleRef = useRef<number | null>(null);

  useEffect(() => {
    setOrder(storedOrder);
  }, [storedOrder]);

  useEffect(() => {
    if (dragReady) {
      return;
    }

    const win = window as IdleCapableWindow;

    function markDragReady() {
      startTransition(() => {
        setDragReady(true);
      });
    }

    function clearScheduledLoad() {
      if (handleRef.current === null) {
        return;
      }

      if (win.cancelIdleCallback) {
        win.cancelIdleCallback(handleRef.current);
      } else {
        window.clearTimeout(handleRef.current);
      }
      handleRef.current = null;
    }

    const fallbackTimer = window.setTimeout(markDragReady, 2500);

    if (win.requestIdleCallback) {
      handleRef.current = win.requestIdleCallback(
        () => {
          markDragReady();
          handleRef.current = null;
        },
        { timeout: 3500 },
      );
    } else {
      handleRef.current = window.setTimeout(() => {
        markDragReady();
        handleRef.current = null;
      }, 1200);
    }

    window.addEventListener("pointerdown", markDragReady, { once: true, passive: true });
    window.addEventListener("keydown", markDragReady, { once: true });
    window.addEventListener("focusin", markDragReady, { once: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      clearScheduledLoad();
      window.removeEventListener("pointerdown", markDragReady);
      window.removeEventListener("keydown", markDragReady);
      window.removeEventListener("focusin", markDragReady);
    };
  }, [dragReady]);

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
      {dragReady ? (
        <SortableDashboard
          currentUserId={currentUserId}
          order={order}
          onOrderChange={handleOrderChange}
        />
      ) : (
        <DashboardPreviewStack
          currentUserId={currentUserId}
          order={order}
        />
      )}
    </div>
  );
}
