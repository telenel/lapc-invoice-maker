# Line Item Autocomplete, Quick Picks Side Panel & Email Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add autocomplete to line item descriptions, redesign quick picks as a persistent side panel with personal per-user picks, and add an email button for finalized invoices.

**Architecture:** New `UserQuickPick` model for per-user picks. The `InlineCombobox` pattern (already used for staff/category search) is reused for line item description autocomplete. Quick picks panel moves from a collapsible horizontal layout to a persistent side column. Email button uses `mailto:` with PDF download.

**Tech Stack:** Next.js 14, Prisma 7, TypeScript, InlineCombobox component, `mailto:` links

**Spec:** `docs/superpowers/specs/2026-03-27-line-items-quickpicks-email-design.md`

---

### Task 1: UserQuickPick Data Model + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add UserQuickPick model to schema**

Add after the `SavedLineItem` model:

```prisma
model UserQuickPick {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  description String
  unitPrice   Decimal  @map("unit_price") @db.Decimal(10, 2)
  department  String
  usageCount  Int      @default(0) @map("usage_count")
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, department, description])
  @@map("user_quick_picks")
}
```

Also add `userQuickPicks UserQuickPick[]` to the `User` model's relations.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-user-quick-picks
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add UserQuickPick model for per-user quick picks"
```

---

### Task 2: UserQuickPick API Routes

**Files:**
- Create: `src/app/api/user-quick-picks/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department") ?? undefined;

  const picks = await prisma.userQuickPick.findMany({
    where: { userId },
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
  });

  // Group by: matching department first, then other
  const result = picks.map((p) => ({
    id: p.id,
    description: p.description,
    unitPrice: Number(p.unitPrice),
    department: p.department,
    usageCount: p.usageCount,
    isCurrentDept: department ? p.department === department : false,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { description, unitPrice, department } = body;

  if (!description || unitPrice == null || !department) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pick = await prisma.userQuickPick.upsert({
    where: {
      userId_department_description: { userId, department, description },
    },
    update: { unitPrice },
    create: { userId, description, unitPrice, department },
  });

  return NextResponse.json({
    id: pick.id,
    description: pick.description,
    unitPrice: Number(pick.unitPrice),
    department: pick.department,
    usageCount: pick.usageCount,
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.userQuickPick.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/user-quick-picks/route.ts
git commit -m "feat: add UserQuickPick API (GET/POST/DELETE)"
```

---

### Task 3: Quick Picks Side Panel Component

**Files:**
- Create: `src/components/invoice/quick-picks-side-panel.tsx`

- [ ] **Step 1: Create the side panel component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/formatters";

interface QuickPick {
  id: string;
  description: string;
  defaultPrice: number;
  department: string;
  usageCount: number;
}

interface UserPick {
  id: string;
  description: string;
  unitPrice: number;
  department: string;
  usageCount: number;
  isCurrentDept: boolean;
}

interface QuickPicksSidePanelProps {
  department: string;
  currentSubtotal: number;
  onSelect: (description: string, price: number) => void;
}

export function QuickPicksSidePanel({
  department,
  currentSubtotal,
  onSelect,
}: QuickPicksSidePanelProps) {
  const [globalPicks, setGlobalPicks] = useState<QuickPick[]>([]);
  const [userPicks, setUserPicks] = useState<UserPick[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!department) return;
    let cancelled = false;

    Promise.all([
      fetch(`/api/quick-picks?department=${encodeURIComponent(department)}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/user-quick-picks?department=${encodeURIComponent(department)}`).then((r) => r.ok ? r.json() : []),
    ]).then(([picks, uPicks]) => {
      if (cancelled) return;
      setGlobalPicks(Array.isArray(picks) ? picks : []);
      setUserPicks(Array.isArray(uPicks) ? uPicks : []);
    });

    return () => { cancelled = true; };
  }, [department]);

  function getPrice(pick: QuickPick): number {
    if (pick.description.includes("State Tax")) {
      return Math.round(currentSubtotal * 0.095 * 100) / 100;
    }
    return Number(pick.defaultPrice);
  }

  function formatLabel(description: string, price: number): string {
    if (price === 0) return description;
    return description;
  }

  const lower = filter.toLowerCase();
  const filteredGlobal = globalPicks.filter((p) =>
    !lower || p.description.toLowerCase().includes(lower)
  );
  const deptPicks = userPicks.filter((p) => p.isCurrentDept && (!lower || p.description.toLowerCase().includes(lower)));
  const otherPicks = userPicks.filter((p) => !p.isCurrentDept && (!lower || p.description.toLowerCase().includes(lower)));

  const hasContent = filteredGlobal.length > 0 || deptPicks.length > 0 || otherPicks.length > 0;

  return (
    <div className="w-[160px] flex-shrink-0 border-l border-border/60 pl-3 flex flex-col" style={{ maxHeight: "500px" }}>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter picks..."
        className="h-7 text-[10px] mb-2"
        tabIndex={-1}
      />

      <div className="flex-1 overflow-y-auto space-y-1">
        {!hasContent && (
          <p className="text-[10px] text-muted-foreground">No picks available</p>
        )}

        {filteredGlobal.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide pt-1 pb-0.5">Standard</p>
            {filteredGlobal.map((pick) => (
              <button
                key={pick.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(pick.description, getPrice(pick))}
                className="w-full text-left px-2 py-1.5 text-[10px] bg-muted rounded-md hover:bg-muted/80 transition-colors truncate"
                title={`${pick.description} — ${formatAmount(getPrice(pick))}`}
              >
                {pick.description}
              </button>
            ))}
          </>
        )}

        {deptPicks.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide pt-2 pb-0.5">
              My Picks · {department}
            </p>
            {deptPicks.map((pick) => (
              <button
                key={pick.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(pick.description, pick.unitPrice)}
                className="w-full text-left px-2 py-1.5 text-[10px] border border-border rounded-md hover:bg-muted/50 transition-colors truncate"
                title={`${pick.description} — ${formatAmount(pick.unitPrice)}`}
              >
                {pick.description}
              </button>
            ))}
          </>
        )}

        {otherPicks.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide pt-2 pb-0.5">
              My Picks · Other
            </p>
            {otherPicks.map((pick) => (
              <button
                key={pick.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(pick.description, pick.unitPrice)}
                className="w-full text-left px-2 py-1.5 text-[10px] border border-dashed border-border/60 text-muted-foreground rounded-md hover:bg-muted/50 transition-colors truncate"
                title={`${pick.description} — ${formatAmount(pick.unitPrice)}`}
              >
                {pick.description}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoice/quick-picks-side-panel.tsx
git commit -m "feat: add QuickPicksSidePanel component with sections and filter"
```

---

### Task 4: Line Item Autocomplete

**Files:**
- Modify: `src/components/invoice/line-items.tsx`

- [ ] **Step 1: Add autocomplete data fetching and star button**

Add these new props to `LineItemsProps`:

```typescript
interface LineItemsProps {
  items: InvoiceItem[];
  onUpdate: (index: number, updates: Partial<InvoiceItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  total: number;
  department: string;
  firstDescriptionRef?: React.RefObject<HTMLInputElement | null>;
  focusQtyForRow?: (index: number) => void;
  /** Autocomplete suggestions for description field */
  suggestions: { description: string; unitPrice: number }[];
  /** IDs of descriptions in user's quick picks (for star state) */
  userPickDescriptions: Set<string>;
  /** Called when user stars/unstars a line item */
  onTogglePick: (description: string, unitPrice: number, department: string) => void;
}
```

Replace the `<Input>` for description (col-span-4) with an `InlineCombobox`. Replace the Bookmark save button with a ★ star toggle.

The description field changes from:
```tsx
<Input
  ref={(el) => { ... }}
  value={item.description}
  onChange={(e) => onUpdate(index, { description: e.target.value })}
  onKeyDown={(e) => handleDescriptionKeyDown(e, index)}
  placeholder="Description…"
  ...
/>
```

To an `InlineCombobox` that:
- Shows `suggestions` filtered by what the user types
- On select: fills description + unitPrice, focuses qty
- Still allows free-text entry (custom descriptions)

For the star button, replace the Bookmark button with:
```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  onClick={() => onTogglePick(item.description, item.unitPrice, department)}
  className={cn(
    "focus-visible:ring-2 focus-visible:ring-ring",
    isStarred ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground"
  )}
  aria-label={isStarred ? "Remove from quick picks" : "Save to quick picks"}
>
  <Star className="h-4 w-4" fill={isStarred ? "currentColor" : "none"} aria-hidden="true" />
</Button>
```

Where `isStarred = userPickDescriptions.has(item.description)`.

Full implementation details: read the existing `InlineCombobox` component at `src/components/ui/inline-combobox.tsx` for the API. The suggestions should be `ComboboxItem[]` where `id` is the description, `label` is the description, and `sublabel` is the formatted price.

- [ ] **Step 2: Update imports**

Replace `Bookmark` with `Star` from lucide-react. Add `InlineCombobox` and `ComboboxItem` imports:

```typescript
import { Star } from "lucide-react";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/formatters";
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/line-items.tsx
git commit -m "feat: add autocomplete + star button to line item description field"
```

---

### Task 5: Integrate Side Panel + Autocomplete into Keyboard Mode

**Files:**
- Modify: `src/components/invoice/keyboard-mode.tsx`

- [ ] **Step 1: Replace QuickPickPanel with QuickPicksSidePanel**

In imports, replace:
```typescript
import { QuickPickPanel } from "./quick-pick-panel";
```
With:
```typescript
import { QuickPicksSidePanel } from "./quick-picks-side-panel";
```

- [ ] **Step 2: Add autocomplete data fetching**

Add state and fetching for autocomplete suggestions and user picks. After the existing `staff` and `categories` state/effects, add:

```typescript
const [suggestions, setSuggestions] = useState<{ description: string; unitPrice: number }[]>([]);
const [userPickDescriptions, setUserPickDescriptions] = useState<Set<string>>(new Set());
const [userPicks, setUserPicks] = useState<{ id: string; description: string; unitPrice: number; department: string }[]>([]);

// Fetch autocomplete suggestions when department changes
useEffect(() => {
  if (!form.department) return;
  let cancelled = false;

  Promise.all([
    fetch(`/api/quick-picks?department=${encodeURIComponent(form.department)}`).then((r) => r.ok ? r.json() : []),
    fetch(`/api/saved-items?department=${encodeURIComponent(form.department)}`).then((r) => r.ok ? r.json() : []),
    fetch(`/api/user-quick-picks?department=${encodeURIComponent(form.department)}`).then((r) => r.ok ? r.json() : []),
  ]).then(([picks, saved, uPicks]) => {
    if (cancelled) return;
    const combined = new Map<string, { description: string; unitPrice: number }>();
    for (const p of picks) combined.set(p.description, { description: p.description, unitPrice: Number(p.defaultPrice) });
    for (const s of saved) combined.set(s.description, { description: s.description, unitPrice: Number(s.unitPrice) });
    for (const u of uPicks) combined.set(u.description, { description: u.description, unitPrice: Number(u.unitPrice) });
    setSuggestions(Array.from(combined.values()));
    setUserPicks(uPicks);
    setUserPickDescriptions(new Set(uPicks.map((p: { description: string }) => p.description)));
  });

  return () => { cancelled = true; };
}, [form.department]);
```

- [ ] **Step 3: Add star toggle handler**

```typescript
async function handleTogglePick(description: string, unitPrice: number, department: string) {
  if (userPickDescriptions.has(description)) {
    // Remove
    const pick = userPicks.find((p) => p.description === description && p.department === department);
    if (pick) {
      await fetch(`/api/user-quick-picks?id=${pick.id}`, { method: "DELETE" });
      setUserPicks((prev) => prev.filter((p) => p.id !== pick.id));
      setUserPickDescriptions((prev) => { const next = new Set(prev); next.delete(description); return next; });
      toast.success("Removed from quick picks");
    }
  } else {
    // Add
    const res = await fetch("/api/user-quick-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, unitPrice, department }),
    });
    if (res.ok) {
      const newPick = await res.json();
      setUserPicks((prev) => [...prev, newPick]);
      setUserPickDescriptions((prev) => new Set(prev).add(description));
      toast.success("Added to quick picks");
    }
  }
}
```

- [ ] **Step 4: Update the LINE ITEMS section layout**

Replace the current line items section (the collapsible QuickPickPanel + LineItems) with a flex layout that puts the side panel next to line items:

```tsx
{/* ============ LINE ITEMS ============ */}
<SectionDivider label="LINE ITEMS" />

<div className="flex items-center gap-2 mt-2 mb-3">
  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Margin %</span>
  <Input
    type="number"
    min={0}
    step={0.1}
    value={marginPercent}
    onChange={(e) => setMarginPercent(e.target.value)}
    placeholder="e.g. 15"
    className="w-24 h-8 text-sm"
    tabIndex={-1}
  />
  <Button type="button" variant="outline" size="xs" tabIndex={-1} onClick={handleApplyMargin}>
    Apply
  </Button>
</div>

<div className="flex gap-4">
  <div className="flex-1 min-w-0">
    <LineItems
      items={form.items}
      onUpdate={updateItem}
      onAdd={addItem}
      onRemove={removeItem}
      total={total}
      department={form.department}
      suggestions={suggestions}
      userPickDescriptions={userPickDescriptions}
      onTogglePick={handleTogglePick}
    />
  </div>
  <QuickPicksSidePanel
    department={form.department}
    currentSubtotal={total}
    onSelect={handleQuickPick}
  />
</div>
```

Remove the `quickPicksOpen` state, the chevron toggle button, and the `QuickPickPanel` rendering.

- [ ] **Step 5: Remove unused imports and state**

Remove: `ChevronDownIcon`, `ChevronRightIcon` imports (if only used for quick picks toggle). Remove `quickPicksOpen` state. Remove the `QuickPickPanel` import.

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/invoice/keyboard-mode.tsx
git commit -m "feat: integrate side panel + autocomplete into keyboard mode"
```

---

### Task 6: Email Button on Invoice Detail

**Files:**
- Modify: `src/components/invoices/invoice-detail.tsx`

- [ ] **Step 1: Add email handler function**

Add after the existing `handleRegeneratePdf` function:

```typescript
function handleEmail() {
  if (!invoice) return;

  // Step 1: Download PDF
  window.open(`/api/invoices/${id}/pdf`, "_blank");

  // Step 2: Build mailto link
  const subject = encodeURIComponent(
    `Invoice ${invoice.invoiceNumber} Ready for Processing — ${invoice.department}`
  );
  const body = encodeURIComponent(
    `Invoice ${invoice.invoiceNumber} is ready for processing. Please find the attached invoice.\n\n` +
    `Department: ${invoice.department}\n` +
    `Staff: ${invoice.staff.name}\n` +
    `Account Number: ${invoice.accountNumber || "N/A"}\n` +
    `Account Code: ${invoice.accountCode || "N/A"}\n` +
    `Amount: ${formatAmount(invoice.totalAmount)}\n` +
    `Date: ${formatDate(invoice.date)}\n\n` +
    `Thank you,\n${invoice.creator.name}`
  );

  // Small delay so PDF download starts first
  setTimeout(() => {
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, 500);

  toast.info("PDF downloaded — attach it to the email");
}
```

Note: `formatAmount` and `formatDate` are already imported (as `formatDateLong as formatDate`).

- [ ] **Step 2: Add email button to the action buttons area**

Add after the "Download PDF" button, inside the `{isFinal && (` block:

```tsx
{isFinal && (
  <>
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegeneratePdf}
      disabled={regenerating}
    >
      {regenerating ? "Regenerating…" : "Regenerate PDF"}
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={handleEmail}
    >
      <MailIcon className="h-4 w-4 mr-1" aria-hidden="true" />
      Email
    </Button>
  </>
)}
```

- [ ] **Step 3: Add MailIcon import**

Add to the lucide-react imports:

```typescript
import { MailIcon } from "lucide-react";
```

Note: `toast` is already imported from sonner.

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/invoices/invoice-detail.tsx
git commit -m "feat: add email button on finalized invoice detail page"
```

---

### Task 7: Clean Up Old Quick Pick Panel

**Files:**
- Delete: `src/components/invoice/quick-pick-panel.tsx`

- [ ] **Step 1: Verify QuickPickPanel is no longer imported anywhere**

```bash
grep -r "QuickPickPanel\|quick-pick-panel" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (keyboard-mode.tsx should have been updated in Task 5 to remove the import).

- [ ] **Step 2: Delete the file**

```bash
rm src/components/invoice/quick-pick-panel.tsx
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old QuickPickPanel component (replaced by side panel)"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: All tests pass

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: Build succeeds

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: No new lint errors

- [ ] **Step 4: Visual check**

Start dev server and verify:
- New invoice page: side panel visible with Standard / My Picks sections
- Description field: autocomplete dropdown appears when typing
- Star button: click to save/unsave items to personal picks
- Filter input: filters all sections in the side panel
- Invoice detail: Email button visible on FINAL invoices, downloads PDF + opens mailto
- Keyboard navigation: Enter/Tab flow still works as expected
