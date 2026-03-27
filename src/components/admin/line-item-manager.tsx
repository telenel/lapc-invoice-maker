"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatAmount } from "@/lib/formatters";

interface SavedLineItem {
  id: string;
  description: string;
  department: string;
  unitPrice: number;
  usageCount: number;
}

export function LineItemManager() {
  const [items, setItems] = useState<SavedLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  // Edit form
  const [editItem, setEditItem] = useState<SavedLineItem | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteItem, setDeleteItem] = useState<SavedLineItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-items");
      if (res.ok) {
        setItems(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.description.toLowerCase().includes(q) ||
      item.department.toLowerCase().includes(q)
    );
  });

  function resetCreate() {
    setNewDescription("");
    setNewDepartment("");
    setNewPrice("");
    setCreateError(null);
  }

  async function handleCreate() {
    setCreateError(null);
    setCreateSaving(true);
    try {
      const res = await fetch("/api/saved-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newDescription.trim(),
          department: newDepartment.trim(),
          unitPrice: Number(newPrice),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(typeof data.error === "string" ? data.error : "Failed to save");
        return;
      }
      toast.success("Line item saved");
      setCreateOpen(false);
      resetCreate();
      fetchItems();
    } catch {
      setCreateError("An unexpected error occurred");
    } finally {
      setCreateSaving(false);
    }
  }

  function openEdit(item: SavedLineItem) {
    setEditItem(item);
    setEditDescription(item.description);
    setEditDepartment(item.department);
    setEditPrice(String(item.unitPrice));
    setEditError(null);
  }

  async function handleEdit() {
    if (!editItem) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/saved-items/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription.trim(),
          department: editDepartment.trim(),
          unitPrice: Number(editPrice),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(typeof data.error === "string" ? data.error : "Failed to update");
        return;
      }
      toast.success("Line item updated");
      setEditItem(null);
      fetchItems();
    } catch {
      setEditError("An unexpected error occurred");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/saved-items/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete line item");
        return;
      }
      toast.success("Line item deleted");
      setItems((prev) => prev.filter((i) => i.id !== deleteItem.id));
      setDeleteItem(null);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading line items…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Saved Line Items</h2>
          <p className="text-sm text-muted-foreground">
            Reusable line item templates available when creating invoices.
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
              resetCreate();
            } else {
              setCreateOpen(true);
            }
          }}
        >
          <DialogTrigger render={<Button size="sm">Add Line Item</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Line Item</DialogTitle>
              <DialogDescription>
                Create a reusable line item template.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="li-create-desc">Description</Label>
                <Input
                  id="li-create-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Standard Photocopy Service"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="li-create-dept">Department</Label>
                <Input
                  id="li-create-dept"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="e.g. Media Services"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="li-create-price">Unit Price</Label>
                <Input
                  id="li-create-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreate();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !newDescription.trim() ||
                  !newDepartment.trim() ||
                  !newPrice ||
                  Number(newPrice) < 0 ||
                  createSaving
                }
              >
                {createSaving ? "Saving…" : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search by description or department…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Description</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Times Used</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-sm">{item.description}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.department}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatAmount(item.unitPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                {item.usageCount}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(item)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteItem(item)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-6"
              >
                {search.trim()
                  ? "No line items match your search."
                  : "No saved line items yet. Add one above."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <p className="text-xs text-muted-foreground">
        {items.length} item{items.length !== 1 ? "s" : ""} total
      </p>

      {/* Edit dialog */}
      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Line Item</DialogTitle>
            <DialogDescription>Update the line item details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="li-edit-desc">Description</Label>
              <Input
                id="li-edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="li-edit-dept">Department</Label>
              <Input
                id="li-edit-dept"
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="li-edit-price">Unit Price</Label>
              <Input
                id="li-edit-price"
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={
                !editDescription.trim() ||
                !editDepartment.trim() ||
                !editPrice ||
                Number(editPrice) < 0 ||
                editSaving
              }
            >
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteItem}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Line Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteItem?.description}&rdquo;?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
