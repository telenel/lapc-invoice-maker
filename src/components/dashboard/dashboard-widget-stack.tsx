"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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

const StatsCards = dynamic(
  () => import("./stats-cards").then((m) => m.StatsCards),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[156px]" /> },
);
const PendingCharges = dynamic(
  () => import("./pending-charges").then((m) => m.PendingCharges),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[148px]" /> },
);
const RunningInvoices = dynamic(
  () => import("./running-invoices").then((m) => m.RunningInvoices),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[148px]" /> },
);
const RecentActivity = dynamic(
  () => import("./recent-invoices").then((m) => m.RecentActivity),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[236px]" /> },
);
const YourFocus = dynamic(
  () => import("./your-focus").then((m) => m.YourFocus),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[172px]" /> },
);
const TodaysEvents = dynamic(
  () => import("./todays-events").then((m) => m.TodaysEvents),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[120px]" /> },
);
const PendingAccounts = dynamic(
  () => import("./pending-accounts").then((m) => m.PendingAccountsWidget),
  { ssr: false, loading: () => <WidgetSkeleton className="h-[172px]" /> },
);

export interface DashboardWidgetProps {
  currentUserId: string | null;
}

export interface WidgetConfig {
  id: string;
  label: string;
  skeletonClassName: string;
  component: (props: DashboardWidgetProps) => ReactNode;
}

export const SORTABLE_WIDGETS: WidgetConfig[] = [
  {
    id: "todays-events",
    label: "Today's Events",
    skeletonClassName: "h-[120px]",
    component: () => <TodaysEvents />,
  },
  {
    id: "your-focus",
    label: "Your Focus",
    skeletonClassName: "h-[172px]",
    component: ({ currentUserId }) => <YourFocus currentUserId={currentUserId} />,
  },
  {
    id: "pending-accounts",
    label: "Pending Account Numbers",
    skeletonClassName: "h-[172px]",
    component: ({ currentUserId }) => (
      <PendingAccounts currentUserId={currentUserId} />
    ),
  },
  {
    id: "stats",
    label: "Stats",
    skeletonClassName: "h-[156px]",
    component: ({ currentUserId }) => <StatsCards currentUserId={currentUserId} />,
  },
  {
    id: "pending-charges",
    label: "Pending Charges",
    skeletonClassName: "h-[148px]",
    component: () => <PendingCharges />,
  },
  {
    id: "running-invoices",
    label: "Running Invoices",
    skeletonClassName: "h-[148px]",
    component: ({ currentUserId }) => (
      <RunningInvoices currentUserId={currentUserId} />
    ),
  },
];

export const DEFAULT_ORDER = SORTABLE_WIDGETS.map((widget) => widget.id);

const WIDGET_MAP = new Map(SORTABLE_WIDGETS.map((widget) => [widget.id, widget]));

export function getOrderedWidgets(order: string[]) {
  return order
    .map((id) => WIDGET_MAP.get(id))
    .filter(Boolean) as WidgetConfig[];
}

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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

export function DashboardWidgetStack({
  currentUserId,
  order,
  renderWidget,
  deferAfter = Number.POSITIVE_INFINITY,
  deferPinnedRecentActivity = false,
}: {
  currentUserId: string | null;
  order: string[];
  renderWidget: (widget: WidgetConfig, index: number) => ReactNode;
  deferAfter?: number;
  deferPinnedRecentActivity?: boolean;
}) {
  const orderedWidgets = getOrderedWidgets(order);

  return (
    <>
      <div className="flex flex-col gap-3">
        {orderedWidgets.map((widget, index) => {
          const content = renderWidget(widget, index);

          if (index < deferAfter) {
            return content;
          }

          return (
            <DeferredMount
              key={widget.id}
              delay={1200 + (index - deferAfter) * 250}
              fallback={<WidgetSkeleton className={widget.skeletonClassName} />}
            >
              {content}
            </DeferredMount>
          );
        })}
      </div>
      <div className="mt-3 min-h-[236px]">
        {deferPinnedRecentActivity ? (
          <DeferredMount
            delay={1800}
            fallback={<WidgetSkeleton className="h-[236px]" />}
          >
            <RecentActivity currentUserId={currentUserId} />
          </DeferredMount>
        ) : (
          <RecentActivity currentUserId={currentUserId} />
        )}
      </div>
    </>
  );
}
