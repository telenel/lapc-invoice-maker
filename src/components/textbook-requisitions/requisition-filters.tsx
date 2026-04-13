"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, XIcon } from "lucide-react";
import { requisitionApi } from "@/domains/textbook-requisition/api-client";
import type { RequisitionFilters as Filters } from "@/domains/textbook-requisition/types";

interface RequisitionFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  initialYears?: number[];
}

export function RequisitionFilters({
  filters,
  onFilterChange,
  initialYears,
}: RequisitionFiltersProps) {
  const [search, setSearch] = useState(filters.search ?? "");
  const [years, setYears] = useState<number[]>(initialYears ?? []);
  const skippedInitialFetchRef = useRef(initialYears !== undefined);

  useEffect(() => {
    if (skippedInitialFetchRef.current) {
      skippedInitialFetchRef.current = false;
      return;
    }

    void requisitionApi.getDistinctYears().then(setYears).catch(() => {});
  }, []);

  function handleSearchSubmit() {
    onFilterChange({ ...filters, search: search || undefined, page: 1 });
  }

  function clearFilters() {
    setSearch("");
    onFilterChange({ page: 1, pageSize: filters.pageSize });
  }

  const hasFilters = filters.search || filters.status || filters.term || filters.year;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search requisitions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          className="pl-9"
        />
      </div>

      <select
        value={filters.status ?? ""}
        onChange={(e) =>
          onFilterChange({ ...filters, status: (e.target.value || undefined) as Filters["status"], page: 1 })
        }
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="ORDERED">Ordered</option>
        <option value="ON_SHELF">On Shelf</option>
      </select>

      <select
        value={filters.term ?? ""}
        onChange={(e) =>
          onFilterChange({ ...filters, term: e.target.value || undefined, page: 1 })
        }
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All Terms</option>
        <option value="Winter">Winter</option>
        <option value="Spring">Spring</option>
        <option value="Summer">Summer</option>
        <option value="Fall">Fall</option>
      </select>

      {years.length > 0 && (
        <select
          value={filters.year ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              year: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <XIcon className="mr-1 size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
