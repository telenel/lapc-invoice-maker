"use client";

import { useInvoiceManager } from "./hooks/use-invoice-manager";
import { useInlineEdit } from "./hooks/use-inline-edit";
import { InvoiceManagerFilters } from "./invoice-manager-filters";
import { InvoiceManagerTable } from "./invoice-manager-table";

export function InvoiceManager() {
  const manager = useInvoiceManager();
  const edit = useInlineEdit(manager.invoices, manager.setInvoices, manager.setTotal);

  return (
    <div className="space-y-4">
      <InvoiceManagerFilters
        search={manager.search}
        statusFilter={manager.statusFilter}
        onSearchChange={manager.handleSearchChange}
        onStatusFilterChange={manager.handleStatusFilterChange}
      />
      <InvoiceManagerTable
        invoices={manager.invoices}
        loading={manager.loading}
        total={manager.total}
        page={manager.page}
        totalPages={manager.totalPages}
        edit={edit}
        onPageChange={manager.setPage}
      />
    </div>
  );
}
