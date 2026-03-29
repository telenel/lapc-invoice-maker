# UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the UI/UX across the app with empty states, collapsible filters, staff table polish, and login page atmosphere — without touching the nav bar.

**Architecture:** Each task is a self-contained visual improvement. Empty states get a shared component. Filter bars get a collapsible wrapper. Staff table gets hover/stripe polish. Login page gets atmospheric background treatment.

**Tech Stack:** React, Tailwind CSS 4, Framer Motion (already installed), Lucide icons (already installed), shadcn/ui components

---

### Task 1: Empty State Component

Create a reusable empty state component with an illustration, message, and optional CTA button.

**Files:**
- Create: `src/components/ui/empty-state.tsx`

- [ ] **Step 1: Create the empty state component**

```tsx
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/60 text-muted-foreground mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">{description}</p>
      {action && (
        <Button variant={action.variant ?? "default"} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors related to empty-state.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat: add reusable EmptyState component"
```

---

### Task 2: Invoice Table Empty State

Replace the plain "No invoices found." text with the new EmptyState component.

**Files:**
- Modify: `src/components/invoices/invoice-table.tsx:148-151`

- [ ] **Step 1: Add imports to invoice-table.tsx**

At the top of the file, add:
```tsx
import { FileTextIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
```

- [ ] **Step 2: Replace the empty state text**

Replace lines 148-151:
```tsx
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No invoices found.</p>
```

With:
```tsx
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="size-7" />}
          title="No invoices found"
          description={
            Object.values(filters).some((v) => v !== "")
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first invoice to get started."
          }
          action={
            Object.values(filters).some((v) => v !== "")
              ? { label: "Clear Filters", onClick: handleClear, variant: "outline" as const }
              : undefined
          }
        />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Test visually**

Open http://localhost:3000/invoices — verify the empty state shows the icon, message, and "Clear Filters" button when filters are active.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoices/invoice-table.tsx
git commit -m "feat: add illustrated empty state to invoices page"
```

---

### Task 3: Quote Table Empty State

Replace the plain "No quotes found." text with the EmptyState component.

**Files:**
- Modify: `src/components/quotes/quote-table.tsx:227-230`

- [ ] **Step 1: Add imports to quote-table.tsx**

At the top of the file, add:
```tsx
import { ClipboardListIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
```

- [ ] **Step 2: Replace the empty state text**

Replace lines 227-230:
```tsx
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : quotes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No quotes found.</p>
```

With:
```tsx
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon className="size-7" />}
          title="No quotes found"
          description={
            Object.values(filters).some((v) => v !== "")
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first quote to get started."
          }
          action={
            Object.values(filters).some((v) => v !== "")
              ? { label: "Clear Filters", onClick: handleClear, variant: "outline" as const }
              : undefined
          }
        />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/quotes/quote-table.tsx
git commit -m "feat: add illustrated empty state to quotes page"
```

---

### Task 4: Staff Table Empty State

Replace the plain "No staff members" text with the EmptyState component.

**Files:**
- Modify: `src/components/staff/staff-table.tsx:96-101`

- [ ] **Step 1: Add imports to staff-table.tsx**

At the top of the file, add:
```tsx
import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
```

- [ ] **Step 2: Replace the empty state text**

Replace lines 96-101:
```tsx
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {search ? "No staff members match your search." : "No staff members yet. Add one to get started."}
        </p>
```

With:
```tsx
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-7" />}
          title={search ? "No staff members match your search" : "No staff members yet"}
          description={search ? "Try a different search term." : "Add your first staff member to get started."}
          action={
            search
              ? { label: "Clear Search", onClick: () => handleSearch(""), variant: "outline" as const }
              : undefined
          }
        />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/staff/staff-table.tsx
git commit -m "feat: add illustrated empty state to staff directory"
```

---

### Task 5: Collapsible Filter Bar — Invoice Filters

Wrap the invoice filter bar in a collapsible section with a toggle button that shows active filter count.

**Files:**
- Modify: `src/components/invoices/invoice-filters.tsx`

- [ ] **Step 1: Add imports**

Replace the current imports at the top:
```tsx
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
```

- [ ] **Step 2: Add active filter count and collapsible state**

Inside `InvoiceFiltersBar`, before the `return`, add:
```tsx
  const [open, setOpen] = useState(false);

  const activeCount = [
    filters.status && filters.status !== "all",
    filters.category && filters.category !== "all",
    filters.department && filters.department !== "all",
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
  ].filter(Boolean).length;
```

- [ ] **Step 3: Wrap filters in collapsible layout**

Replace the entire `return (...)` with:
```tsx
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

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 5: Test visually**

Open http://localhost:3000/invoices — verify:
- Search bar is always visible
- "Filters" button toggles the filter panel
- Active filter count badge appears when filters are set
- Chevron rotates when panel opens/closes

- [ ] **Step 6: Commit**

```bash
git add src/components/invoices/invoice-filters.tsx
git commit -m "feat: collapsible filter bar on invoices page"
```

---

### Task 6: Collapsible Filter Bar — Quote Filters

Apply the same collapsible filter pattern to the quotes page.

**Files:**
- Modify: `src/components/quotes/quote-filters.tsx`

- [ ] **Step 1: Add imports**

Replace the current imports at the top:
```tsx
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
```

- [ ] **Step 2: Add active filter count and collapsible state**

Inside `QuoteFiltersBar`, before the `return`, add:
```tsx
  const [open, setOpen] = useState(false);

  const activeCount = [
    filters.quoteStatus && filters.quoteStatus !== "all",
    filters.category && filters.category !== "all",
    filters.department && filters.department !== "all",
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
  ].filter(Boolean).length;
```

- [ ] **Step 3: Wrap filters in collapsible layout**

Replace the entire `return (...)` with:
```tsx
  return (
    <div className="space-y-3">
      {/* Search row — always visible */}
      <div className="flex items-end gap-3">
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor="quote-search" className="sr-only">Search</Label>
          <Input
            id="quote-search"
            name="search"
            placeholder="Search quotes…"
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
      )}
    </div>
  );
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/quote-filters.tsx
git commit -m "feat: collapsible filter bar on quotes page"
```

---

### Task 7: Staff Table Polish

Add hover highlight, zebra striping, and initials avatar to staff table rows for better scannability.

**Files:**
- Modify: `src/components/staff/staff-table.tsx:116-153`

- [ ] **Step 1: Add initials helper import**

At the top of the file, add to the existing imports:
```tsx
import { getInitials } from "@/lib/formatters";
```

- [ ] **Step 2: Add zebra striping and hover to table rows**

Replace the `<TableBody>` section (lines 116-153) with:
```tsx
            <TableBody>
              {staff.map((member, index) => (
                <TableRow
                  key={member.id}
                  className={`hover:bg-muted/50 transition-colors ${index % 2 === 1 ? "bg-muted/20" : ""}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        {getInitials(member.name)}
                      </div>
                      <span className="font-bold">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{member.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.department.replace(/^[,\s]+/, '').trim()}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{member.accountCode}</TableCell>
                  <TableCell className="hidden md:table-cell">{member.extension}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <StaffForm
                        staff={member}
                        onSave={fetchStaff}
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit staff member">
                            <PencilIcon />
                            <span className="sr-only">Edit</span>
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Deactivate"
                        aria-label="Deactivate staff member"
                        onClick={() => handleDeactivate(member.id, member.name)}
                      >
                        <UserMinus className="text-destructive" />
                        <span className="sr-only">Deactivate</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Test visually**

Open http://localhost:3000/staff — verify:
- Alternating row backgrounds (subtle muted stripe on odd rows)
- Hover highlight on each row
- Initials avatar before each name

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/staff-table.tsx
git commit -m "feat: staff table polish — zebra rows, hover, initials avatar"
```

---

### Task 8: Login Page Atmosphere

Add a subtle dot grid pattern and warm gradient to the login page background for more visual depth.

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the dot pattern CSS to globals.css**

At the end of `globals.css`, add:
```css
/* Login page background pattern */
.login-dots {
  background-image: radial-gradient(circle, oklch(0.75 0.01 60 / 0.3) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

- [ ] **Step 2: Update login page background**

In `src/app/login/page.tsx`, replace the outer div:
```tsx
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30">
```

With:
```tsx
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-red-50/30 login-dots">
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Test visually**

Open http://localhost:3000/login — verify:
- Subtle dot grid pattern visible in the background
- Warm diagonal gradient (top-left to bottom-right) with a hint of LAPC red

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/globals.css
git commit -m "feat: login page atmospheric background with dot pattern"
```

---

### Task 9: Export CSV Button Placement Fix

Move the "Export CSV" button next to "Clear Filters" inside the collapsible filter panel (invoices only) so it doesn't float awkwardly.

**Files:**
- Modify: `src/components/invoices/invoice-table.tsx:131-146`

- [ ] **Step 1: Move Export CSV into the filter bar**

In `src/components/invoices/invoice-filters.tsx`, add an `onExportCsv` prop:

Update the interface:
```tsx
interface InvoiceFiltersProps {
  filters: InvoiceFilters;
  departments: string[];
  categories: { name: string; label: string }[];
  onChange: (filters: InvoiceFilters) => void;
  onClear: () => void;
  onExportCsv?: () => void;
}
```

Update the function signature:
```tsx
export function InvoiceFiltersBar({
  filters,
  departments,
  categories,
  onChange,
  onClear,
  onExportCsv,
}: InvoiceFiltersProps) {
```

Update the "Clear Filters" row inside the collapsible panel to include Export CSV:
```tsx
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
```

- [ ] **Step 2: Pass onExportCsv from invoice-table.tsx**

In `src/components/invoices/invoice-table.tsx`, update the filter bar usage. Replace lines 131-146:
```tsx
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <InvoiceFiltersBar
            filters={filters}
            departments={departments}
            categories={categories}
            onChange={handleFiltersChange}
            onClear={handleClear}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>
```

With:
```tsx
    <div className="space-y-4">
      <InvoiceFiltersBar
        filters={filters}
        departments={departments}
        categories={categories}
        onChange={handleFiltersChange}
        onClear={handleClear}
        onExportCsv={handleExportCsv}
      />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-filters.tsx src/components/invoices/invoice-table.tsx
git commit -m "refactor: move Export CSV into collapsible filter panel"
```

---

### Task 10: Final Lint + Build Verification

Run lint and build to ensure everything passes before pushing.

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Fix any issues found, then commit fixes**

If lint/build errors found, fix them and commit:
```bash
git commit -m "fix: address lint/build issues from UI polish"
```
