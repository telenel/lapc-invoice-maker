# Repetitive Data Entry Elimination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate repetitive invoice/quote creation with Duplicate, Templates, Smart Chatbot Memory, and Draft Auto-Save.

**Architecture:** Four independent features built in dependency order. Duplicate is pure service+UI (no new models). Auto-Save is pure client-side. Templates add a new Prisma model + full domain. Chatbot Memory builds on Duplicate + Templates.

**Tech Stack:** Next.js 14, Prisma 7, Zod, Vercel AI SDK, localStorage, SSE

---

## Feature 1: Duplicate Button

### Task 1: Invoice duplicate service method

**Files:**
- Modify: `src/domains/invoice/service.ts`
- Modify: `src/domains/invoice/repository.ts`

- [ ] **Step 1: Add `duplicate` method to invoice service**

In `src/domains/invoice/service.ts`, add after the `create` method:

```typescript
async duplicate(id: string, creatorId: string): Promise<InvoiceResponse> {
  const source = await invoiceRepository.findById(id);
  if (!source) {
    throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const items = source.items.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    isTaxable: item.isTaxable,
    costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : undefined,
  }));

  const calculatedItems = calculateLineItems(items);
  const totalAmount = calculateTotal(
    calculatedItems,
    source.marginEnabled,
    source.marginPercent != null ? Number(source.marginPercent) : undefined,
    source.taxEnabled,
    source.taxRate != null ? Number(source.taxRate) : undefined
  );

  const { cateringDetails, ...restSource } = source;
  const invoice = await invoiceRepository.create(
    {
      date: now.toISOString().split("T")[0],
      category: restSource.category,
      department: restSource.department,
      staffId: restSource.staffId ?? undefined,
      contactId: (restSource as { contactId?: string | null }).contactId ?? undefined,
      accountCode: restSource.accountCode,
      accountNumber: restSource.accountNumber,
      approvalChain: (restSource.approvalChain as string[]) ?? [],
      notes: restSource.notes,
      marginEnabled: restSource.marginEnabled,
      marginPercent: restSource.marginPercent != null ? Number(restSource.marginPercent) : undefined,
      taxEnabled: restSource.taxEnabled,
      taxRate: restSource.taxRate != null ? Number(restSource.taxRate) : undefined,
      isCateringEvent: restSource.isCateringEvent,
      cateringDetails: cateringDetails as Prisma.InputJsonValue | undefined,
    },
    calculatedItems,
    totalAmount,
    creatorId
  );

  safePublishAll({ type: "invoice-changed" });
  return toInvoiceResponse(invoice as unknown as NonNullable<InvoiceWithRelations>);
},
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/invoice/service.ts
git commit -m "feat: add invoice duplicate service method"
```

### Task 2: Quote duplicate service method

**Files:**
- Modify: `src/domains/quote/service.ts`

- [ ] **Step 1: Add `duplicate` method to quote service**

In `src/domains/quote/service.ts`, add after the `createRevision` method. Pattern is similar to `createRevision` but does NOT change the original's status:

```typescript
async duplicate(id: string, creatorId: string): Promise<{ id: string; quoteNumber: string | null }> {
  const { prisma } = await import("@/lib/prisma");
  const quote = await quoteRepository.findById(id);
  if (!quote || quote.type !== "QUOTE") {
    throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const expirationDate = new Date(now);
  expirationDate.setDate(expirationDate.getDate() + 30);
  const quoteNumber = await quoteRepository.generateNumber();

  const calculatedItems = calculateLineItems(
    quote.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      isTaxable: item.isTaxable,
      costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
      marginOverride: item.marginOverride != null ? Number(item.marginOverride) : undefined,
    }))
  );
  const totalAmount = calculateTotal(
    calculatedItems,
    quote.marginEnabled,
    quote.marginPercent != null ? Number(quote.marginPercent) : undefined,
    quote.taxEnabled,
    quote.taxRate != null ? Number(quote.taxRate) : undefined
  );

  const newQuote = await prisma.invoice.create({
    data: {
      type: "QUOTE",
      status: "DRAFT",
      quoteStatus: "DRAFT",
      quoteNumber,
      date: now,
      category: quote.category,
      department: quote.department,
      staffId: quote.staffId ?? undefined,
      contactId: (quote as { contactId?: string | null }).contactId ?? undefined,
      accountCode: quote.accountCode,
      accountNumber: quote.accountNumber,
      approvalChain: quote.approvalChain ?? [],
      notes: quote.notes,
      recipientName: quote.recipientName,
      recipientEmail: quote.recipientEmail,
      recipientOrg: quote.recipientOrg,
      expirationDate,
      totalAmount,
      marginEnabled: quote.marginEnabled,
      marginPercent: quote.marginPercent,
      taxEnabled: quote.taxEnabled,
      taxRate: quote.taxRate,
      isCateringEvent: quote.isCateringEvent,
      cateringDetails: quote.cateringDetails ?? undefined,
      createdBy: creatorId,
      items: {
        create: calculatedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extendedPrice: item.extendedPrice,
          sortOrder: item.sortOrder,
          isTaxable: item.isTaxable,
          costPrice: item.costPrice ?? undefined,
          marginOverride: item.marginOverride ?? undefined,
        })),
      },
    },
    select: { id: true, invoiceNumber: true },
  });

  safePublishAll({ type: "quote-changed" });
  return { id: newQuote.id, quoteNumber: newQuote.invoiceNumber };
},
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/quote/service.ts
git commit -m "feat: add quote duplicate service method"
```

### Task 3: Duplicate API routes

**Files:**
- Create: `src/app/api/invoices/[id]/duplicate/route.ts`
- Create: `src/app/api/quotes/[id]/duplicate/route.ts`

- [ ] **Step 1: Create invoice duplicate route**

```typescript
// src/app/api/invoices/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const existing = await invoiceService.getById(id);
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const invoice = await invoiceService.duplicate(id, session.user.id);
    return NextResponse.json(
      { invoice, redirectTo: `/invoices/${invoice.id}/edit` },
      { status: 201 }
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    console.error("POST /api/invoices/[id]/duplicate failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
```

- [ ] **Step 2: Create quote duplicate route**

```typescript
// src/app/api/quotes/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const existing = await quoteService.getById(id);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const result = await quoteService.duplicate(id, session.user.id);
    return NextResponse.json(
      { quote: result, redirectTo: `/quotes/${result.id}/edit` },
      { status: 201 }
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    console.error("POST /api/quotes/[id]/duplicate failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/invoices/[id]/duplicate/route.ts" "src/app/api/quotes/[id]/duplicate/route.ts"
git commit -m "feat: add duplicate API routes for invoices and quotes"
```

### Task 4: Duplicate buttons in UI

**Files:**
- Modify: `src/components/invoices/invoice-detail.tsx`
- Modify: `src/components/quotes/quote-detail.tsx`

- [ ] **Step 1: Add Duplicate button to invoice detail**

In `src/components/invoices/invoice-detail.tsx`, find the action buttons area. Add a Duplicate button that works on ALL statuses:

```typescript
// Add to imports
import { CopyIcon } from "lucide-react";

// Add handler
const handleDuplicate = useCallback(async () => {
  try {
    const res = await fetch(`/api/invoices/${invoice.id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to duplicate");
      return;
    }
    const data = await res.json();
    toast.success(`Draft created from ${invoice.invoiceNumber ?? "invoice"}`);
    router.push(data.redirectTo);
  } catch {
    toast.error("Failed to duplicate");
  }
}, [invoice, router]);

// Add button in action area (available on ALL statuses)
<Button variant="outline" size="sm" onClick={handleDuplicate}>
  <CopyIcon className="size-3.5 mr-1.5" />
  Duplicate
</Button>
```

- [ ] **Step 2: Add Duplicate button to quote detail**

In `src/components/quotes/quote-detail.tsx`, add similar button. Find the action buttons section (around line 367). Add `duplicating` to `actionState`. Add handler and button available on ALL statuses:

```typescript
// Add to actionState
duplicating: false,

// Add handler
const handleDuplicate = useCallback(async () => {
  setActionState((prev) => ({ ...prev, duplicating: true }));
  try {
    const res = await fetch(`/api/quotes/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to duplicate");
      return;
    }
    const data = await res.json();
    toast.success(`Draft created from ${quote?.quoteNumber ?? "quote"}`);
    router.push(data.redirectTo);
  } catch {
    toast.error("Failed to duplicate");
  } finally {
    setActionState((prev) => ({ ...prev, duplicating: false }));
  }
}, [id, quote, router]);

// Add button (ALL statuses)
<Button variant="outline" size="sm" onClick={handleDuplicate} disabled={actionState.duplicating}>
  <CopyIcon className="size-3.5 mr-1.5" />
  {actionState.duplicating ? "Duplicating..." : "Duplicate"}
</Button>
```

- [ ] **Step 3: Verify build**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-detail.tsx src/components/quotes/quote-detail.tsx
git commit -m "feat: add Duplicate button to invoice and quote detail pages"
```

---

## Feature 2: Draft Auto-Save

### Task 5: Create useAutoSave hook

**Files:**
- Create: `src/lib/use-auto-save.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/lib/use-auto-save.ts
"use client";

import { useEffect, useRef, useCallback } from "react";

const SAVE_INTERVAL = 30_000; // 30 seconds
const EXPIRY_DAYS = 7;

function getDraftKey(routeKey: string): string {
  return `draft:${routeKey}`;
}

export function useAutoSave<T>(formState: T, routeKey: string) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Save to localStorage periodically
  useEffect(() => {
    timerRef.current = setInterval(() => {
      try {
        const entry = { data: formState, savedAt: Date.now() };
        localStorage.setItem(getDraftKey(routeKey), JSON.stringify(entry));
      } catch {
        // localStorage full or unavailable — ignore
      }
    }, SAVE_INTERVAL);

    return () => clearInterval(timerRef.current);
  }, [formState, routeKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(getDraftKey(routeKey));
  }, [routeKey]);

  return { clearDraft };
}

export function loadDraft<T>(routeKey: string): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(getDraftKey(routeKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as { data: T; savedAt: number };
    // Expire after 7 days
    if (Date.now() - entry.savedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getDraftKey(routeKey));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/use-auto-save.ts
git commit -m "feat: add useAutoSave hook with localStorage persistence"
```

### Task 6: Create DraftRecoveryBanner component

**Files:**
- Create: `src/components/ui/draft-recovery-banner.tsx`

- [ ] **Step 1: Create the banner**

```typescript
// src/components/ui/draft-recovery-banner.tsx
"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "lucide-react";

interface DraftRecoveryBannerProps {
  savedAt: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({ savedAt, onResume, onDiscard }: DraftRecoveryBannerProps) {
  const timeAgo = getRelativeTime(savedAt);

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
      <AlertTriangleIcon className="size-5 text-amber-600 shrink-0" />
      <p className="text-sm flex-1">
        You have an unsaved draft from <strong>{timeAgo}</strong>.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" onClick={onResume}>
          Resume
        </Button>
      </div>
    </div>
  );
}

function getRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "a few seconds ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/draft-recovery-banner.tsx
git commit -m "feat: add DraftRecoveryBanner component"
```

### Task 7: Wire auto-save into invoice and quote forms

**Files:**
- Modify: `src/components/invoice/keyboard-mode.tsx`
- Modify: `src/components/quote/quote-mode.tsx`

- [ ] **Step 1: Add auto-save to invoice form**

In `src/components/invoice/keyboard-mode.tsx`:

```typescript
import { useAutoSave, loadDraft } from "@/lib/use-auto-save";
import { DraftRecoveryBanner } from "@/components/ui/draft-recovery-banner";

// Inside the component, after form state is available:
const routeKey = existingId ? `/invoices/${existingId}/edit` : "/invoices/new";
const { clearDraft } = useAutoSave(form, routeKey);

// Recovery state
const [draftEntry, setDraftEntry] = useState(() => loadDraft<typeof form>(routeKey));

// On successful save, clear the draft:
// Add clearDraft() call in saveDraft, saveAndFinalize, savePendingCharge success paths

// Render banner at top of form if draft exists:
{draftEntry && (
  <DraftRecoveryBanner
    savedAt={draftEntry.savedAt}
    onResume={() => {
      setForm(draftEntry.data);
      setDraftEntry(null);
    }}
    onDiscard={() => {
      clearDraft();
      setDraftEntry(null);
    }}
  />
)}
```

- [ ] **Step 2: Add auto-save to quote form**

Same pattern in `src/components/quote/quote-mode.tsx`:

```typescript
import { useAutoSave, loadDraft } from "@/lib/use-auto-save";
import { DraftRecoveryBanner } from "@/components/ui/draft-recovery-banner";

const routeKey = existingId ? `/quotes/${existingId}/edit` : "/quotes/new";
const { clearDraft } = useAutoSave(form, routeKey);
const [draftEntry, setDraftEntry] = useState(() => loadDraft<typeof form>(routeKey));

// Clear on save success, render banner same as invoice
```

- [ ] **Step 3: Verify build**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/keyboard-mode.tsx src/components/quote/quote-mode.tsx
git commit -m "feat: wire draft auto-save into invoice and quote forms"
```

---

## Feature 3: Templates

### Task 8: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Template and TemplateItem models**

Add to `prisma/schema.prisma` after the existing models:

```prisma
model Template {
  id              String         @id @default(uuid())
  name            String
  type            DocumentType   @default(INVOICE)
  staffId         String?        @map("staff_id")
  department      String         @default("")
  category        String         @default("")
  accountCode     String         @default("") @map("account_code")
  marginEnabled   Boolean        @default(false) @map("margin_enabled")
  marginPercent   Decimal?       @map("margin_percent") @db.Decimal(5, 2)
  taxEnabled      Boolean        @default(false) @map("tax_enabled")
  notes           String         @default("")
  isCateringEvent Boolean        @default(false) @map("is_catering_event")
  cateringDetails Json?          @map("catering_details")
  createdBy       String         @map("created_by")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  creator         User           @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  staff           Staff?         @relation(fields: [staffId], references: [id], onDelete: SetNull)
  items           TemplateItem[]

  @@map("templates")
}

model TemplateItem {
  id             String   @id @default(uuid())
  templateId     String   @map("template_id")
  description    String
  quantity       Decimal  @db.Decimal(10, 2)
  unitPrice      Decimal  @map("unit_price") @db.Decimal(10, 2)
  sortOrder      Int      @default(0) @map("sort_order")
  isTaxable      Boolean  @default(true) @map("is_taxable")
  costPrice      Decimal? @map("cost_price") @db.Decimal(10, 2)
  marginOverride Decimal? @map("margin_override") @db.Decimal(5, 2)

  template       Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@map("template_items")
}
```

Also add `templates Template[]` to the `User` model and `templates Template[]` to the `Staff` model.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_templates
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Template and TemplateItem models"
```

### Task 9: Template domain (types, repository, service, api-client)

**Files:**
- Create: `src/domains/template/types.ts`
- Create: `src/domains/template/repository.ts`
- Create: `src/domains/template/service.ts`
- Create: `src/domains/template/api-client.ts`

- [ ] **Step 1: Create types**

```typescript
// src/domains/template/types.ts
export interface TemplateItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  costPrice: number | null;
  marginOverride: number | null;
}

export interface TemplateResponse {
  id: string;
  name: string;
  type: "INVOICE" | "QUOTE";
  staffId: string | null;
  department: string;
  category: string;
  accountCode: string;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  notes: string;
  isCateringEvent: boolean;
  cateringDetails: unknown;
  items: TemplateItemResponse[];
  createdAt: string;
}

export interface CreateTemplateInput {
  name: string;
  type: "INVOICE" | "QUOTE";
  staffId?: string;
  department?: string;
  category?: string;
  accountCode?: string;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  notes?: string;
  isCateringEvent?: boolean;
  cateringDetails?: unknown;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    sortOrder?: number;
    isTaxable?: boolean;
    costPrice?: number;
    marginOverride?: number;
  }[];
}
```

- [ ] **Step 2: Create repository**

```typescript
// src/domains/template/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const detailInclude = {
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

export async function findByUser(userId: string, type?: "INVOICE" | "QUOTE") {
  return prisma.template.findMany({
    where: { createdBy: userId, ...(type ? { type } : {}) },
    include: detailInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function findById(id: string, userId: string) {
  return prisma.template.findFirst({
    where: { id, createdBy: userId },
    include: detailInclude,
  });
}

export async function create(data: Prisma.TemplateCreateInput & { items: { create: Prisma.TemplateItemCreateWithoutTemplateInput[] } }) {
  return prisma.template.create({ data, include: detailInclude });
}

export async function deleteById(id: string, userId: string) {
  return prisma.template.deleteMany({ where: { id, createdBy: userId } });
}
```

- [ ] **Step 3: Create service**

```typescript
// src/domains/template/service.ts
import * as templateRepository from "./repository";
import type { TemplateResponse, CreateTemplateInput } from "./types";

function toResponse(template: NonNullable<Awaited<ReturnType<typeof templateRepository.findById>>>): TemplateResponse {
  return {
    id: template.id,
    name: template.name,
    type: template.type as "INVOICE" | "QUOTE",
    staffId: template.staffId,
    department: template.department,
    category: template.category,
    accountCode: template.accountCode,
    marginEnabled: template.marginEnabled,
    marginPercent: template.marginPercent != null ? Number(template.marginPercent) : null,
    taxEnabled: template.taxEnabled,
    notes: template.notes,
    isCateringEvent: template.isCateringEvent,
    cateringDetails: template.cateringDetails,
    items: template.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      sortOrder: item.sortOrder,
      isTaxable: item.isTaxable,
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
    })),
    createdAt: template.createdAt.toISOString(),
  };
}

export const templateService = {
  async list(userId: string, type?: "INVOICE" | "QUOTE"): Promise<TemplateResponse[]> {
    const templates = await templateRepository.findByUser(userId, type);
    return templates.map((t) => toResponse(t));
  },

  async getById(id: string, userId: string): Promise<TemplateResponse | null> {
    const template = await templateRepository.findById(id, userId);
    return template ? toResponse(template) : null;
  },

  async create(input: CreateTemplateInput, userId: string): Promise<TemplateResponse> {
    const template = await templateRepository.create({
      name: input.name,
      type: input.type,
      staffId: input.staffId ?? undefined,
      department: input.department ?? "",
      category: input.category ?? "",
      accountCode: input.accountCode ?? "",
      marginEnabled: input.marginEnabled ?? false,
      marginPercent: input.marginPercent ?? undefined,
      taxEnabled: input.taxEnabled ?? false,
      notes: input.notes ?? "",
      isCateringEvent: input.isCateringEvent ?? false,
      cateringDetails: input.cateringDetails as Prisma.InputJsonValue ?? undefined,
      creator: { connect: { id: userId } },
      items: {
        create: input.items.map((item, i) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sortOrder: item.sortOrder ?? i,
          isTaxable: item.isTaxable ?? true,
          costPrice: item.costPrice ?? undefined,
          marginOverride: item.marginOverride ?? undefined,
        })),
      },
    });
    return toResponse(template);
  },

  async delete(id: string, userId: string): Promise<void> {
    await templateRepository.deleteById(id, userId);
  },
};
```

Add `import type { Prisma } from "@/generated/prisma/client";` at the top of service.ts.

- [ ] **Step 4: Create api-client**

```typescript
// src/domains/template/api-client.ts
import type { TemplateResponse, CreateTemplateInput } from "./types";

export const templateApi = {
  async list(type?: "INVOICE" | "QUOTE"): Promise<TemplateResponse[]> {
    const params = type ? `?type=${type}` : "";
    const res = await fetch(`/api/templates${params}`);
    if (!res.ok) throw new Error("Failed to fetch templates");
    return res.json();
  },

  async create(input: CreateTemplateInput): Promise<TemplateResponse> {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Failed to create template");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete template");
  },
};
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/template/
git commit -m "feat: add template domain (types, repository, service, api-client)"
```

### Task 10: Template API routes

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[id]/route.ts`

- [ ] **Step 1: Create list + create route**

```typescript
// src/app/api/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { templateService } from "@/domains/template/service";

export const GET = withAuth(async (req: NextRequest, session) => {
  const type = req.nextUrl.searchParams.get("type") as "INVOICE" | "QUOTE" | null;
  const templates = await templateService.list(session.user.id, type ?? undefined);
  return NextResponse.json(templates);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json();
  const template = await templateService.create(body, session.user.id);
  return NextResponse.json(template, { status: 201 });
});
```

- [ ] **Step 2: Create delete route**

```typescript
// src/app/api/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { templateService } from "@/domains/template/service";

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  await templateService.delete(id, session.user.id);
  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/templates/route.ts" "src/app/api/templates/[id]/route.ts"
git commit -m "feat: add template API routes"
```

### Task 11: Save as Template button + New from Template dropdown

**Files:**
- Modify: `src/components/invoice/keyboard-mode.tsx`
- Modify: `src/components/quote/quote-mode.tsx`

- [ ] **Step 1: Add "Save as Template" to invoice form**

In `src/components/invoice/keyboard-mode.tsx`, add a button next to "Save Draft":

```typescript
import { templateApi } from "@/domains/template/api-client";

// Handler
async function handleSaveAsTemplate() {
  const name = prompt("Template name:");
  if (!name?.trim()) return;
  try {
    await templateApi.create({
      name: name.trim(),
      type: "INVOICE",
      staffId: form.staffId || undefined,
      department: form.department,
      category: form.category,
      accountCode: form.accountCode || undefined,
      marginEnabled: form.marginEnabled,
      marginPercent: form.marginPercent ? Number(form.marginPercent) : undefined,
      taxEnabled: form.taxEnabled,
      notes: form.notes || undefined,
      items: form.items.filter((i) => i.description.trim()).map((item, idx) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        sortOrder: idx,
        isTaxable: item.isTaxable,
      })),
    });
    toast.success(`Template "${name.trim()}" saved`);
  } catch {
    toast.error("Failed to save template");
  }
}

// Button (next to Save Draft)
<Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
  Save as Template
</Button>
```

- [ ] **Step 2: Add "New from Template" dropdown to invoice page**

In `src/app/invoices/new/page.tsx` (or the component that wraps keyboard-mode), add a template selector at the top that fetches templates and pre-fills the form on selection. Use a simple `<select>` or combobox.

- [ ] **Step 3: Repeat for quote form**

Same pattern in `src/components/quote/quote-mode.tsx` with `type: "QUOTE"`.

- [ ] **Step 4: Verify build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/invoice/keyboard-mode.tsx src/components/quote/quote-mode.tsx src/app/invoices/new/page.tsx src/app/quotes/new/page.tsx
git commit -m "feat: add Save as Template and New from Template UI"
```

---

## Feature 4: Smart Chatbot Memory

### Task 12: Add duplicate and template chat tools

**Files:**
- Modify: `src/domains/chat/tools.ts`
- Modify: `src/domains/chat/system-prompt.ts`

- [ ] **Step 1: Add duplicateInvoice tool**

In `src/domains/chat/tools.ts`, add:

```typescript
duplicateInvoice: tool({
  description: "Duplicate an existing invoice into a new draft. Copies all fields, items, margin, tax settings. Resets date to today.",
  inputSchema: z.object({
    id: z.string().optional().describe("Invoice ID"),
    invoiceNumber: z.string().optional().describe("Invoice number (e.g., '0045')"),
  }),
  execute: async ({ id, invoiceNumber }) => {
    let sourceId = id;
    if (!sourceId && invoiceNumber) {
      const results = await invoiceService.list({ search: invoiceNumber, pageSize: 1 });
      if (results.invoices.length === 0) return { error: `Invoice ${invoiceNumber} not found` };
      sourceId = results.invoices[0].id;
    }
    if (!sourceId) return { error: "Provide either id or invoiceNumber" };

    const existing = await invoiceService.getById(sourceId);
    if (!existing) return { error: "Invoice not found" };
    if (user.role !== "admin" && existing.creatorId !== user.id) {
      return { error: "You don't have permission to duplicate this invoice" };
    }

    const invoice = await invoiceService.duplicate(sourceId, user.id);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      message: `Duplicated as draft. [View Invoice](/invoices/${invoice.id})`,
    };
  },
}),
```

- [ ] **Step 2: Add duplicateQuote tool**

```typescript
duplicateQuote: tool({
  description: "Duplicate an existing quote into a new draft. Copies all fields, items, margin, tax, catering settings. Resets date and expiration.",
  inputSchema: z.object({
    id: z.string().optional().describe("Quote ID"),
    quoteNumber: z.string().optional().describe("Quote number (e.g., 'Q-2026-0019')"),
  }),
  execute: async ({ id, quoteNumber }) => {
    let sourceId = id;
    if (!sourceId && quoteNumber) {
      const results = await quoteService.list({ search: quoteNumber, pageSize: 1 });
      if (results.quotes.length === 0) return { error: `Quote ${quoteNumber} not found` };
      sourceId = results.quotes[0].id;
    }
    if (!sourceId) return { error: "Provide either id or quoteNumber" };

    const existing = await quoteService.getById(sourceId);
    if (!existing) return { error: "Quote not found" };
    if (user.role !== "admin" && existing.creatorId !== user.id) {
      return { error: "You don't have permission to duplicate this quote" };
    }

    const result = await quoteService.duplicate(sourceId, user.id);
    return {
      id: result.id,
      quoteNumber: result.quoteNumber,
      message: `Duplicated as draft. [View Quote](/quotes/${result.id})`,
    };
  },
}),
```

- [ ] **Step 3: Add listTemplates and createFromTemplate tools**

```typescript
listTemplates: tool({
  description: "List the user's saved invoice/quote templates.",
  inputSchema: z.object({
    type: z.enum(["INVOICE", "QUOTE"]).optional().describe("Filter by template type"),
  }),
  execute: async ({ type }) => {
    const { templateService } = await import("@/domains/template/service");
    const templates = await templateService.list(user.id, type);
    if (templates.length === 0) return { message: "No templates found." };
    return {
      templates: templates.map((t) => ({ id: t.id, name: t.name, type: t.type, category: t.category, itemCount: t.items.length })),
      message: `Found ${templates.length} template(s).`,
    };
  },
}),

createFromTemplate: tool({
  description: "Create a new invoice or quote from a saved template. Optionally override staff, items, or other fields.",
  inputSchema: z.object({
    templateId: z.string().optional().describe("Template ID"),
    templateName: z.string().optional().describe("Template name (searched if no ID)"),
    staffId: z.string().optional().describe("Override staff member"),
    date: z.string().optional().describe("Override date (YYYY-MM-DD)"),
  }),
  execute: async ({ templateId, templateName, staffId, date }) => {
    const { templateService } = await import("@/domains/template/service");
    let template;
    if (templateId) {
      template = await templateService.getById(templateId, user.id);
    } else if (templateName) {
      const all = await templateService.list(user.id);
      template = all.find((t) => t.name.toLowerCase().includes(templateName.toLowerCase()));
    }
    if (!template) return { error: "Template not found" };

    const items = template.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      isTaxable: item.isTaxable,
    }));

    if (template.type === "INVOICE") {
      const invoice = await invoiceService.create({
        date: date ?? new Date().toISOString().split("T")[0],
        staffId: staffId ?? template.staffId ?? undefined,
        department: template.department,
        category: template.category,
        accountCode: template.accountCode || undefined,
        marginEnabled: template.marginEnabled,
        marginPercent: template.marginPercent ?? undefined,
        taxEnabled: template.taxEnabled,
        notes: template.notes || undefined,
        items,
      }, user.id);
      return { id: invoice.id, message: `Created from template "${template.name}". [View Invoice](/invoices/${invoice.id})` };
    } else {
      const quote = await quoteService.create({
        date: date ?? new Date().toISOString().split("T")[0],
        staffId: staffId ?? template.staffId ?? undefined,
        department: template.department,
        category: template.category,
        accountCode: template.accountCode || undefined,
        marginEnabled: template.marginEnabled,
        marginPercent: template.marginPercent ?? undefined,
        taxEnabled: template.taxEnabled,
        notes: template.notes || undefined,
        recipientName: "",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        items,
      }, user.id);
      return { id: quote.id, message: `Created from template "${template.name}". [View Quote](/quotes/${quote.id})` };
    }
  },
}),
```

- [ ] **Step 4: Update system prompt**

In `src/domains/chat/system-prompt.ts`, add:

```
## Duplicating & Templates
- To duplicate: use duplicateInvoice or duplicateQuote with the ID or number
- "Same as last time for [staff]" → search recent invoices/quotes, then duplicate
- "Use template [name]" → use createFromTemplate
- "Show my templates" → use listTemplates
```

- [ ] **Step 5: Verify build**

```bash
npm run lint && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/chat/tools.ts src/domains/chat/system-prompt.ts
git commit -m "feat: add duplicate and template chat tools"
```

---

## Verification

1. Open invoice detail → click Duplicate → verify new draft with all fields, date = today
2. Open quote detail → click Duplicate → verify new draft, expiration = 30 days
3. Create invoice → click Save as Template → name it → verify in API (`/api/templates?type=INVOICE`)
4. New Invoice → select template → verify form pre-fills
5. Start filling form → navigate away → come back → see recovery banner → Resume → verify form restores
6. Ask chatbot "duplicate invoice [number]" → verify new draft with link
7. Ask chatbot "show my templates" → verify list
8. Ask chatbot "use template [name] for [staff]" → verify creation
9. `npm run lint && npm run build`
