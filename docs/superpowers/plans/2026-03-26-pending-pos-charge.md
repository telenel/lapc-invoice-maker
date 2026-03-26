# Pending POS Charge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Charge at Register" save option so users can park nearly-complete invoices, then return later to enter the AG number, upload the PrismCore PDF, and finalize.

**Architecture:** Add `PENDING_CHARGE` to the existing `InvoiceStatus` enum. The invoice form gets a third save button. The edit page detects pending charge status and highlights missing fields. A new dashboard card shows all pending charges across users.

**Tech Stack:** Next.js 14 App Router, Prisma 7 (PostgreSQL), Zod validation, shadcn/ui v4, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-03-26-pending-pos-charge-design.md`

---

### Task 1: Schema Migration — Add PENDING_CHARGE Status

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PENDING_CHARGE to the InvoiceStatus enum**

In `prisma/schema.prisma`, change:

```prisma
enum InvoiceStatus {
  DRAFT
  FINAL
}
```

To:

```prisma
enum InvoiceStatus {
  DRAFT
  FINAL
  PENDING_CHARGE
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_pending_charge_status`

Expected: Migration created and applied successfully.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`

Expected: Client regenerated at `src/generated/prisma`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add PENDING_CHARGE to InvoiceStatus enum"
```

---

### Task 2: Invoice Form Hook — Add savePendingCharge

**Files:**
- Modify: `src/components/invoice/invoice-form.tsx`

- [ ] **Step 1: Add the savePendingCharge callback**

In `src/components/invoice/invoice-form.tsx`, add a new save function after the existing `saveAndFinalize` callback (around line 482). This function saves the invoice with `invoiceNumber: "NEEDPOSCHARGE"` and includes a `status` field in the payload set to `PENDING_CHARGE`.

Add this function before the `return` statement:

```typescript
  const savePendingCharge = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...buildPayload(),
        invoiceNumber: "NEEDPOSCHARGE",
        status: "PENDING_CHARGE",
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fieldErrors = (data?.error?.fieldErrors ?? {}) as Record<
          string,
          string[]
        >;
        const firstFieldError = Object.values(fieldErrors)[0]?.[0];
        const msg =
          (data?.error?.formErrors as string[] | undefined)?.[0] ??
          firstFieldError ??
          "Failed to save invoice";
        throw new Error(msg);
      }

      const invoice = await res.json();
      toast.success("Saved — charge at register when ready");
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save invoice"
      );
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, router]);
```

- [ ] **Step 2: Add savePendingCharge to the return object**

In the `return` statement of `useInvoiceForm`, add `savePendingCharge` alongside the existing properties:

```typescript
  return {
    form,
    updateField,
    updateItem,
    addItem,
    removeItem,
    total,
    handleStaffSelect,
    handleStaffEdit,
    staffAccountNumbers,
    saveDraft,
    saveAndFinalize,
    savePendingCharge,
    saving,
    generationStep,
  };
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoice/invoice-form.tsx
git commit -m "feat: add savePendingCharge to invoice form hook"
```

---

### Task 3: API — Accept status in Invoice Create/Update

**Files:**
- Modify: `src/lib/validators.ts`
- Modify: `src/app/api/invoices/route.ts`
- Modify: `src/app/api/invoices/[id]/route.ts`

- [ ] **Step 1: Add optional status field to invoiceCreateSchema**

In `src/lib/validators.ts`, add a `status` field to `invoiceCreateSchema`:

```typescript
export const invoiceCreateSchema = z.object({
  invoiceNumber: z.string().default(""),
  date: z.string().min(1, "Date is required"),
  staffId: z.string().min(1, "Staff member is required"),
  department: z.string().min(1, "Department is required"),
  category: z.string().min(1, "Category is required"),
  accountCode: z.string().default(""),
  accountNumber: z.string().default(""),
  approvalChain: z.array(z.string()).default([]),
  notes: z.string().default(""),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.string().optional(),
  recurringEmail: z.string().email().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PENDING_CHARGE"]).optional(),
});
```

The only change is adding the `status` field at the end.

- [ ] **Step 2: Use the status field in POST /api/invoices**

In `src/app/api/invoices/route.ts`, in the POST handler, after destructuring `parsed.data`:

Change:

```typescript
  const { items, date, ...invoiceData } = parsed.data;
```

To:

```typescript
  const { items, date, status, ...invoiceData } = parsed.data;
```

Then in the `prisma.invoice.create` call, add the status field to the data object. Find the line:

```typescript
        ...invoiceData,
```

And add after it:

```typescript
        ...(status ? { status } : {}),
```

- [ ] **Step 3: Allow updates to PENDING_CHARGE invoices**

In `src/app/api/invoices/[id]/route.ts`, in the PUT handler, change the status check:

From:

```typescript
    if (existing.status === "FINAL") {
      return NextResponse.json({ error: "Cannot update a finalized invoice" }, { status: 400 });
    }
```

To:

```typescript
    if (existing.status === "FINAL") {
      return NextResponse.json({ error: "Cannot update a finalized invoice" }, { status: 400 });
    }
```

No change needed — the current code only blocks `FINAL`, which means `DRAFT` and `PENDING_CHARGE` are both editable. This is correct behavior.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators.ts src/app/api/invoices/route.ts
git commit -m "feat: accept PENDING_CHARGE status in invoice create API"
```

---

### Task 4: Keyboard Mode — Add "Charge at Register" Button

**Files:**
- Modify: `src/components/invoice/keyboard-mode.tsx`

- [ ] **Step 1: Add savePendingCharge to the props interface**

In `src/components/invoice/keyboard-mode.tsx`, add to the `KeyboardModeProps` interface:

```typescript
  savePendingCharge: () => Promise<void>;
```

Add it after `saveAndFinalize`.

- [ ] **Step 2: Destructure the new prop**

In the component function signature, add `savePendingCharge` to the destructured props:

```typescript
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
  savePendingCharge,
  saving,
  generationStep,
}: KeyboardModeProps) {
```

- [ ] **Step 3: Add the button to the button bar**

In the button bar section (around line 665), add the "Charge at Register" button between "Save Draft" and "Generate PDF":

Change:

```tsx
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" tabIndex={-1} onClick={saveDraft} disabled={saving}>
            Save Draft
          </Button>
          <Button onClick={handleGenerate} disabled={saving}>
            Generate PDF {isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}
          </Button>
        </div>
```

To:

```tsx
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" tabIndex={-1} onClick={saveDraft} disabled={saving}>
            Save Draft
          </Button>
          <Button variant="secondary" tabIndex={-1} onClick={savePendingCharge} disabled={saving}>
            Charge at Register
          </Button>
          <Button onClick={handleGenerate} disabled={saving}>
            Generate PDF {isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}
          </Button>
        </div>
```

- [ ] **Step 4: Pass savePendingCharge from the new invoice page**

In `src/app/invoices/new/page.tsx`, the page already spreads `...invoiceForm` into `<KeyboardMode>`, and `useInvoiceForm` now returns `savePendingCharge`, so no change is needed — it passes through automatically.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoice/keyboard-mode.tsx
git commit -m "feat: add Charge at Register button to invoice form"
```

---

### Task 5: Invoice Filters — Add Pending Charge Option

**Files:**
- Modify: `src/components/invoices/invoice-filters.tsx`

- [ ] **Step 1: Add the filter option**

In `src/components/invoices/invoice-filters.tsx`, in the Status `<SelectContent>`, add the new option:

Change:

```tsx
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="FINAL">Final</SelectItem>
            </SelectContent>
```

To:

```tsx
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="FINAL">Final</SelectItem>
              <SelectItem value="PENDING_CHARGE">Pending Charge</SelectItem>
            </SelectContent>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/invoices/invoice-filters.tsx
git commit -m "feat: add Pending Charge to invoice status filter"
```

---

### Task 6: Invoice Table — Handle PENDING_CHARGE Badge

**Files:**
- Modify: `src/components/invoices/invoice-table.tsx`

- [ ] **Step 1: Update the status badge rendering**

In `src/components/invoices/invoice-table.tsx`, find the status badge cell (around line 279):

Change:

```tsx
                  <TableCell>
                    <Badge
                      variant={invoice.status === "FINAL" ? "default" : "outline"}
                    >
                      {invoice.status === "FINAL" ? "Final" : "Draft"}
                    </Badge>
                  </TableCell>
```

To:

```tsx
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === "FINAL"
                          ? "default"
                          : invoice.status === "PENDING_CHARGE"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {invoice.status === "FINAL"
                        ? "Final"
                        : invoice.status === "PENDING_CHARGE"
                          ? "Pending Charge"
                          : "Draft"}
                    </Badge>
                  </TableCell>
```

- [ ] **Step 2: Update the Invoice interface**

In the same file, update the `Invoice` interface to accept the new status:

Change:

```typescript
  status: "DRAFT" | "FINAL";
```

To:

```typescript
  status: "DRAFT" | "FINAL" | "PENDING_CHARGE";
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoices/invoice-table.tsx
git commit -m "feat: render PENDING_CHARGE status badge in invoice table"
```

---

### Task 7: Invoice Detail — Handle PENDING_CHARGE Status

**Files:**
- Modify: `src/components/invoices/invoice-detail.tsx`

- [ ] **Step 1: Update the Invoice interface**

In `src/components/invoices/invoice-detail.tsx`, update the `Invoice` interface:

Change:

```typescript
  status: "DRAFT" | "FINAL";
```

To:

```typescript
  status: "DRAFT" | "FINAL" | "PENDING_CHARGE";
```

- [ ] **Step 2: Add isPendingCharge flag and update status logic**

After the existing `isDraft` and `isFinal` declarations (around line 190), add:

```typescript
  const isPendingCharge = invoice.status === "PENDING_CHARGE";
```

- [ ] **Step 3: Update the status badge**

Change the Badge rendering:

From:

```tsx
          <Badge variant={isFinal ? "default" : "outline"}>
            {isFinal ? "Final" : "Draft"}
          </Badge>
```

To:

```tsx
          <Badge
            variant={
              isFinal ? "default" : isPendingCharge ? "secondary" : "outline"
            }
          >
            {isFinal
              ? "Final"
              : isPendingCharge
                ? "Pending Charge"
                : "Draft"}
          </Badge>
```

- [ ] **Step 4: Add edit and action buttons for PENDING_CHARGE**

The existing `isDraft` conditional already shows "Edit" and "Delete" buttons. Update these to also show for `isPendingCharge`. Find:

```tsx
          {isDraft && (
            <Link
              href={`/invoices/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit
            </Link>
          )}
```

Change to:

```tsx
          {(isDraft || isPendingCharge) && (
            <Link
              href={`/invoices/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {isPendingCharge ? "Complete POS Charge" : "Edit"}
            </Link>
          )}
```

Also update the delete button condition at the bottom from `isDraft` checks to `(isDraft || isPendingCharge)`.

Find the ternary that switches between direct delete (for drafts) and dialog delete (for final):

```tsx
          {isDraft ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteClick}
              disabled={deleting}
            >
```

Change to:

```tsx
          {(isDraft || isPendingCharge) ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteClick}
              disabled={deleting}
            >
```

- [ ] **Step 5: Update the heading for PENDING_CHARGE invoices**

Change the heading display to show a meaningful label instead of "NEEDPOSCHARGE":

From:

```tsx
          <h1 className="text-2xl font-bold text-balance">{invoice.invoiceNumber}</h1>
```

To:

```tsx
          <h1 className="text-2xl font-bold text-balance">
            {invoice.invoiceNumber === "NEEDPOSCHARGE"
              ? "Pending POS Charge"
              : invoice.invoiceNumber}
          </h1>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/invoices/invoice-detail.tsx
git commit -m "feat: handle PENDING_CHARGE status in invoice detail view"
```

---

### Task 8: Edit Page — Highlight Missing Fields for PENDING_CHARGE

**Files:**
- Modify: `src/app/invoices/[id]/edit/page.tsx`
- Modify: `src/components/invoice/keyboard-mode.tsx`

- [ ] **Step 1: Pass pending charge flag from edit page**

In `src/app/invoices/[id]/edit/page.tsx`, detect if the invoice is a pending charge and pass a prop. After the `mapApiToFormData` call, check the status:

Add `isPendingCharge` state:

```typescript
  const [isPendingCharge, setIsPendingCharge] = useState(false);
```

In the fetch `.then` handler where `setInitialData` is called, add:

```typescript
        setIsPendingCharge(invoice.status === "PENDING_CHARGE");
```

Then pass it to KeyboardMode:

Change:

```tsx
      <KeyboardMode {...invoiceForm} />
```

To:

```tsx
      <KeyboardMode {...invoiceForm} isPendingCharge={isPendingCharge} />
```

Also update the heading:

Change:

```tsx
      <h1 className="text-2xl font-semibold mb-6">Edit Invoice</h1>
```

To:

```tsx
      <h1 className="text-2xl font-semibold mb-6">
        {isPendingCharge ? "Complete POS Charge" : "Edit Invoice"}
      </h1>
```

- [ ] **Step 2: Add isPendingCharge prop to KeyboardMode**

In `src/components/invoice/keyboard-mode.tsx`, add to the props interface:

```typescript
  isPendingCharge?: boolean;
```

Add to the destructured props:

```typescript
  isPendingCharge = false,
```

- [ ] **Step 3: Add the pending charge banner and field highlighting**

At the top of the component's return JSX (before the first section), add a banner when `isPendingCharge` is true:

```tsx
      {isPendingCharge && (
        <div className="rounded-lg border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 mb-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            This invoice needs a POS charge. Enter the AG number and upload the PrismCore PDF to finalize.
          </p>
        </div>
      )}
```

For the invoice number input field, add highlighting when it's a pending charge. Find the invoice number input and wrap it with a conditional highlight class:

The invoice number input should get this wrapper when `isPendingCharge` is true:

```tsx
className={cn(
  isPendingCharge && form.invoiceNumber === "NEEDPOSCHARGE" &&
    "rounded-lg border-l-4 border-l-primary bg-primary/5 p-2 -ml-2"
)}
```

Apply the same highlight treatment to the PrismCore upload section when `isPendingCharge && !form.prismcorePath`:

```tsx
className={cn(
  isPendingCharge && !form.prismcorePath &&
    "rounded-lg border-l-4 border-l-primary bg-primary/5 p-2 -ml-2"
)}
```

- [ ] **Step 4: Auto-select the invoice number field on pending charge edit**

Add a ref and auto-focus for the invoice number input when `isPendingCharge`:

```typescript
  const invoiceNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPendingCharge && invoiceNumberRef.current) {
      // Select all text so user can immediately type the AG number
      invoiceNumberRef.current.select();
    }
  }, [isPendingCharge]);
```

Add `ref={invoiceNumberRef}` to the invoice number input element.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/invoices/[id]/edit/page.tsx' src/components/invoice/keyboard-mode.tsx
git commit -m "feat: highlight missing fields on PENDING_CHARGE invoice edit"
```

---

### Task 9: Dashboard Card — Pending POS Charges

**Files:**
- Create: `src/components/dashboard/pending-charges.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the PendingCharges dashboard card**

Create `src/components/dashboard/pending-charges.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PendingInvoice {
  id: string;
  department: string;
  totalAmount: string | number;
  date: string;
  creator: { id: string; name: string; username: string };
}

interface PendingResponse {
  invoices: PendingInvoice[];
  total: number;
}

function formatAmount(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PendingCharges() {
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPending() {
      try {
        const res = await fetch(
          "/api/invoices?status=PENDING_CHARGE&pageSize=10&sortBy=createdAt&sortDir=asc"
        );
        if (res.ok) {
          const data: PendingResponse = await res.json();
          setInvoices(data.invoices);
          setTotal(data.total);
        }
      } catch {
        // Silently fail — dashboard card is non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchPending();
  }, []);

  if (loading || total === 0) return null;

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Pending POS Charges
          </CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}/edit`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{inv.creator.name}</span>
                <span className="text-muted-foreground">{inv.department}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{formatDate(inv.date)}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatAmount(inv.totalAmount)}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {total > 10 && (
          <Link
            href="/invoices?status=PENDING_CHARGE"
            className="block text-center text-xs text-muted-foreground hover:text-foreground mt-3 pt-2 border-t border-border"
          >
            View all {total} pending charges
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add PendingCharges to the dashboard page**

In `src/app/page.tsx`, add the import and place the card between StatsCards and RecentInvoices:

Add import:

```typescript
import { PendingCharges } from "@/components/dashboard/pending-charges";
```

In the JSX, after `<StatsCards />` and before `<RecentInvoices />`:

```tsx
      <PendingCharges />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/pending-charges.tsx src/app/page.tsx
git commit -m "feat: add Pending POS Charges dashboard card"
```

---

### Task 10: Finalization Guard — Reject NEEDPOSCHARGE

**Files:**
- Modify: `src/app/api/invoices/[id]/finalize/route.ts`

- [ ] **Step 1: Add validation check**

In `src/app/api/invoices/[id]/finalize/route.ts`, after the existing invoice lookup and before PDF generation, add a check that the invoice number is not the placeholder:

Find the section after the invoice is fetched (the `const invoice = await prisma.invoice.findUnique(...)` call) and add:

```typescript
    // Block finalization if invoice number is still the placeholder
    if (!invoice.invoiceNumber || invoice.invoiceNumber === "NEEDPOSCHARGE") {
      return NextResponse.json(
        { error: "Enter the AG invoice number before finalizing" },
        { status: 400 }
      );
    }
```

This ensures users can't accidentally finalize without entering the real AG number.

- [ ] **Step 2: Update status from PENDING_CHARGE to FINAL**

The existing finalization code already sets `status: "FINAL"`. This works correctly for `PENDING_CHARGE` invoices too — no change needed. The status transition is `PENDING_CHARGE` → `FINAL` (same as `DRAFT` → `FINAL`).

- [ ] **Step 3: Commit**

```bash
git add 'src/app/api/invoices/[id]/finalize/route.ts'
git commit -m "feat: block finalization with NEEDPOSCHARGE placeholder"
```

---

### Task 11: Build Verification

**Files:** None new — verification step.

- [ ] **Step 1: Run the full build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run: `npm test -- --run`

Expected: All tests pass.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`

Expected: No lint errors (only the pre-existing inline-combobox warning).

- [ ] **Step 4: Fix any issues and commit**

If any build/lint/test failures, fix them and commit:

```bash
git add -A
git commit -m "fix: address build issues from pending charge feature"
```

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `src/components/dashboard/pending-charges.tsx` | Dashboard card showing pending POS charges across all users |

### Modified Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `PENDING_CHARGE` to `InvoiceStatus` enum |
| `src/lib/validators.ts` | Add optional `status` field to `invoiceCreateSchema` |
| `src/app/api/invoices/route.ts` | Accept `status` field in POST handler |
| `src/app/api/invoices/[id]/finalize/route.ts` | Block finalization with `NEEDPOSCHARGE` placeholder |
| `src/components/invoice/invoice-form.tsx` | Add `savePendingCharge` callback |
| `src/components/invoice/keyboard-mode.tsx` | Add "Charge at Register" button, pending charge banner and field highlighting |
| `src/components/invoices/invoice-filters.tsx` | Add "Pending Charge" to status filter dropdown |
| `src/components/invoices/invoice-table.tsx` | Handle `PENDING_CHARGE` status badge |
| `src/components/invoices/invoice-detail.tsx` | Handle `PENDING_CHARGE` status, show "Complete POS Charge" action |
| `src/app/invoices/[id]/edit/page.tsx` | Detect pending charge, pass flag to KeyboardMode |
| `src/app/page.tsx` | Add PendingCharges dashboard card |
