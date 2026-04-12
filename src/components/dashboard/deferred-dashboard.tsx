"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const DraggableDashboard = dynamic(
  () =>
    import("@/components/dashboard/draggable-dashboard").then(
      (m) => m.DraggableDashboard,
    ),
  { ssr: false },
);

function WidgetSkeleton({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20",
        className,
      )}
    />
  );
}

function DashboardLoadingShell() {
  return (
    <div className="flex flex-col gap-3">
      <WidgetSkeleton className="h-[120px]" />
      <WidgetSkeleton className="h-[172px]" />
      <WidgetSkeleton className="h-[172px]" />
      <WidgetSkeleton className="h-[156px]" />
      <WidgetSkeleton className="h-[148px]" />
      <WidgetSkeleton className="h-[148px]" />
      <WidgetSkeleton className="h-[236px] mt-3" />
    </div>
  );
}

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function DeferredDashboard({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const [ready, setReady] = useState(false);
  const handleRef = useRef<number | null>(null);

  useEffect(() => {
    if (ready) {
      return;
    }

    const win = window as IdleCapableWindow;

    function markReady() {
      startTransition(() => {
        setReady(true);
      });
    }

    const fallbackTimer = window.setTimeout(markReady, 1500);

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

    function scheduleLoad() {
      clearScheduledLoad();

      if (win.requestIdleCallback) {
        handleRef.current = win.requestIdleCallback(
          () => {
            markReady();
            handleRef.current = null;
          },
          { timeout: 2000 },
        );
        return;
      }

      handleRef.current = window.setTimeout(() => {
        markReady();
        handleRef.current = null;
      }, 600);
    }

    scheduleLoad();

    window.addEventListener("pointerdown", markReady, { once: true, passive: true });
    window.addEventListener("keydown", markReady, { once: true });
    window.addEventListener("focusin", markReady, { once: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      clearScheduledLoad();
      window.removeEventListener("pointerdown", markReady);
      window.removeEventListener("keydown", markReady);
      window.removeEventListener("focusin", markReady);
    };
  }, [ready]);

  return ready ? (
    <DraggableDashboard currentUserId={currentUserId} />
  ) : (
    <DashboardLoadingShell />
  );
}
