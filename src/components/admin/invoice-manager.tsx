"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useInvoiceManager } from "./hooks/use-invoice-manager";
import { useInlineEdit } from "./hooks/use-inline-edit";
import { InvoiceManagerFilters } from "./invoice-manager-filters";
import { InvoiceManagerTable } from "./invoice-manager-table";
import { BatchActionBar } from "./batch-action-bar";
import { adminApi } from "@/domains/admin/api-client";
import type { UserResponse } from "@/domains/admin/types";

const INVOICE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "FINAL", label: "Final" },
];

export function InvoiceManager() {
  const manager = useInvoiceManager();
  const edit = useInlineEdit(manager.invoices, manager.setInvoices, manager.setTotal);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [users, setUsers] = useState<UserResponse[]>([]);

  useEffect(() => { adminApi.listUsers().then(setUsers).catch(() => {}); }, []);
  useEffect(() => { setSelectedIds(new Set()); }, [manager.page, manager.statusFilter, manager.search]);

  async function handleBatchAction(action: "status" | "reassign" | "delete", value?: string) {
    try {
      const result = await adminApi.batchInvoices({ ids: Array.from(selectedIds), action, value });
      const count = result.deleted ?? result.updated ?? 0;
      toast.success(`${action === "delete" ? "Deleted" : "Updated"} ${count} invoice${count === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
      manager.refetch();
    } catch { toast.error("Batch action failed"); }
  }

  return (
    <div className="space-y-4">
      <InvoiceManagerFilters
        search={manager.search}
        statusFilter={manager.statusFilter}
        onSearchChange={manager.handleSearchChange}
        onStatusFilterChange={manager.handleStatusFilterChange}
      />
      <BatchActionBar
        selectedCount={selectedIds.size}
        entityName="invoice"
        statuses={INVOICE_STATUSES}
        users={users}
        onBatchAction={handleBatchAction}
        onClearSelection={() => setSelectedIds(new Set())}
      />
      <InvoiceManagerTable
        invoices={manager.invoices}
        loading={manager.loading}
        total={manager.total}
        page={manager.page}
        totalPages={manager.totalPages}
        edit={edit}
        onPageChange={manager.setPage}
        selectedIds={selectedIds}
        onToggleSelect={(id) => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
        onToggleSelectAll={() => {
          const allSelected = manager.invoices.length > 0 && manager.invoices.every((i) => selectedIds.has(i.id));
          setSelectedIds(allSelected ? new Set() : new Set(manager.invoices.map((i) => i.id)));
        }}
      />
    </div>
  );
}
