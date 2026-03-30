"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "laportal-dashboard-order";

function WidgetSkeleton() {
  return <div className="h-32 rounded-xl border border-border/60 bg-muted/20" />;
}

const StatsCards = dynamic(
  () => import("./stats-cards").then((m) => m.StatsCards),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);
const PendingCharges = dynamic(
  () => import("./pending-charges").then((m) => m.PendingCharges),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);
const RunningInvoices = dynamic(
  () => import("./running-invoices").then((m) => m.RunningInvoices),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);
const RecentActivity = dynamic(
  () => import("./recent-invoices").then((m) => m.RecentActivity),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);
const YourFocus = dynamic(
  () => import("./your-focus").then((m) => m.YourFocus),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);
const TodaysEvents = dynamic(
  () => import("./todays-events").then((m) => m.TodaysEvents),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);

interface WidgetConfig {
  id: string;
  label: string;
  component: () => ReactNode;
}

const SORTABLE_WIDGETS: WidgetConfig[] = [
  { id: "todays-events", label: "Today's Events", component: () => <TodaysEvents /> },
  { id: "your-focus", label: "Your Focus", component: () => <YourFocus /> },
  { id: "stats", label: "Stats", component: () => <StatsCards /> },
  { id: "pending-charges", label: "Pending Charges", component: () => <PendingCharges /> },
  { id: "running-invoices", label: "Running Invoices", component: () => <RunningInvoices /> },
];

const DEFAULT_ORDER = SORTABLE_WIDGETS.map((w) => w.id);

function getStoredOrder(): string[] {
  if (typeof window === "undefined") return DEFAULT_ORDER;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_ORDER;
    const parsed = JSON.parse(stored) as string[];
    const defaultSet = new Set(DEFAULT_ORDER);
    const storedSet = new Set(parsed);
    if (parsed.length !== DEFAULT_ORDER.length || !parsed.every((id) => defaultSet.has(id))) {
      const valid = parsed.filter((id) => defaultSet.has(id));
      const missing = DEFAULT_ORDER.filter((id) => !storedSet.has(id));
      return [...valid, ...missing];
    }
    return parsed;
  } catch {
    return DEFAULT_ORDER;
  }
}

function SortableWidget({
  widget,
  isDraggingAny,
}: {
  widget: WidgetConfig;
  isDraggingAny: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        isDragging && "z-50 opacity-50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -left-7 top-1/2 -translate-y-1/2 flex items-center justify-center",
          "w-5 h-7 rounded-md cursor-grab active:cursor-grabbing",
          "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/80",
          "transition-opacity duration-150",
          isDraggingAny ? "opacity-60" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label={`Drag to reorder ${widget.label}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      {widget.component()}
    </div>
  );
}

export function DraggableDashboard() {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setOrder(getStoredOrder());
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      const newOrder = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
      return newOrder;
    });
  }, []);

  const handleReset = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isCustomOrder = mounted && JSON.stringify(order) !== JSON.stringify(DEFAULT_ORDER);

  const widgetMap = new Map(SORTABLE_WIDGETS.map((w) => [w.id, w]));
  const orderedWidgets = order.map((id) => widgetMap.get(id)).filter(Boolean) as WidgetConfig[];
  const activeWidget = activeId ? widgetMap.get(activeId) : null;

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {orderedWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                isDraggingAny={activeId !== null}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}>
          {activeWidget ? (
            <div className="opacity-90 scale-[1.02] shadow-xl rounded-xl ring-1 ring-primary/20 pointer-events-none">
              {activeWidget.component()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Recent Invoices — always pinned to bottom */}
      <div className="mt-3">
        <RecentActivity />
      </div>
    </div>
  );
}
