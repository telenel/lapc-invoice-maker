"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PendingAccountsWidget } from "./pending-accounts";
import { PendingCharges } from "./pending-charges";
import { RecentActivity } from "./recent-invoices";
import { RunningInvoices } from "./running-invoices";
import { StatsCards } from "./stats-cards";
import { TodaysEvents } from "./todays-events";
import { YourFocus } from "./your-focus";

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
      <PendingAccountsWidget currentUserId={currentUserId} />
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
