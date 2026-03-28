"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvoiceStatus } from "./hooks/use-invoice-manager";

interface InvoiceManagerFiltersProps {
  search: string;
  statusFilter: InvoiceStatus | "ALL";
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string | null) => void;
}

export function InvoiceManagerFilters({
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
}: InvoiceManagerFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-semibold">Invoice Manager</h2>
      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-56 text-sm"
          placeholder="Search invoices…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="FINAL">Final</SelectItem>
            <SelectItem value="PENDING_CHARGE">Pending Charge</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
