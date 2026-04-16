"use client";

import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InvoiceItem } from "./invoice-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Case-insensitive check so picks saved as "Coffee" still match "COFFEE". */
function hasPickMatch(picks: Set<string>, description: string): boolean {
  const upper = description.toUpperCase();
  return Array.from(picks).some((p) => p.toUpperCase() === upper);
}

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
  /** Whether margin pricing is enabled (quote mode) */
  marginEnabled?: boolean;
  /** Items with margin-adjusted extended prices (quote mode) */
  itemsWithMargin?: InvoiceItem[];
  /** Whether sales tax is enabled (quote mode) */
  taxEnabled?: boolean;
  /** Whether this is a catering event (forces all items taxable) */
  isCateringEvent?: boolean;
}

export function LineItems({
  items,
  onUpdate,
  onAdd,
  onRemove,
  total,
  department,
  // firstDescriptionRef and focusQtyForRow are accepted for API compatibility
  suggestions = [],
  userPickDescriptions = new Set<string>(),
  onTogglePick,
  marginAppliedIndices = new Set<number>(),
  marginEnabled = false,
  itemsWithMargin,
  taxEnabled = false,
  isCateringEvent = false,
}: LineItemsProps) {
  // Refs for qty fields so we can programmatically focus
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
      <AnimatePresence mode="popLayout">
      {items.map((item, index) => (
        <motion.div
          key={item._key}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -100, height: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 line-item-row"
        >
          {/* Row 1: SKU + Description with actions */}
          <div className="flex gap-2 items-start">
            <Input
              type="text"
              value={item.sku ?? ""}
              onChange={(e) => onUpdate(index, { sku: e.target.value || null })}
              placeholder="SKU"
              className="w-20 h-8 text-xs tabular-nums shrink-0"
              aria-label={`Line item ${index + 1} SKU`}
              tabIndex={-1}
            />
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                value={item.description}
                onChange={(e) => onUpdate(index, { description: e.target.value.toUpperCase() })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    requestAnimationFrame(() => qtyRefs.current[index]?.focus());
                  }
                }}
                placeholder="Item description..."
                className="h-8 text-sm"
                aria-label={`Line item ${index + 1} description`}
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
                    hasPickMatch(userPickDescriptions, item.description)
                      ? "text-amber-500 hover:text-amber-600"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={
                    hasPickMatch(userPickDescriptions, item.description)
                      ? "Remove from quick picks"
                      : "Save to quick picks"
                  }
                >
                  <Star
                    className="h-3.5 w-3.5"
                    fill={hasPickMatch(userPickDescriptions, item.description) ? "currentColor" : "none"}
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

          {/* Row 2: Qty, Unit Price, Charged (margin), Extended, Taxable */}
          <div className="flex flex-wrap items-center gap-3">
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
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                {marginEnabled ? "Cost" : "Price"}
              </Label>
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
            {marginEnabled && itemsWithMargin && (
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-violet-600 whitespace-nowrap">Charged</Label>
                <span
                  className="text-sm font-medium tabular-nums text-violet-600"
                  aria-label={`Line item ${index + 1} charged price`}
                >
                  ${(Number(itemsWithMargin[index]?.extendedPrice ?? 0) / Math.max(item.quantity, 1)).toFixed(2)}
                </span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5 max-sm:w-full max-sm:justify-end">
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  marginEnabled && "text-violet-600"
                )}
                aria-label={`Line item ${index + 1} extended price`}
              >
                ${Number(
                  marginEnabled && itemsWithMargin
                    ? itemsWithMargin[index]?.extendedPrice ?? 0
                    : item.extendedPrice
                ).toFixed(2)}
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

          {/* Row 3: Taxable checkbox (only when tax enabled) */}
          {taxEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`taxable-${index}`}
                checked={item.isTaxable}
                disabled={isCateringEvent}
                onCheckedChange={(checked) =>
                  onUpdate(index, { isTaxable: checked === true })
                }
                className={cn(
                  item.isTaxable
                    ? "data-[checked]:bg-green-600 data-[checked]:border-green-600"
                    : ""
                )}
              />
              <Label
                htmlFor={`taxable-${index}`}
                className={cn(
                  "text-xs cursor-pointer",
                  item.isTaxable
                    ? "text-green-700 dark:text-green-400"
                    : "text-muted-foreground"
                )}
              >
                Taxable
                {isCateringEvent && (
                  <span className="text-muted-foreground ml-1">(catering)</span>
                )}
              </Label>
            </div>
          )}
        </motion.div>
      ))}
      </AnimatePresence>

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
