"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  DashboardWidgetStack,
  getOrderedWidgets,
  type WidgetConfig,
} from "./dashboard-widget-stack";
import { cn } from "@/lib/utils";

function SortableWidget({
  currentUserId,
  widget,
  isDraggingAny,
}: {
  currentUserId: string | null;
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
      data-dashboard-widget={widget.id}
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
      {widget.component({ currentUserId })}
    </div>
  );
}

export function SortableDashboard({
  currentUserId,
  order,
  onOrderChange,
}: {
  currentUserId: string | null;
  order: string[];
  onOrderChange: (nextOrder: string[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
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

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    onOrderChange(arrayMove(order, oldIndex, newIndex));
  }, [onOrderChange, order]);

  const activeWidget = activeId
    ? getOrderedWidgets(order).find((widget) => widget.id === activeId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <DashboardWidgetStack
          currentUserId={currentUserId}
          order={order}
          renderWidget={(widget) => (
            <SortableWidget
              key={widget.id}
              currentUserId={currentUserId}
              widget={widget}
              isDraggingAny={activeId !== null}
            />
          )}
        />
      </SortableContext>

      <DragOverlay
        dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {activeWidget ? (
          <div className="pointer-events-none rounded-xl opacity-90 shadow-xl ring-1 ring-primary/20 scale-[1.02]">
            {activeWidget.component({ currentUserId })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
