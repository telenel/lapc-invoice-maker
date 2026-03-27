"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuickPickForm } from "./quick-pick-form";

interface QuickPickItem {
  id: string;
  department: string;
  description: string;
  defaultPrice: string | number;
  usageCount: number;
}

export function QuickPickTable() {
  const [items, setItems] = useState<QuickPickItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/quick-picks");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    } else {
      toast.error("Failed to load quick-pick items");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this quick-pick item?")) return;

    const res = await fetch(`/api/quick-picks/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Item deleted");
      fetchItems();
    } else {
      toast.error("Failed to delete item");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quick-Pick Items</h1>
        <QuickPickForm
          onSave={fetchItems}
          trigger={
            <Button>
              <PlusIcon />
              Add Item
            </Button>
          }
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No quick-pick items yet. Add one to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Default Price</TableHead>
              <TableHead>Times Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {item.department === "__ALL__" ? "All Departments" : item.department}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  $
                  {Number(item.defaultPrice).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>{item.usageCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <QuickPickForm
                      item={item}
                      onSave={fetchItems}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Edit quick pick">
                          <PencilIcon />
                          <span className="sr-only">Edit</span>
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete quick pick"
                      onClick={() => handleDelete(item.id)}
                    >
                      <TrashIcon className="text-destructive" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
