"use client";

import { useState, useEffect, useCallback } from "react";
import { categoryApi } from "@/domains/category/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface Category {
  id: string;
  name: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryApi.list(true);
      setCategories(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleCreate() {
    setCreateError(null);
    setCreateSaving(true);
    try {
      const created = await categoryApi.create({ name: newName.trim(), label: newLabel.trim() });
      setCategories((prev) => [...prev, created]);
      setCreateOpen(false);
      setNewName("");
      setNewLabel("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setCreateSaving(false);
    }
  }

  function openEdit(category: Category) {
    setEditCategory(category);
    setEditName(category.name);
    setEditLabel(category.label);
    setEditError(null);
  }

  async function handleEdit() {
    if (!editCategory) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/categories/${editCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), label: editLabel.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to update category");
        return;
      }
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditCategory(null);
    } catch {
      setEditError("An unexpected error occurred");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(category: Category) {
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !category.active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading categories…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
              setNewName("");
              setNewLabel("");
              setCreateError(null);
            } else {
              setCreateOpen(true);
            }
          }}
        >
          <DialogTrigger render={<Button size="sm">Add Category</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
              <DialogDescription>
                Create a new invoice category. The name is the internal key; the label is
                displayed to users.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cat-create-name">Name (internal key)</Label>
                <Input
                  id="cat-create-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. SUPPLIES"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-create-label">Label (displayed to users)</Label>
                <Input
                  id="cat-create-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Supplies"
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
                  setNewName("");
                  setNewLabel("");
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || !newLabel.trim() || createSaving}
              >
                {createSaving ? "Saving…" : "Add Category"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Sort Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id} className={!category.active ? "opacity-50" : ""}>
              <TableCell className="font-mono text-sm">{category.name}</TableCell>
              <TableCell>{category.label}</TableCell>
              <TableCell className="tabular-nums">{category.sortOrder}</TableCell>
              <TableCell>
                <Badge variant={category.active ? "default" : "outline"}>
                  {category.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(category)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(category)}
                >
                  {category.active ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {categories.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                No categories found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Edit dialog */}
      <Dialog
        open={!!editCategory}
        onOpenChange={(open) => {
          if (!open) setEditCategory(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update the category name or label.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-edit-name">Name (internal key)</Label>
              <Input
                id="cat-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-edit-label">Label (displayed to users)</Label>
              <Input
                id="cat-edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCategory(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editName.trim() || !editLabel.trim() || editSaving}
            >
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
