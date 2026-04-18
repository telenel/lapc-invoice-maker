"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveView } from "@/domains/product/views-api";
import type { ColumnPreferences, ProductFilters, SavedView } from "@/domains/product/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFilters;
  columnPreferences: ColumnPreferences | null;
  onSaved: (view: SavedView) => void;
}

export function SaveViewDialog({ open, onOpenChange, filters, columnPreferences, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const view = await saveView({ name: name.trim(), description: description.trim() || null, filter: filters as unknown as Record<string, unknown>, columnPreferences });
      onSaved(view);
      onOpenChange(false);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save View</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby={error ? "view-error" : undefined}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="view-description">Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="view-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          {error && (
            <p id="view-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save View"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
