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
    <div className="space-y-2">
      {/* Header row + Add button */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-12 gap-2 flex-1 mr-2">
          <div className="col-span-4">
            <Label className="text-xs text-muted-foreground">Description</Label>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Qty</Label>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Unit Price</Label>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Extended</Label>
          </div>
          <div className="col-span-2" />
        </div>
        <Button
          ref={addButtonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          aria-label="Add line item"
          className="focus-visible:ring-2 focus-visible:ring-ring"
        >
          +
        </Button>
      </div>

      {/* Line item rows */}
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-12 gap-2 items-center line-item-row"
        >
          {/* Description — col-span-4 */}
          <div
            className="col-span-4"
            onKeyDown={(e) => {
              // When dropdown is closed, Enter should advance to qty
              // InlineCombobox consumes Enter when open, so this only fires when closed
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
              allowCustom={true}
              placeholder="Description…"
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
            />
          </div>

          {/* Qty — col-span-2 */}
          <div className="col-span-2">
            <Input
              ref={(el) => {
                qtyRefs.current[index] = el;
              }}
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                onUpdate(index, { quantity: Number(e.target.value) })
              }
              onKeyDown={(e) => handleQtyKeyDown(e, index)}
              placeholder="Qty…"
              name={`lineItem${index}Qty`}
              inputMode="numeric"
              className="focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Line item ${index + 1} quantity`}
            />
          </div>

          {/* Unit Price — col-span-2 */}
          <div className="col-span-2">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={item.unitPrice}
              onChange={(e) =>
                onUpdate(index, { unitPrice: Number(e.target.value) })
              }
              onKeyDown={(e) => handleUnitPriceKeyDown(e, index)}
              placeholder="0.00…"
              name={`lineItem${index}UnitPrice`}
              inputMode="decimal"
              className="focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Line item ${index + 1} unit price`}
            />
          </div>

          {/* Extended — col-span-2, readonly */}
          <div className="col-span-2">
            <Input
              readOnly
              tabIndex={-1}
              value={`$${Number(item.extendedPrice).toFixed(2)}`}
              className="bg-muted tabular-nums"
              aria-label={`Line item ${index + 1} extended price`}
            />
          </div>

          {/* Star + Remove — col-span-2 */}
          <div className="col-span-2 flex justify-center gap-1">
            {item.description.trim() !== "" && item.unitPrice > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onTogglePick?.(item.description, item.unitPrice, department)}
                className={cn(
                  "focus-visible:ring-2 focus-visible:ring-ring",
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
                  className="h-4 w-4"
                  fill={userPickDescriptions.has(item.description) ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              disabled={items.length === 1}
              className="text-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove line item ${index + 1}`}
            >
              ×
            </Button>
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
