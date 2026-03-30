"use client";

import { useState } from "react";
import { X, Trash2, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserResponse } from "@/domains/admin/types";

interface BatchActionBarProps {
  selectedCount: number;
  entityName: string;
  statuses: { value: string; label: string }[];
  users: UserResponse[];
  onBatchAction: (action: "status" | "reassign" | "delete", value?: string) => Promise<void>;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  entityName,
  statuses,
  users,
  onBatchAction,
  onClearSelection,
}: BatchActionBarProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    action: "status" | "reassign" | "delete";
    value?: string;
    label: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  function requestAction(action: "status" | "reassign" | "delete", value?: string, label?: string) {
    setConfirmDialog({ action, value, label: label ?? action });
  }

  async function executeAction() {
    if (!confirmDialog) return;
    setLoading(true);
    try {
      await onBatchAction(confirmDialog.action, confirmDialog.value);
    } finally {
      setLoading(false);
      setConfirmDialog(null);
    }
  }

  if (selectedCount === 0) return null;

  const plural = selectedCount === 1 ? entityName : `${entityName}s`;

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
        <span className="text-sm font-medium">{selectedCount} {plural} selected</span>
        <div className="h-4 w-px bg-border" />
        <Select onValueChange={(v) => { const val = v as string; const s = statuses.find((x) => x.value === val); requestAction("status", val, `Change status to ${s?.label ?? val}`); }}>
          <SelectTrigger className="h-8 w-auto gap-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /><SelectValue placeholder="Change Status" /></SelectTrigger>
          <SelectContent>{statuses.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select onValueChange={(v) => { const val = v as string; const u = users.find((x) => x.id === val); requestAction("reassign", val, `Reassign to ${u?.name ?? "user"}`); }}>
          <SelectTrigger className="h-8 w-auto gap-1.5 text-xs"><UserCheck className="h-3.5 w-3.5" /><SelectValue placeholder="Reassign" /></SelectTrigger>
          <SelectContent>{users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}</SelectContent>
        </Select>
        <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => requestAction("delete", undefined, "Delete")}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={onClearSelection}><X className="h-3.5 w-3.5" />Clear</Button>
      </div>
      <Dialog open={confirmDialog !== null} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Action</DialogTitle><DialogDescription>{confirmDialog?.label} for {selectedCount} {plural}?{confirmDialog?.action === "delete" && " This cannot be undone."}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={loading}>Cancel</Button>
            <Button variant={confirmDialog?.action === "delete" ? "destructive" : "default"} onClick={executeAction} disabled={loading}>{loading ? "Processing..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
