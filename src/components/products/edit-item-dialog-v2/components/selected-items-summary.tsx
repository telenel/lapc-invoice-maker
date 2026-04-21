"use client";

import type { EditItemDialogProps } from "../../edit-item-dialog-legacy";
import { Section } from "./section";

/**
 * Summary card listing the items currently selected for editing. Visible at
 * the top of the dialog body, above the tab list. Behavior unchanged from
 * the monolith (Phase 1 extraction only).
 */
export function SelectedItemsSummary({
  items,
}: {
  items: EditItemDialogProps["items"];
}) {
  const title = items.length === 1 ? "Selected item" : "Selected items";
  const subtitle =
    items.length === 1
      ? "Review the item identity before saving changes."
      : `${items.length} items will receive the same shared field updates.`;

  return (
    <Section title={title} description={subtitle}>
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const typeLabel = item.isTextbook ? "Textbook" : "Merchandise";
          const displayName = item.description?.trim() || `SKU ${item.sku}`;

          return (
            <div
              key={item.sku}
              className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">SKU {item.sku}</div>
                  <div className="font-medium text-foreground">{displayName}</div>
                </div>
                <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {typeLabel}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {item.barcode ? <span>{item.barcode}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
