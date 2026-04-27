import type { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import { StatusPill } from "./primitives/status-pill";
import { DocTypeBadge } from "./primitives/doc-type-badge";
import type { ComposerStatus, DocType } from "./types";

interface Props {
  docType: DocType;
  mode: "create" | "edit";
  status: ComposerStatus;
  documentNumber?: string;
  date: string;
  isRunning: boolean;
  actionsRight?: ReactNode;
}

const TYPE_LABELS = {
  invoice: { plural: "Invoices", title: { create: "New Invoice", edit: "Edit Invoice" } },
  quote:   { plural: "Quotes",   title: { create: "New Quote",   edit: "Edit Quote"   } },
} as const;

export function ComposerHeader({
  docType,
  mode,
  status,
  documentNumber,
  date,
  isRunning,
  actionsRight,
}: Props) {
  const t = TYPE_LABELS[docType];
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-2.5 text-[11px]">
        <nav className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-muted-foreground">
          <span className="font-semibold text-primary">LAPORTAL</span>
          <ChevronRightIcon className="size-3" />
          <span>{t.plural}</span>
          <ChevronRightIcon className="size-3" />
          <span className="text-foreground">
            {mode === "create" ? "New" : (documentNumber ?? "Edit")}
          </span>
        </nav>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <DocTypeBadge docType={docType} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-4 px-6 pb-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[22px] font-bold tracking-tight">{t.title[mode]}</h1>
          {documentNumber && (
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {documentNumber}
            </span>
          )}
          <span className="text-muted-foreground/50">·</span>
          <span className="text-sm tabular-nums text-muted-foreground">{date}</span>
          {isRunning && (
            <span className="ml-1 inline-flex items-center rounded-full border border-info-border bg-info-bg px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-info">
              Running
            </span>
          )}
        </div>
        {actionsRight && <div className="flex shrink-0 items-center gap-2">{actionsRight}</div>}
      </div>
    </header>
  );
}
