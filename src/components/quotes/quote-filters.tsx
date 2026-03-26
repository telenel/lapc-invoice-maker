"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface QuoteFilters {
  search: string;
  quoteStatus: string;
  category: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

interface QuoteFiltersProps {
  filters: QuoteFilters;
  departments: string[];
  onChange: (filters: QuoteFilters) => void;
  onClear: () => void;
}

export function QuoteFiltersBar({
  filters,
  departments,
  onChange,
  onClear,
}: QuoteFiltersProps) {
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => {});
  }, []);

  function set(key: keyof QuoteFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="grid gap-1.5 lg:col-span-2">
          <Label htmlFor="quote-search">Search</Label>
          <Input
            id="quote-search"
            name="search"
            placeholder="Quote #, recipient, department..."
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>

        {/* Status */}
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={filters.quoteStatus || null}
            onValueChange={(value) => set("quoteStatus", value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="DECLINED">Declined</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
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
          <Label htmlFor="quote-date-from">From</Label>
          <Input
            id="quote-date-from"
            name="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </div>

        {/* Date To */}
        <div className="grid gap-1.5">
          <Label htmlFor="quote-date-to">To</Label>
          <Input
            id="quote-date-to"
            name="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>

        {/* Amount Min */}
        <div className="grid gap-1.5">
          <Label htmlFor="quote-amount-min">Min Amount</Label>
          <Input
            id="quote-amount-min"
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
          <Label htmlFor="quote-amount-max">Max Amount</Label>
          <Input
            id="quote-amount-max"
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

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
