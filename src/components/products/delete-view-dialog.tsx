"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteView } from "@/domains/product/views-api";
import type { SavedView } from "@/domains/product/types";

interface Props {
  view: SavedView | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (view: SavedView) => void;
}

export function DeleteViewDialog({ view, onOpenChange, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      await deleteView(view.id);
      onDeleted(view);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!view} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete View</DialogTitle>
        </DialogHeader>
        <p>
          Delete <strong>{view?.name}</strong>? This can&apos;t be undone.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
