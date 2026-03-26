"use client";

import { InvoiceItem } from "./invoice-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface LineItemsProps {
  items: InvoiceItem[];
  onUpdate: (index: number, updates: Partial<InvoiceItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  total: number;
}

export function LineItems({
  items,
  onUpdate,
  onAdd,
  onRemove,
  total,
}: LineItemsProps) {
  return (
    <div className="space-y-2">
      {/* Header row + Add button */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-12 gap-2 flex-1 mr-2">
          <div className="col-span-5">
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
          <div className="col-span-1" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          +
        </Button>
      </div>

      {/* Line item rows */}
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-12 gap-2 items-center">
          {/* Description — col-span-5 */}
          <div className="col-span-5">
            <Input
              value={item.description}
              onChange={(e) => onUpdate(index, { description: e.target.value })}
              placeholder="Description"
            />
          </div>

          {/* Qty — col-span-2 */}
          <div className="col-span-2">
            <Input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                onUpdate(index, { quantity: Number(e.target.value) })
              }
              placeholder="Qty"
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
              placeholder="0.00"
            />
          </div>

          {/* Extended — col-span-2, readonly */}
          <div className="col-span-2">
            <Input
              readOnly
              value={`$${item.extendedPrice.toFixed(2)}`}
              className="bg-muted"
            />
          </div>

          {/* Remove — col-span-1 */}
          <div className="col-span-1 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              disabled={items.length === 1}
              className="text-destructive hover:text-destructive"
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
