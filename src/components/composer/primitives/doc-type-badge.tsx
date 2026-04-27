import { cn } from "@/lib/utils";
import type { DocType } from "../types";

interface Props {
  docType: DocType;
  className?: string;
}

export function DocTypeBadge({ docType, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider",
        docType === "invoice"
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-teal-bg text-teal border-teal/30",
        className,
      )}
    >
      {docType === "invoice" ? "INVOICE" : "QUOTE"}
    </span>
  );
}
