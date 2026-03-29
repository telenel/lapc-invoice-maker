"use client";

import { useState } from "react";
import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface InvoiceFilters {
  search: string;
  status: string;
  category: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

interface InvoiceFiltersProps {
  filters: InvoiceFilters;
  departments: string[];
  categories: { name: string; label: string }[];
  onChange: (filters: InvoiceFilters) => void;
  onClear: () => void;
  onExportCsv?: () => void;
}

export function InvoiceFiltersBar({
  filters,
  departments,
  categories,
  onChange,
  onClear,
  onExportCsv,
}: InvoiceFiltersProps) {
  const [open, setOpen] = useState(false);

  function set(key: keyof InvoiceFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount = [
    filters.status && filters.status !== "all",
    filters.category && filters.category !== "all",
    filters.department && filters.department !== "all",
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search row — always visible */}
      <div className="flex items-end gap-3">
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor="invoice-search" className="sr-only">Search</Label>
          <Input
            id="invoice-search"
            name="search"
            placeholder="Search invoices…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 gap-1.5"
        >
          <FilterIcon className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] font-bold rounded-full">
              {activeCount}
            </Badge>
          )}
          <ChevronDownIcon className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Collapsible filter panel */}
      {open && (
        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Status */}
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status || null}
                onValueChange={(value) => set("status", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="FINAL">Final</SelectItem>
                  <SelectItem value="PENDING_CHARGE">Pending Charge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select
                value={filters.category || null}
                onValueChange={(value) => set("category", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Select
                value={filters.department || null}
                onValueChange={(value) => set("department", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Date From */}
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-date-from">From</Label>
              <Input
                id="invoice-date-from"
                name="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => set("dateFrom", e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-date-to">To</Label>
              <Input
                id="invoice-date-to"
                name="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => set("dateTo", e.target.value)}
              />
            </div>

            {/* Amount Min */}
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-amount-min">Min Amount</Label>
              <Input
                id="invoice-amount-min"
                name="amountMin"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filters.amountMin}
                onChange={(e) => set("amountMin", e.target.value)}
              />
            </div>

            {/* Amount Max */}
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-amount-max">Max Amount</Label>
              <Input
                id="invoice-amount-max"
                name="amountMax"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filters.amountMax}
                onChange={(e) => set("amountMax", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {onExportCsv && (
              <Button variant="outline" size="sm" onClick={onExportCsv}>
                Export CSV
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
