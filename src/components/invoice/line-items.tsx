"use client";

import { useRef, useCallback } from "react";
import { InvoiceItem } from "./invoice-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import { cn } from "@/lib/utils";

interface LineItemsProps {
  items: InvoiceItem[];
  onUpdate: (index: number, updates: Partial<InvoiceItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  total: number;
  department: string;
  /** Ref forwarded from parent so it can auto-focus the first description field */
  firstDescriptionRef?: React.RefObject<HTMLInputElement | null>;
  /** Called when a quick-pick fills a row so we can focus its qty field */
  focusQtyForRow?: (index: number) => void;
  /** Autocomplete suggestions for description field */
  suggestions?: { description: string; unitPrice: number }[];
  /** Descriptions in user's quick picks (for star state) */
  userPickDescriptions?: Set<string>;
  /** Called when user stars/unstars a line item */
  onTogglePick?: (description: string, unitPrice: number, department: string) => void;
  /** Indices of items that have had margin applied */
  marginAppliedIndices?: Set<number>;
}

export function LineItems({
  items,
  onUpdate,
  onAdd,
  onRemove,
  total,
  department,
  // firstDescriptionRef and focusQtyForRow are accepted for API compatibility
  // but not used now that description uses InlineCombobox
  suggestions = [],
  userPickDescriptions = new Set<string>(),
  onTogglePick,
  marginAppliedIndices = new Set<number>(),
}: LineItemsProps) {
  // Refs for qty fields so we can programmatically focus
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  // Convert suggestions to ComboboxItem format
  const suggestionItems: ComboboxItem[] = suggestions.map((s) => ({
    id: s.description,
    label: s.description,
    sublabel: `$${Number(s.unitPrice).toFixed(2)}`,
    searchValue: s.description,
  }));

  function handleAddItem() {
    onAdd();
  }

  // Tab out of last unit-price field → auto-add a new row
  function handleUnitPriceKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === "Tab" && !e.shiftKey && index === items.length - 1) {
      e.preventDefault();
      onAdd();
    }
  }

  // Enter on qty → focus unit price of same row
  function handleQtyKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Unit price input is the sibling — we navigate via normal focus
      const qtyEl = qtyRefs.current[index];
      if (qtyEl) {
        // Move focus to the next focusable sibling (unit price input)
        const row = qtyEl.closest(".line-item-row");
        if (row) {
          const inputs = Array.from(row.querySelectorAll("input:not([readonly])"));
          const qtyIdx = inputs.indexOf(qtyEl);
          (inputs[qtyIdx + 1] as HTMLInputElement | undefined)?.focus();
        }
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</Label>
        <Button
          ref={addButtonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          aria-label="Add line item"
          className="focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Add Item
        </Button>
      </div>

      {/* Line item cards */}
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 line-item-row"
        >
          {/* Row 1: Full-width description with actions */}
          <div className="flex gap-2 items-start">
            <div
              className="flex-1 min-w-0"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  requestAnimationFrame(() => qtyRefs.current[index]?.focus());
                }
              }}
            >
              <InlineCombobox
                items={suggestionItems}
                value={item.description}
                displayValue={item.description}
                placeholder="Item description…"
                onSelect={(selected) => {
                  const match = suggestions.find((s) => s.description === selected.id);
                  onUpdate(index, {
                    description: selected.label,
                    ...(match
                      ? { unitPrice: match.unitPrice, quantity: 1, extendedPrice: match.unitPrice }
                      : {}),
                  });
                  requestAnimationFrame(() => qtyRefs.current[index]?.focus());
                }}
                onCommitText={(text) => {
                  onUpdate(index, { description: text });
                  requestAnimationFrame(() => qtyRefs.current[index]?.focus());
                }}
              />
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {item.description.trim() !== "" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onTogglePick?.(item.description, item.unitPrice, department)}
                  className={cn(
                    userPickDescriptions.has(item.description)
                      ? "text-amber-500 hover:text-amber-600"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={
                    userPickDescriptions.has(item.description)
                      ? "Remove from quick picks"
                      : "Save to quick picks"
                  }
                >
                  <Star
                    className="h-3.5 w-3.5"
                    fill={userPickDescriptions.has(item.description) ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(index)}
                disabled={items.length === 1}
                className="text-destructive hover:text-destructive"
                aria-label={`Remove line item ${index + 1}`}
              >
                ×
              </Button>
            </div>
          </div>

          {/* Row 2: Qty, Unit Price, Extended */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Qty</Label>
              <Input
                ref={(el) => { qtyRefs.current[index] = el; }}
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => onUpdate(index, { quantity: Number(e.target.value) })}
                onKeyDown={(e) => handleQtyKeyDown(e, index)}
                name={`lineItem${index}Qty`}
                inputMode="numeric"
                className="w-16 h-8 text-sm"
                aria-label={`Line item ${index + 1} quantity`}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Price</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={item.unitPrice}
                onChange={(e) => onUpdate(index, { unitPrice: Number(e.target.value) })}
                onKeyDown={(e) => handleUnitPriceKeyDown(e, index)}
                name={`lineItem${index}UnitPrice`}
                inputMode="decimal"
                className="w-24 h-8 text-sm"
                aria-label={`Line item ${index + 1} unit price`}
              />
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span
                className="text-sm font-medium tabular-nums"
                aria-label={`Line item ${index + 1} extended price`}
              >
                ${Number(item.extendedPrice).toFixed(2)}
              </span>
              {marginAppliedIndices.has(index) && (
                <span
                  className="text-[10px] font-medium text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950 px-1 py-0.5 rounded leading-none"
                  title="Margin applied"
                >
                  M
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Total */}
      <div className="flex justify-end pt-2 border-t">
        <span className="text-sm font-semibold tabular-nums">
          Total: ${Number(total).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/**
 * Expose a stable callback that parent can call to focus the qty field
 * of a given line-item row index.
 */
export function useLineItemFocusQty(
  qtyRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
) {
  return useCallback(
    (index: number) => {
      requestAnimationFrame(() => {
        qtyRefs.current[index]?.focus();
      });
    },
    [qtyRefs]
  );
}
