import { cn } from "@/lib/utils";
import type { RequisitionStatus } from "@/domains/textbook-requisition/types";

const STATUS_CONFIG: Record<RequisitionStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  ORDERED: {
    label: "Ordered",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  ON_SHELF: {
    label: "On Shelf",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
};

interface RequisitionStatusBadgeProps {
  status: RequisitionStatus;
}

export function RequisitionStatusBadge({ status }: RequisitionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
