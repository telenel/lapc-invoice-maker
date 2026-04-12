"use client";

import { startTransition, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const TodaysEvents = dynamic(
  () => import("./todays-events").then((m) => m.TodaysEvents),
  { ssr: false },
);
const YourFocus = dynamic(
  () => import("./your-focus").then((m) => m.YourFocus),
  { ssr: false },
);
const PendingAccounts = dynamic(
  () => import("./pending-accounts").then((m) => m.PendingAccountsWidget),
  { ssr: false },
);
const DashboardSecondaryWidgetGroup = dynamic(
  () =>
    import("./dashboard-secondary-widget-group").then(
      (m) => m.DashboardSecondaryWidgetGroup,
    ),
  { ssr: false },
);

type WidgetId =
  | "todays-events"
  | "your-focus"
  | "pending-accounts"
  | "stats"
  | "pending-charges"
  | "running-invoices";

type SecondaryWidgetId = Exclude<
  WidgetId,
  "todays-events" | "your-focus" | "pending-accounts"
>;

const SKELETON_CLASS_BY_ID: Record<WidgetId | "recent-activity", string> = {
  "todays-events": "h-[120px]",
  "your-focus": "h-[172px]",
  "pending-accounts": "h-[172px]",
  stats: "h-[156px]",
  "pending-charges": "h-[148px]",
  "running-invoices": "h-[148px]",
  "recent-activity": "h-[236px]",
};

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function WidgetSkeleton({ className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20",
        className,
      )}
    />
  );
}

function isSecondaryWidgetId(widgetId: WidgetId): widgetId is SecondaryWidgetId {
  return (
    widgetId === "stats" ||
    widgetId === "pending-charges" ||
    widgetId === "running-invoices"
  );
}

function ImmediatePreviewWidget({
  currentUserId,
  widgetId,
}: {
  currentUserId: string | null;
  widgetId: WidgetId;
}) {
  switch (widgetId) {
    case "todays-events":
      return <TodaysEvents />;
    case "your-focus":
      return <YourFocus currentUserId={currentUserId} />;
    case "pending-accounts":
      return <PendingAccounts currentUserId={currentUserId} />;
    case "stats":
    case "pending-charges":
    case "running-invoices":
      return (
        <DashboardSecondaryWidgetGroup
          currentUserId={currentUserId}
          widgetIds={[widgetId]}
        />
      );
    default:
      return null;
  }
}

function DeferredMount({
  children,
  fallback,
  delay = 1200,
}: {
  children: ReactNode;
  fallback: ReactNode;
  delay?: number;
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

    const fallbackTimer = window.setTimeout(markReady, delay);

    if (win.requestIdleCallback) {
      handleRef.current = win.requestIdleCallback(
        () => {
          markReady();
          handleRef.current = null;
        },
        { timeout: delay + 1000 },
      );
    } else {
      handleRef.current = window.setTimeout(() => {
        markReady();
        handleRef.current = null;
      }, Math.max(300, delay - 400));
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      if (handleRef.current === null) {
        return;
      }

      if (win.cancelIdleCallback) {
        win.cancelIdleCallback(handleRef.current);
      } else {
        window.clearTimeout(handleRef.current);
      }
    };
  }, [delay, ready]);

  return ready ? children : fallback;
}

export function DashboardPreviewStack({
  currentUserId,
  order,
}: {
  currentUserId: string | null;
  order: string[];
}) {
  const previewOrder = order.filter(
    (widgetId): widgetId is WidgetId => widgetId in SKELETON_CLASS_BY_ID,
  );
  const leadingWidgetIds = previewOrder.slice(0, 3);
  const deferredSecondaryIds = previewOrder
    .slice(3)
    .filter(isSecondaryWidgetId);

  return (
    <>
      <div className="flex flex-col gap-3">
        {leadingWidgetIds.map((widgetId) => (
          <div key={widgetId}>
            <ImmediatePreviewWidget
              currentUserId={currentUserId}
              widgetId={widgetId}
            />
          </div>
        ))}

        {deferredSecondaryIds.map((widgetId, index) => (
          <DeferredMount
            key={widgetId}
            delay={1200 + index * 250}
            fallback={
              <WidgetSkeleton className={SKELETON_CLASS_BY_ID[widgetId]} />
            }
          >
            <DashboardSecondaryWidgetGroup
              currentUserId={currentUserId}
              widgetIds={[widgetId]}
            />
          </DeferredMount>
        ))}
      </div>

      <div className="mt-3 min-h-[236px]">
        <DeferredMount
          delay={1800}
          fallback={
            <WidgetSkeleton
              className={SKELETON_CLASS_BY_ID["recent-activity"]}
            />
          }
        >
          <DashboardSecondaryWidgetGroup
            currentUserId={currentUserId}
            widgetIds={[]}
            includeRecentActivity
          />
        </DeferredMount>
      </div>
    </>
  );
}
