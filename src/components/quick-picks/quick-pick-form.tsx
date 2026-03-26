"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuickPickItem {
  id: string;
  department: string;
  description: string;
  defaultPrice: string | number;
  usageCount: number;
}

interface QuickPickFormProps {
  item?: QuickPickItem;
  onSave: () => void;
  trigger: React.ReactNode;
}

export function QuickPickForm({ item, onSave, trigger }: QuickPickFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState(item?.department ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [defaultPrice, setDefaultPrice] = useState(
    item ? String(item.defaultPrice) : ""
  );

  const isEdit = !!item;

  function handleOpen() {
    setDepartment(item?.department ?? "");
    setDescription(item?.description ?? "");
    setDefaultPrice(item ? String(item.defaultPrice) : "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      department,
      description,
      defaultPrice: parseFloat(defaultPrice),
    };

    const url = isEdit ? `/api/quick-picks/${item.id}` : "/api/quick-picks";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErrors = data?.error?.fieldErrors as Record<string, string[]> | undefined;
      const firstFieldError = fieldErrors
        ? (Object.values(fieldErrors)[0]?.[0] ?? undefined)
        : undefined;
      const msg =
        (data?.error?.formErrors as string[] | undefined)?.[0] ??
        firstFieldError ??
        "Failed to save item";
      toast.error(msg);
      return;
    }

    toast.success(isEdit ? "Item updated" : "Item created");
    setOpen(false);
    onSave();
  }

  return (
    <>
      <button type="button" onClick={handleOpen} style={{ display: "contents" }}>
        {trigger}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Quick-Pick" : "Add Quick-Pick"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="qp-department">Department</Label>
              <Input
                id="qp-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. IT…"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qp-description">Description</Label>
              <Input
                id="qp-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Printer paper (ream)…"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qp-price">Default Price</Label>
              <Input
                id="qp-price"
                type="number"
                step="0.01"
                min="0"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
