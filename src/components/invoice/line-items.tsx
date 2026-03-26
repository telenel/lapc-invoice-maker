"use client";

import { useRef, useEffect, useCallback } from "react";
import { InvoiceItem } from "./invoice-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

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
}

export function LineItems({
  items,
  onUpdate,
  onAdd,
  onRemove,
  total,
  department,
  firstDescriptionRef,
  focusQtyForRow,
}: LineItemsProps) {
  // Refs for every description and qty field so we can programmatically focus
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  // Track pending new-row focus requests
  const pendingFocusRow = useRef<number | null>(null);

  // Expose focusQtyForRow if caller wants it
  useEffect(() => {
    if (focusQtyForRow) {
      // nothing — caller calls via the callback prop
    }
  }, [focusQtyForRow]);

  // When items array grows (new row added), focus its description field
  useEffect(() => {
    if (pendingFocusRow.current !== null) {
      const idx = pendingFocusRow.current;
      pendingFocusRow.current = null;
      // Give React one tick to render the new row
      requestAnimationFrame(() => {
        descRefs.current[idx]?.focus();
      });
    }
  }, [items.length]);

  function handleAddItem() {
    pendingFocusRow.current = items.length; // next index will be current length
    onAdd();
  }

  // Tab out of last unit-price field → auto-add a new row and focus its description
  function handleUnitPriceKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === "Tab" && !e.shiftKey && index === items.length - 1) {
      e.preventDefault();
      pendingFocusRow.current = items.length;
      onAdd();
    }
  }

  // Enter on description → focus qty of the same row
  function handleDescriptionKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      qtyRefs.current[index]?.focus();
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

  async function handleSaveItem(index: number) {
    const item = items[index];
    try {
      const res = await fetch("/api/saved-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: item.description,
          unitPrice: item.unitPrice,
          department,
        }),
      });
      if (!res.ok) throw new Error("Failed to save item");
      toast.success("Item saved for future use");
    } catch {
      toast.error("Failed to save item");
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
          <div className="col-span-4">
            <Input
              ref={(el) => {
                descRefs.current[index] = el;
                // Also wire up firstDescriptionRef for the first row
                if (index === 0 && firstDescriptionRef) {
                  (firstDescriptionRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                }
              }}
              value={item.description}
              onChange={(e) => onUpdate(index, { description: e.target.value })}
              onKeyDown={(e) => handleDescriptionKeyDown(e, index)}
              placeholder="Description"
              className="focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Line item ${index + 1} description`}
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
              placeholder="Qty"
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
              placeholder="0.00"
              className="focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Line item ${index + 1} unit price`}
            />
          </div>

          {/* Extended — col-span-2, readonly */}
          <div className="col-span-2">
            <Input
              readOnly
              tabIndex={-1}
              value={`$${item.extendedPrice.toFixed(2)}`}
              className="bg-muted"
              aria-label={`Line item ${index + 1} extended price`}
            />
          </div>

          {/* Save + Remove — col-span-2 */}
          <div className="col-span-2 flex justify-center gap-1">
            {item.description.trim() !== "" && item.unitPrice > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSaveItem(index)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Save line item ${index + 1} for future use`}
              >
                <Bookmark className="h-4 w-4" />
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
        <span className="text-sm font-semibold">
          Total: ${total.toFixed(2)}
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
