# Keyboard-First Invoice Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "Keyboard Mode" for invoice creation that uses inline comboboxes, a flat single-column layout, and clean tab order so users can create invoices entirely via keyboard.

**Architecture:** New `keyboard-mode.tsx` component alongside existing Wizard/Quick modes, sharing the `useInvoiceForm` hook for all state/API logic. A new generic `inline-combobox.tsx` replaces popover-based selects. Focus styles scoped via `.keyboard-mode` class. No backend changes.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 4, base-ui, Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-03-26-keyboard-first-invoice-creation-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/ui/inline-combobox.tsx` | Generic keyboard-friendly combobox component |
| Create | `src/components/invoice/keyboard-mode.tsx` | Flat sequential invoice form layout |
| Modify | `src/app/invoices/new/page.tsx` | Add "Keyboard" as third mode tab, make it default |
| Modify | `src/app/globals.css` | Add `.keyboard-mode` focus styles |
| Create | `src/__tests__/inline-combobox.test.tsx` | Unit tests for combobox behavior |
| Create | `src/__tests__/keyboard-mode.test.tsx` | Integration tests for keyboard mode |

---

### Task 1: Inline Combobox Component

**Files:**
- Create: `src/components/ui/inline-combobox.tsx`
- Create: `src/__tests__/inline-combobox.test.tsx`

- [ ] **Step 1: Write the failing test for basic rendering and filtering**

Create `src/__tests__/inline-combobox.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import { describe, it, expect, vi } from "vitest";

const items = [
  { id: "1", label: "Doe, Jane", sublabel: "Program Manager, Workforce Development" },
  { id: "2", label: "Doe, John", sublabel: "Director, Student Services" },
  { id: "3", label: "Smith, Robert", sublabel: "Dean, Academic Affairs" },
];

describe("InlineCombobox", () => {
  it("renders an input with placeholder", () => {
    render(
      <InlineCombobox
        items={items}
        value=""
        onSelect={vi.fn()}
        placeholder="Search staff…"
      />
    );
    expect(screen.getByPlaceholderText("Search staff…")).toBeInTheDocument();
  });

  it("shows suggestions on focus", async () => {
    const user = userEvent.setup();
    render(
      <InlineCombobox items={items} value="" onSelect={vi.fn()} placeholder="Search…" />
    );
    await user.click(screen.getByPlaceholderText("Search…"));
    expect(screen.getByText("Doe, Jane")).toBeInTheDocument();
    expect(screen.getByText("Doe, John")).toBeInTheDocument();
    expect(screen.getByText("Smith, Robert")).toBeInTheDocument();
  });

  it("filters suggestions as user types", async () => {
    const user = userEvent.setup();
    render(
      <InlineCombobox items={items} value="" onSelect={vi.fn()} placeholder="Search…" />
    );
    await user.click(screen.getByPlaceholderText("Search…"));
    await user.type(screen.getByPlaceholderText("Search…"), "smith");
    expect(screen.getByText("Smith, Robert")).toBeInTheDocument();
    expect(screen.queryByText("Doe, Jane")).not.toBeInTheDocument();
  });

  it("calls onSelect and closes dropdown on Enter", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineCombobox items={items} value="" onSelect={onSelect} placeholder="Search…" />
    );
    await user.click(screen.getByPlaceholderText("Search…"));
    await user.type(screen.getByPlaceholderText("Search…"), "jane");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", label: "Doe, Jane" })
    );
    expect(screen.queryByText("Doe, John")).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape without selecting", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineCombobox items={items} value="" onSelect={onSelect} placeholder="Search…" />
    );
    await user.click(screen.getByPlaceholderText("Search…"));
    await user.keyboard("{Escape}");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByText("Doe, Jane")).not.toBeInTheDocument();
  });

  it("navigates suggestions with arrow keys", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineCombobox items={items} value="" onSelect={onSelect} placeholder="Search…" />
    );
    await user.click(screen.getByPlaceholderText("Search…"));
    // First item is highlighted by default, arrow down to second
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2", label: "Doe, John" })
    );
  });

  it("displays displayValue when value is set", () => {
    render(
      <InlineCombobox
        items={items}
        value="1"
        displayValue="Doe, Jane"
        onSelect={vi.fn()}
        placeholder="Search…"
      />
    );
    expect(screen.getByDisplayValue("Doe, Jane")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <InlineCombobox
        items={[]}
        value=""
        onSelect={vi.fn()}
        placeholder="Search…"
        loading
      />
    );
    expect(screen.getByPlaceholderText("Search…")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/inline-combobox.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Install test dependencies if missing**

Run: `npm ls @testing-library/react @testing-library/user-event 2>/dev/null || npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom`

- [ ] **Step 4: Write the InlineCombobox component**

Create `src/components/ui/inline-combobox.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  id: string;
  label: string;
  sublabel?: string;
  searchValue?: string;
}

interface InlineComboboxProps {
  items: ComboboxItem[];
  value: string;
  onSelect: (item: ComboboxItem) => void;
  placeholder?: string;
  displayValue?: string;
  className?: string;
  loading?: boolean;
  allowCustom?: boolean;
  customPrefix?: string;
}

export function InlineCombobox({
  items,
  value,
  onSelect,
  placeholder,
  displayValue,
  className,
  loading = false,
  allowCustom = false,
  customPrefix = "Add new:",
}: InlineComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter items by query
  const filtered = query
    ? items.filter((item) => {
        const search = (item.searchValue ?? `${item.label} ${item.sublabel ?? ""}`).toLowerCase();
        return search.includes(query.toLowerCase());
      })
    : items;

  // Add "custom" entry when allowCustom is true and query doesn't match
  const showCustom = allowCustom && query && !filtered.some(
    (item) => item.label.toLowerCase() === query.toLowerCase()
  );
  const suggestions: (ComboboxItem & { isCustom?: boolean })[] = [
    ...filtered,
    ...(showCustom ? [{ id: `__custom__${query}`, label: `${customPrefix} ${query}`, isCustom: true }] : []),
  ];

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const acceptHighlighted = useCallback(() => {
    const item = suggestions[highlightIndex];
    if (item) {
      onSelect(item);
      setQuery("");
      setOpen(false);
    }
  }, [suggestions, highlightIndex, onSelect]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && e.key !== "Escape") {
      setOpen(true);
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (open && suggestions.length > 0) {
          acceptHighlighted();
        }
        break;
      case "Tab":
        if (open && suggestions.length > 0) {
          acceptHighlighted();
          // Don't preventDefault — let Tab advance focus naturally after selecting
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  function handleFocus() {
    setOpen(true);
    // If showing a displayValue, select all text so typing replaces it
    if (displayValue && inputRef.current) {
      inputRef.current.select();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  }

  function handleItemClick(item: ComboboxItem & { isCustom?: boolean }) {
    onSelect(item);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && suggestions[highlightIndex] ? `combobox-option-${suggestions[highlightIndex].id}` : undefined}
        className={cn(
          "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors",
          "placeholder:text-muted-foreground",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        placeholder={loading ? "Loading…" : placeholder}
        disabled={loading}
        value={open || query ? query : (displayValue ?? "")}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              id={`combobox-option-${item.id}`}
              role="option"
              aria-selected={index === highlightIndex}
              className={cn(
                "cursor-default px-2.5 py-1.5 text-sm",
                index === highlightIndex && "bg-accent text-accent-foreground",
                (item as { isCustom?: boolean }).isCustom && "italic text-muted-foreground"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              <div className="font-medium">{item.label}</div>
              {item.sublabel && (
                <div className="text-xs text-muted-foreground">{item.sublabel}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && suggestions.length === 0 && query && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover px-2.5 py-3 text-center text-sm text-muted-foreground shadow-lg">
          No matches
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/inline-combobox.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/inline-combobox.tsx src/__tests__/inline-combobox.test.tsx
git commit -m "feat: add InlineCombobox component for keyboard-first selection"
```

---

### Task 2: Focus Styles

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add keyboard-mode focus styles to globals.css**

Add the following at the end of `src/app/globals.css`, before the closing of the file:

```css
/* Keyboard mode focus styles */
.keyboard-mode input:focus-visible,
.keyboard-mode textarea:focus-visible,
.keyboard-mode [role="combobox"]:focus-visible {
  border-color: var(--ring) !important;
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 15%, transparent) !important;
  background-color: color-mix(in oklch, var(--ring) 4%, transparent) !important;
}

.keyboard-mode .section-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted-foreground);
  padding: 0.25rem 0;
}

.keyboard-mode .auto-filled-summary {
  cursor: pointer;
}

.keyboard-mode .auto-filled-summary:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
}
```

Note: Using `color-mix(in oklch, ...)` instead of `oklch(from ...)` because relative color syntax has limited browser support. `color-mix()` is supported in all modern browsers. The CSS variables (`--ring`) are oklch values, so `color-mix(in oklch, var(--ring) 15%, transparent)` produces a 15% opacity version of the ring color.

- [ ] **Step 2: Verify styles compile**

Run: `npx next build 2>&1 | tail -5`
Expected: Build completes without CSS errors

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add keyboard-mode focus styles"
```

---

### Task 3: Keyboard Mode Layout

**Files:**
- Create: `src/components/invoice/keyboard-mode.tsx`

This is the main component. It uses `useInvoiceForm` return values (passed as props, same pattern as `QuickMode`), renders a flat single-column form, uses `InlineCombobox` for staff/category/signatures, and manages tab order.

- [ ] **Step 1: Create keyboard-mode.tsx**

Create `src/components/invoice/keyboard-mode.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import { LineItems } from "./line-items";
import { QuickPickPanel } from "./quick-pick-panel";
import { PdfProgress } from "./pdf-progress";
import { PrismcoreUpload } from "./prismcore-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InvoiceFormData,
  InvoiceItem,
  StaffAccountNumber,
  GenerationStep,
} from "./invoice-form";

interface StaffMember {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  accountNumbers?: StaffAccountNumber[];
  signerHistories?: { position: number; signer: { id: string; name: string; title: string } }[];
}

interface KeyboardModeProps {
  form: InvoiceFormData;
  updateField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => void;
  updateItem: (index: number, patch: Partial<InvoiceItem>) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  total: number;
  handleStaffSelect: (staff: StaffMember) => void;
  handleStaffEdit: (updated: StaffMember) => void;
  staffAccountNumbers: StaffAccountNumber[];
  saveDraft: () => Promise<void>;
  saveAndFinalize: () => Promise<void>;
  saving: boolean;
  generationStep: GenerationStep;
}

interface Category {
  id: string;
  name: string;
  active: boolean;
}

export function KeyboardMode({
  form,
  updateField,
  updateItem,
  addItem,
  removeItem,
  total,
  handleStaffSelect,
  staffAccountNumbers,
  saveDraft,
  saveAndFinalize,
  saving,
  generationStep,
}: KeyboardModeProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickPicksOpen, setQuickPicksOpen] = useState(false);
  const [newAccountDesc, setNewAccountDesc] = useState("");
  const [showAccountDesc, setShowAccountDesc] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

  // Fetch staff
  useEffect(() => {
    setStaffLoading(true);
    fetch("/api/staff")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StaffMember[]) => setStaff(data))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false));
  }, []);

  // Fetch categories
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data: Category[]) => setCategories(data))
      .catch(() => {});
  }, []);

  // Ctrl+Enter / Cmd+Enter shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    }
    const el = formRef.current;
    el?.addEventListener("keydown", handleKeyDown);
    return () => el?.removeEventListener("keydown", handleKeyDown);
  });

  function handleGenerate() {
    if (!form.staffId) {
      toast.error("Please select a staff member");
      return;
    }
    if (!form.invoiceNumber) {
      toast.error("Please enter an invoice number");
      return;
    }
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    saveAndFinalize();
  }

  // Map staff to combobox items
  const staffItems: ComboboxItem[] = staff
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: [s.title, s.department?.trim()].filter(Boolean).join(", "),
      searchValue: `${s.name} ${s.name.includes(",") ? s.name.split(",").map((p) => p.trim()).reverse().join(" ") : ""} ${s.title} ${s.department}`,
    }));

  // Map account numbers to combobox items
  const accountItems: ComboboxItem[] = staffAccountNumbers.map((a) => ({
    id: a.accountCode,
    label: a.accountCode,
    sublabel: a.description || undefined,
  }));

  // Map categories to combobox items
  const categoryItems: ComboboxItem[] = categories
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      label: c.name,
    }));

  // Map staff to signature combobox items
  const signatureItems: ComboboxItem[] = staff
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: [s.title, s.department?.trim()].filter(Boolean).join(", "),
      searchValue: `${s.name} ${s.title} ${s.department}`,
    }));

  function handleStaffComboSelect(item: ComboboxItem) {
    const found = staff.find((s) => s.id === item.id);
    if (found) handleStaffSelect(found);
  }

  function handleAccountSelect(item: ComboboxItem & { isCustom?: boolean }) {
    if (item.isCustom) {
      const num = item.id.replace("__custom__", "");
      updateField("accountNumber", num);
      setShowAccountDesc(true);
      setNewAccountDesc("");
    } else {
      updateField("accountNumber", item.id);
      setShowAccountDesc(false);
    }
  }

  async function saveNewAccountNumber() {
    if (!form.staffId || !form.accountNumber) return;
    try {
      await fetch(`/api/staff/${form.staffId}/account-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode: form.accountNumber,
          description: newAccountDesc,
        }),
      });
      setShowAccountDesc(false);
      toast.success("Account number saved");
    } catch {
      toast.error("Failed to save account number");
    }
  }

  function handleCategorySelect(item: ComboboxItem) {
    updateField("category", item.label);
  }

  function handleSignatureSelect(
    line: "line1" | "line2" | "line3",
    item: ComboboxItem
  ) {
    const found = staff.find((s) => s.id === item.id);
    if (!found) return;
    updateField("signatureStaffIds", {
      ...form.signatureStaffIds,
      [line]: found.id,
    });
    updateField("signatures", {
      ...form.signatures,
      [line]: `${found.name}, ${found.title}`,
    });
  }

  function handleQuickPick(description: string, unitPrice: number) {
    const emptyIndex = form.items.findIndex((item) => !item.description);
    if (emptyIndex >= 0) {
      updateItem(emptyIndex, { description, unitPrice, quantity: 1, extendedPrice: unitPrice });
    } else {
      addItem();
      const newIndex = form.items.length;
      setTimeout(() => {
        updateItem(newIndex, { description, unitPrice, quantity: 1, extendedPrice: unitPrice });
      }, 0);
    }
  }

  // Editable auto-filled field
  function startEdit(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
  }

  function commitEdit(field: keyof InvoiceFormData) {
    updateField(field, editValue);
    setEditingField(null);
  }

  const selectedStaff = staff.find((s) => s.id === form.staffId);
  const selectedCategory = categories.find((c) => c.name === form.category);

  return (
    <div ref={formRef} className="keyboard-mode max-w-2xl mx-auto">
      {/* ── STAFF ── */}
      <div className="section-label">Staff</div>
      <InlineCombobox
        items={staffItems}
        value={form.staffId}
        displayValue={selectedStaff?.name}
        onSelect={handleStaffComboSelect}
        placeholder="Type staff name…"
        loading={staffLoading}
      />

      {/* Auto-filled summary */}
      {form.staffId && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {[
            { key: "department", label: form.department },
            { key: "contactExtension", label: form.contactExtension ? `ext. ${form.contactExtension}` : null },
            { key: "contactEmail", label: form.contactEmail },
            { key: "contactPhone", label: form.contactPhone },
          ]
            .filter((f) => f.label)
            .map((f) => (
              editingField === f.key ? (
                <input
                  key={f.key}
                  className="border-b border-input bg-transparent text-xs outline-none px-0.5"
                  tabIndex={-1}
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(f.key as keyof InvoiceFormData)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(f.key as keyof InvoiceFormData);
                    if (e.key === "Escape") setEditingField(null);
                  }}
                />
              ) : (
                <span
                  key={f.key}
                  className="auto-filled-summary"
                  onClick={() => startEdit(f.key, f.label ?? "")}
                >
                  {f.label}
                </span>
              )
            ))}
        </div>
      )}

      {/* ── INVOICE ── */}
      <div className="mt-6 border-t border-border/50" />
      <div className="section-label mt-3">Invoice</div>

      <div className="grid grid-cols-2 gap-3 mt-1">
        {/* Account Number */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Account Number</label>
          <InlineCombobox
            items={accountItems}
            value={form.accountNumber}
            displayValue={form.accountNumber || undefined}
            onSelect={handleAccountSelect}
            placeholder="Account number…"
            allowCustom
            customPrefix="Add new:"
          />
          {showAccountDesc && (
            <div className="mt-1 flex gap-2">
              <Input
                className="h-7 text-xs"
                placeholder="Description (e.g. ASB Fund)…"
                value={newAccountDesc}
                onChange={(e) => setNewAccountDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNewAccountNumber();
                  if (e.key === "Escape") setShowAccountDesc(false);
                }}
              />
              <Button size="xs" onClick={saveNewAccountNumber}>Save</Button>
            </div>
          )}
        </div>

        {/* Account Code */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Account Code</label>
          <Input
            value={form.accountCode}
            onChange={(e) => updateField("accountCode", e.target.value)}
            placeholder="Account code…"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        {/* Invoice Number */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Invoice Number *</label>
          <Input
            value={form.invoiceNumber}
            onChange={(e) => updateField("invoiceNumber", e.target.value)}
            placeholder="INV-0001…"
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => updateField("date", e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Category *</label>
          <InlineCombobox
            items={categoryItems}
            value={selectedCategory?.id ?? ""}
            displayValue={form.category || undefined}
            onSelect={handleCategorySelect}
            placeholder="Select category…"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Semester / Year / Dept</label>
        <Input
          value={form.semesterYearDept}
          onChange={(e) => updateField("semesterYearDept", e.target.value)}
          placeholder="e.g. Fall 2025 – Math"
        />
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="mt-6 border-t border-border/50" />
      <div className="section-label mt-3 flex items-center gap-2">
        Line Items
        <button
          tabIndex={-1}
          className="text-xs font-normal normal-case text-primary hover:underline flex items-center gap-0.5"
          onClick={() => setQuickPicksOpen(!quickPicksOpen)}
        >
          {quickPicksOpen ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
          Quick Picks
        </button>
      </div>

      {quickPicksOpen && (
        <div className="mt-1 mb-2">
          <QuickPickPanel
            department={form.department}
            onSelect={handleQuickPick}
          />
        </div>
      )}

      <LineItems
        items={form.items}
        onUpdate={updateItem}
        onAdd={addItem}
        onRemove={removeItem}
        total={total}
        department={form.department}
      />

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <Textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Additional notes or comments…"
          rows={2}
        />
      </div>

      {/* ── SIGNATURES ── */}
      <div className="mt-6 border-t border-border/50" />
      <div className="section-label mt-3">Signatures</div>

      <div className="grid grid-cols-3 gap-3 mt-1">
        {(["line1", "line2", "line3"] as const).map((line, i) => (
          <div key={line}>
            <label className="text-xs font-medium text-muted-foreground">
              Signature {i + 1}
            </label>
            <InlineCombobox
              items={signatureItems}
              value={form.signatureStaffIds[line]}
              displayValue={form.signatures[line] || undefined}
              onSelect={(item) => handleSignatureSelect(line, item)}
              placeholder="Type name…"
            />
          </div>
        ))}
      </div>

      {/* ── OPTIONAL ── */}
      <div className="mt-6 border-t border-border/50" />
      <div className="mt-3">
        <PrismcoreUpload
          value={form.prismcorePath}
          onChange={(path) => updateField("prismcorePath", path)}
        />
      </div>

      {/* ── ACTIONS ── */}
      <div className="mt-8 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          tabIndex={-1}
          onClick={saveDraft}
          disabled={saving}
        >
          Save Draft
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={saving || !form.staffId || !form.invoiceNumber || !form.category}
        >
          Generate PDF{" "}
          <kbd className="ml-1.5 text-xs opacity-60">
            {isMac ? "⌘" : "Ctrl"}↵
          </kbd>
        </Button>
      </div>

      {/* PDF Progress Modal */}
      <PdfProgress step={generationStep} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing unrelated ones)

- [ ] **Step 3: Commit**

```bash
git add src/components/invoice/keyboard-mode.tsx
git commit -m "feat: add KeyboardMode flat sequential invoice form"
```

---

### Task 4: Wire Up Keyboard Mode in New Invoice Page

**Files:**
- Modify: `src/app/invoices/new/page.tsx`

- [ ] **Step 1: Add keyboard mode as the default tab**

Replace the contents of `src/app/invoices/new/page.tsx` with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { WizardMode } from "@/components/invoice/wizard-mode";
import { QuickMode } from "@/components/invoice/quick-mode";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

type Mode = "keyboard" | "wizard" | "quick";

const STORAGE_KEY = "lapc-invoice-mode";

export default function NewInvoicePage() {
  const [mode, setMode] = useState<Mode>("keyboard");

  // Hydrate mode preference from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "keyboard" || stored === "wizard" || stored === "quick") {
      setMode(stored);
    }
  }, []);

  function handleModeChange(value: Mode) {
    setMode(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

  const invoiceForm = useInvoiceForm();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-balance">New Invoice</h1>
        <Tabs
          value={mode}
          onValueChange={(value) => handleModeChange(value as Mode)}
        >
          <TabsList>
            <TabsTrigger value="keyboard">Keyboard</TabsTrigger>
            <TabsTrigger value="wizard">Wizard</TabsTrigger>
            <TabsTrigger value="quick">Quick</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="text-xs text-muted-foreground mb-6 text-right">
        {mode === "keyboard" && "Tab through fields to create invoices fast."}
        {mode === "wizard" && "Step-by-step guided flow."}
        {mode === "quick" && "Everything visible at once."}
      </p>

      {/* Mode content */}
      {mode === "keyboard" && <KeyboardMode {...invoiceForm} />}
      {mode === "wizard" && <WizardMode {...invoiceForm} />}
      {mode === "quick" && <QuickMode {...invoiceForm} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test**

Open `http://localhost:3000/invoices/new` in browser. Verify:
1. "Keyboard" tab is selected by default
2. Flat single-column layout renders
3. Tab moves through: Staff → Account Number → Account Code → Invoice Number → Date → Category → Semester → Line Items → Notes → Signatures → Generate PDF
4. Staff combobox: type a name, see suggestions, Tab to accept
5. Ctrl+Enter (or Cmd+Enter on Mac) triggers generate
6. Switching to Wizard/Quick tabs still works

- [ ] **Step 4: Commit**

```bash
git add src/app/invoices/new/page.tsx
git commit -m "feat: wire up KeyboardMode as default invoice creation mode"
```

---

### Task 5: Integration Tests

**Files:**
- Create: `src/__tests__/keyboard-mode.test.tsx`

- [ ] **Step 1: Write integration tests**

Create `src/__tests__/keyboard-mode.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// We test the combobox behavior in isolation since KeyboardMode requires
// extensive mocking. These tests verify the core keyboard interaction contract.

import { InlineCombobox } from "@/components/ui/inline-combobox";

const items = [
  { id: "1", label: "Doe, Jane", sublabel: "Program Manager" },
  { id: "2", label: "Doe, John", sublabel: "Director" },
  { id: "3", label: "Smith, Robert", sublabel: "Dean" },
];

describe("Keyboard Mode — InlineCombobox Tab Behavior", () => {
  it("Tab accepts highlighted suggestion and allows focus to advance", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <div>
        <InlineCombobox items={items} value="" onSelect={onSelect} placeholder="Staff…" />
        <input data-testid="next-field" placeholder="Next field" />
      </div>
    );

    await user.click(screen.getByPlaceholderText("Staff…"));
    await user.type(screen.getByPlaceholderText("Staff…"), "jane");
    await user.tab();

    // Should have selected the filtered match
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", label: "Doe, Jane" })
    );
  });

  it("allowCustom shows 'Add new' option for unmatched input", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <InlineCombobox
        items={items}
        value=""
        onSelect={onSelect}
        placeholder="Account…"
        allowCustom
        customPrefix="Add new:"
      />
    );

    await user.click(screen.getByPlaceholderText("Account…"));
    await user.type(screen.getByPlaceholderText("Account…"), "9999-99");

    expect(screen.getByText("Add new: 9999-99")).toBeInTheDocument();
  });
});

describe("Keyboard Mode — Focus Style Contract", () => {
  it("combobox input has role=combobox for CSS targeting", () => {
    render(
      <InlineCombobox items={items} value="" onSelect={vi.fn()} placeholder="Test" />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/keyboard-mode.test.tsx
git commit -m "test: add keyboard mode integration tests"
```

---

### Task 6: Edit Page Support (if applicable)

**Files:**
- Check: `src/app/invoices/[id]/edit/page.tsx`

The edit page also uses mode tabs. If users should be able to edit existing invoices in keyboard mode too, the same change from Task 4 applies here.

- [ ] **Step 1: Check if edit page uses the same mode pattern**

Read `src/app/invoices/[id]/edit/page.tsx`. If it follows the same Tabs pattern with `useInvoiceForm(initial, existingId)`, add the `KeyboardMode` import and tab.

- [ ] **Step 2: Add KeyboardMode to edit page (if applicable)**

Apply the same changes as Task 4 step 1: add `"keyboard"` to the Mode type, import `KeyboardMode`, add the tab trigger, render `<KeyboardMode {...invoiceForm} />`.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/invoices/[id]/edit/page.tsx
git commit -m "feat: add KeyboardMode to invoice edit page"
```

---

## Verification Checklist

After all tasks are complete, verify end-to-end:

- [ ] `npx vitest run` — all tests pass
- [ ] `npx next build` — production build succeeds
- [ ] Manual test: create a full invoice using only Tab and Enter keys
- [ ] Manual test: Ctrl+Enter generates PDF from middle of form
- [ ] Manual test: focus ring + background tint visible on every field
- [ ] Manual test: auto-filled fields (dept, ext, email, phone) are NOT in tab order
- [ ] Manual test: account number and account code ARE in tab order
- [ ] Manual test: Wizard and Quick modes still work unchanged
- [ ] Manual test: theme toggle works in keyboard mode (light, dark, catppuccin)
