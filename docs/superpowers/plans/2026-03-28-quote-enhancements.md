# Quote System Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add catering event management, calendar system, margin markup, and per-item sales tax to the quote/invoice system.

**Architecture:** Three phases building on a shared database migration. Phase 1 (margin + tax) adds financial controls to both quote and invoice forms via shared hooks. Phase 2 (catering) adds event details to quote creation with auto-population to a printable catering guide. Phase 3 (calendar) adds a FullCalendar page and dashboard widget fed by catering event data from quotes.

**Tech Stack:** Next.js 14, Prisma 7, FullCalendar React, Tailwind CSS 4, shadcn/ui v4

**Spec:** `docs/superpowers/specs/2026-03-28-quote-enhancements-design.md`

---

## Phase 1: Schema Migration + Margin + Tax

### Task 1: Database Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/domains/invoice/constants.ts`

- [ ] **Step 1: Add new fields to Invoice model in schema.prisma**

Add after line 93 (`convertedAt` field), before `createdAt`:

```prisma
  isCateringEvent      Boolean         @default(false) @map("is_catering_event")
  cateringDetails      Json?           @map("catering_details")
  marginEnabled        Boolean         @default(false) @map("margin_enabled")
  marginPercent        Decimal?        @map("margin_percent") @db.Decimal(5, 2)
  taxEnabled           Boolean         @default(false) @map("tax_enabled")
  taxRate              Decimal         @default(0.0975) @map("tax_rate") @db.Decimal(5, 4)
```

- [ ] **Step 2: Add new fields to InvoiceItem model in schema.prisma**

Add after line 117 (`sku` field), before `createdAt`:

```prisma
  isTaxable       Boolean  @default(true) @map("is_taxable")
  marginOverride  Decimal? @map("margin_override") @db.Decimal(5, 2)
  costPrice       Decimal? @map("cost_price") @db.Decimal(10, 2)
```

- [ ] **Step 3: Update TAX_RATE constant**

In `src/domains/invoice/constants.ts`, change:

```typescript
export const TAX_RATE = 0.0975;
```

- [ ] **Step 4: Generate and run migration**

Run:
```bash
npx prisma migrate dev --name add-catering-margin-tax-fields
```

Expected: Migration creates new columns with defaults. No data loss.

- [ ] **Step 5: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/domains/invoice/constants.ts
git commit -m "feat: add catering, margin, and tax fields to schema"
```

---

### Task 2: Update Domain Types

**Files:**
- Modify: `src/domains/quote/types.ts`
- Modify: `src/domains/invoice/types.ts` (if it exists, otherwise quote types cover it)

- [ ] **Step 1: Add CateringDetails interface and update quote types**

Add to `src/domains/quote/types.ts`:

```typescript
// ── Catering ──────────────────────────────────────────────────────────────

export interface CateringDetails {
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  headcount?: number;
  eventName?: string;
  setupRequired: boolean;
  setupTime?: string;
  setupInstructions?: string;
  takedownRequired: boolean;
  takedownTime?: string;
  takedownInstructions?: string;
  specialInstructions?: string;
}
```

- [ ] **Step 2: Update QuoteResponse to include new fields**

Add to `QuoteResponse` interface:

```typescript
  isCateringEvent: boolean;
  cateringDetails: CateringDetails | null;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
```

- [ ] **Step 3: Update QuoteItemResponse to include new fields**

Add to `QuoteItemResponse` interface:

```typescript
  isTaxable: boolean;
  marginOverride: number | null;
  costPrice: number | null;
```

- [ ] **Step 4: Update CreateQuoteInput**

Add to `CreateQuoteInput` interface:

```typescript
  isCateringEvent?: boolean;
  cateringDetails?: CateringDetails;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  items: (CreateLineItemInput & {
    isTaxable?: boolean;
    marginOverride?: number;
    costPrice?: number;
  })[];
```

- [ ] **Step 5: Update UpdateQuoteInput similarly**

Add the same optional fields to `UpdateQuoteInput`.

- [ ] **Step 6: Commit**

```bash
git add src/domains/quote/types.ts
git commit -m "feat: add catering, margin, and tax types"
```

---

### Task 3: Update Quote Repository and Service

**Files:**
- Modify: `src/domains/quote/repository.ts`
- Modify: `src/domains/quote/service.ts`

- [ ] **Step 1: Update repository create/update to pass new fields**

In `src/domains/quote/repository.ts`, update the `create` function's `data` object to include:

```typescript
isCateringEvent: input.isCateringEvent ?? false,
cateringDetails: input.cateringDetails ?? undefined,
marginEnabled: input.marginEnabled ?? false,
marginPercent: input.marginPercent ?? undefined,
taxEnabled: input.taxEnabled ?? false,
```

And in the `items.create` mapping, add:

```typescript
isTaxable: item.isTaxable ?? true,
marginOverride: item.marginOverride ?? undefined,
costPrice: item.costPrice ?? undefined,
```

Apply the same changes to the `update` function.

- [ ] **Step 2: Update service toResponse mapping**

In `src/domains/quote/service.ts`, update the response mapping to include:

```typescript
isCateringEvent: quote.isCateringEvent,
cateringDetails: quote.cateringDetails as CateringDetails | null,
marginEnabled: quote.marginEnabled,
marginPercent: quote.marginPercent ? Number(quote.marginPercent) : null,
taxEnabled: quote.taxEnabled,
taxRate: Number(quote.taxRate),
```

And for items:

```typescript
isTaxable: item.isTaxable,
marginOverride: item.marginOverride ? Number(item.marginOverride) : null,
costPrice: item.costPrice ? Number(item.costPrice) : null,
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/quote/repository.ts src/domains/quote/service.ts
git commit -m "feat: handle catering, margin, and tax in quote repository and service"
```

---

### Task 4: Shared Margin Calculation Hook

**Files:**
- Create: `src/components/invoice/hooks/use-margin-calculation.ts`

- [ ] **Step 1: Create the margin calculation hook**

```typescript
"use client";

import { useCallback } from "react";

interface MarginItem {
  unitPrice: number;
  costPrice?: number | null;
  marginOverride?: number | null;
}

interface MarginResult {
  costPrice: number;
  chargedPrice: number;
  marginPercent: number;
}

export function useMarginCalculation(globalMarginPercent: number) {
  const calculateMargin = useCallback(
    (item: MarginItem): MarginResult => {
      const effectiveMargin = item.marginOverride ?? globalMarginPercent;
      const cost = item.costPrice ?? item.unitPrice;
      const charged = Math.round(cost * (1 + effectiveMargin / 100) * 100) / 100;
      return {
        costPrice: cost,
        chargedPrice: charged,
        marginPercent: effectiveMargin,
      };
    },
    [globalMarginPercent]
  );

  return { calculateMargin };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/invoice/hooks/use-margin-calculation.ts
git commit -m "feat: add shared margin calculation hook"
```

---

### Task 5: Rewrite Tax Calculation Hook

**Files:**
- Modify: `src/components/invoice/hooks/use-tax-calculation.ts`

- [ ] **Step 1: Rewrite use-tax-calculation.ts with per-item taxable flag**

Replace the entire file:

```typescript
"use client";

import { useMemo } from "react";

interface TaxableItem {
  extendedPrice: number;
  isTaxable: boolean;
}

interface TaxResult {
  subtotal: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export function useTaxCalculation(
  items: TaxableItem[],
  taxEnabled: boolean,
  taxRate: number
): TaxResult {
  return useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.extendedPrice),
      0
    );

    if (!taxEnabled) {
      return { subtotal, taxableAmount: 0, taxAmount: 0, total: subtotal };
    }

    const taxableAmount = items
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);

    const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;

    return {
      subtotal,
      taxableAmount,
      taxAmount,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }, [items, taxEnabled, taxRate]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/invoice/hooks/use-tax-calculation.ts
git commit -m "feat: rewrite tax calculation with per-item taxable flag"
```

---

### Task 6: Update Quote Form State

**Files:**
- Modify: `src/components/quote/quote-form.ts`

- [ ] **Step 1: Update QuoteItem interface**

Add to `QuoteItem`:

```typescript
  isTaxable: boolean;
  marginOverride: number | null;
  costPrice: number | null;
```

- [ ] **Step 2: Update QuoteFormData interface**

Add to `QuoteFormData`:

```typescript
  // Margin & Tax
  marginEnabled: boolean;
  marginPercent: number;
  taxEnabled: boolean;
  // Catering
  isCateringEvent: boolean;
  cateringDetails: CateringDetails;
```

Import `CateringDetails` from `@/domains/quote/types`.

- [ ] **Step 3: Update emptyItem helper**

```typescript
function emptyItem(sortOrder = 0): QuoteItem {
  return {
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder,
    isTaxable: true,
    marginOverride: null,
    costPrice: null,
  };
}
```

- [ ] **Step 4: Update defaultForm helper**

Add to `defaultForm()` return:

```typescript
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    isCateringEvent: false,
    cateringDetails: {
      eventDate: todayISO(),
      startTime: "",
      endTime: "",
      location: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      headcount: undefined,
      eventName: "",
      setupRequired: false,
      setupTime: "",
      setupInstructions: "",
      takedownRequired: false,
      takedownTime: "",
      takedownInstructions: "",
      specialInstructions: "",
    },
```

- [ ] **Step 5: Update buildPayload to include new fields**

Add to `buildPayload()`:

```typescript
      marginEnabled: form.marginEnabled,
      marginPercent: form.marginEnabled ? form.marginPercent : undefined,
      taxEnabled: form.taxEnabled,
      isCateringEvent: form.isCateringEvent,
      cateringDetails: form.isCateringEvent ? form.cateringDetails : undefined,
```

And in the items mapping, add:

```typescript
        isTaxable: item.isTaxable,
        marginOverride: item.marginOverride ?? undefined,
        costPrice: item.costPrice ?? undefined,
```

- [ ] **Step 6: Update handleStaffSelect to auto-populate catering contact**

In `handleStaffSelect`, add after the existing `setForm`:

```typescript
      // Auto-populate catering contact from staff
      cateringDetails: {
        ...prev.cateringDetails,
        contactName: prev.cateringDetails.contactName || staff.name,
        contactPhone: prev.cateringDetails.contactPhone || staff.extension,
        contactEmail: prev.cateringDetails.contactEmail || staff.email,
      },
```

- [ ] **Step 7: Add margin-aware total calculation**

Replace the simple `total` useMemo with one that accounts for margin:

```typescript
  const itemsWithMargin = useMemo(() => {
    if (!form.marginEnabled || form.marginPercent <= 0) return form.items;
    return form.items.map((item) => {
      const effectiveMargin = item.marginOverride ?? form.marginPercent;
      const cost = item.costPrice ?? item.unitPrice;
      const charged = Math.round(cost * (1 + effectiveMargin / 100) * 100) / 100;
      return { ...item, extendedPrice: charged * item.quantity };
    });
  }, [form.items, form.marginEnabled, form.marginPercent]);
```

- [ ] **Step 8: Commit**

```bash
git add src/components/quote/quote-form.ts
git commit -m "feat: add margin, tax, and catering state to quote form"
```

---

### Task 7: Add Margin + Tax Controls to Quote Mode UI

**Files:**
- Modify: `src/components/quote/quote-mode.tsx`

- [ ] **Step 1: Add margin and tax control row above line items**

Add a new section before the `LineItems` component. This includes:
- "Apply Margin" checkbox + percentage input
- "Apply Sales Tax" checkbox with rate display (9.75%)
- "CA Tax Rules" info popover

The controls bind to `form.marginEnabled`, `form.marginPercent`, `form.taxEnabled` via `updateField`.

- [ ] **Step 2: Update LineItems rendering to show margin columns**

When `form.marginEnabled` is true:
- Show "Unit Price" column with strikethrough (cost price)
- Show "Charged" column in purple (marked-up price)
- Per-item margin override on click

When `form.taxEnabled` is true:
- Show "Tax" checkbox column per line item

- [ ] **Step 3: Update totals display**

Replace the simple total with the breakdown:
- Subtotal
- Margin indicator (when enabled)
- Tax line (when enabled, showing amount on taxable items only)
- Total

- [ ] **Step 4: Commit**

```bash
git add src/components/quote/quote-mode.tsx
git commit -m "feat: add margin and tax controls to quote form UI"
```

---

### Task 8: Apply Same Margin + Tax to Invoice Form

**Files:**
- Modify: `src/components/invoice/invoice-form.tsx`
- Modify: `src/components/invoice/hooks/use-invoice-form-state.ts`

- [ ] **Step 1: Add margin and tax fields to invoice form state**

Add `marginEnabled`, `marginPercent`, `taxEnabled`, `isTaxable`, `marginOverride`, `costPrice` fields to the invoice form state, mirroring the quote form changes from Task 6.

- [ ] **Step 2: Add margin + tax controls to invoice form UI**

Same control row as quote mode: margin checkbox + percentage, tax toggle, CA Tax Rules info. Same line item column changes.

- [ ] **Step 3: Replace old tax calculation usage**

Remove the old `useTaxCalculation` hook usage that searches for "Tax" in description. Replace with the new hook from Task 5 that uses per-item `isTaxable` flags.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/invoice-form.tsx src/components/invoice/hooks/use-invoice-form-state.ts
git commit -m "feat: add margin and tax controls to invoice form"
```

---

## Phase 2: Catering Events

### Task 9: Catering Details Card Component

**Files:**
- Create: `src/components/quote/catering-details-card.tsx`

- [ ] **Step 1: Create the catering details card component**

A card that appears when `isCateringEvent` is checked. Props:

```typescript
interface CateringDetailsCardProps {
  details: CateringDetails;
  onChange: (details: CateringDetails) => void;
}
```

Fields: event date, start/end time, location, contact name/phone/email, headcount, event name, setup required (checkbox → time + instructions), takedown required (checkbox → time + instructions), special instructions.

Uses the orange accent color scheme from the mockup. All fields are text inputs with proper labels.

- [ ] **Step 2: Commit**

```bash
git add src/components/quote/catering-details-card.tsx
git commit -m "feat: add catering details card component"
```

---

### Task 10: Integrate Catering Card into Quote Mode

**Files:**
- Modify: `src/components/quote/quote-mode.tsx`

- [ ] **Step 1: Add catering checkbox and card to quote mode**

Add between quote details section and line items:
- "This is a catering event" checkbox bound to `form.isCateringEvent`
- When checked, render `<CateringDetailsCard>` with `form.cateringDetails` and an `onChange` that calls `updateField("cateringDetails", ...)`

- [ ] **Step 2: Auto-populate catering contact from recipient info**

When the catering checkbox is toggled on, populate catering contact fields from recipient info if they're empty:

```typescript
if (!form.cateringDetails.contactName && form.recipientName) {
  updateField("cateringDetails", {
    ...form.cateringDetails,
    contactName: form.recipientName,
    contactEmail: form.recipientEmail,
    eventDate: form.date,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/quote/quote-mode.tsx
git commit -m "feat: integrate catering details card into quote form"
```

---

### Task 11: Update Public Quote Review Page

**Files:**
- Modify: `src/components/quotes/public-quote-view.tsx`
- Modify: `src/app/api/quotes/public/[token]/respond/route.ts`

- [ ] **Step 1: Add catering fields to public quote view**

When the quote has `isCateringEvent === true`, render required event detail fields before the approve/decline buttons:
- Contact name (required)
- Contact number (required)
- Event location (required)
- Expected headcount (optional)
- Setup needed checkbox → time field (optional)
- Takedown needed checkbox → time field (optional)
- "Anything else we should know?" textarea (optional)

Approve button is disabled until required fields are filled.

- [ ] **Step 2: Update respond API to accept catering details**

In `src/app/api/quotes/public/[token]/respond/route.ts`, accept `cateringDetails` in the request body alongside the existing `response` and `viewId` fields. Save to the quote's `cateringDetails` JSON field, overriding any staff-entered values.

- [ ] **Step 3: Commit**

```bash
git add src/components/quotes/public-quote-view.tsx src/app/api/quotes/public/[token]/respond/route.ts
git commit -m "feat: add catering detail fields to public quote review page"
```

---

### Task 12: Catering Guide on Quote Detail Page + Print CSS

**Files:**
- Modify: `src/components/quotes/quote-detail.tsx`
- Modify: `src/app/globals.css` (add print styles)

- [ ] **Step 1: Add catering guide section to quote detail page**

When `quote.isCateringEvent && quote.cateringDetails`, render a "Catering Guide" card below the existing quote info:
- Event name, date, time range
- Location
- Contact name, phone, email
- Headcount
- Setup details (time + instructions) if setup required
- Takedown details (time + instructions) if takedown required
- Special instructions
- Line items with totals (already shown above)

Add a "Print Catering Guide" button that calls `window.print()`.

- [ ] **Step 2: Add print CSS to globals.css**

```css
@media print {
  /* Hide non-essential UI */
  nav, .notification-bell, .sidebar, [data-print-hide] {
    display: none !important;
  }

  /* Clean single-column layout */
  body {
    background: white !important;
    color: black !important;
  }

  .catering-guide {
    break-inside: avoid;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/quotes/quote-detail.tsx src/app/globals.css
git commit -m "feat: add catering guide section with print styling"
```

---

## Phase 3: Calendar System

### Task 13: Calendar Events API

**Files:**
- Create: `src/app/api/calendar/events/route.ts`
- Create: `src/domains/calendar/api-client.ts`

- [ ] **Step 1: Create calendar events API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const quotes = await prisma.invoice.findMany({
    where: {
      type: "QUOTE",
      isCateringEvent: true,
      quoteStatus: { in: ["SENT", "ACCEPTED"] },
      cateringDetails: { not: null },
    },
    select: {
      id: true,
      quoteNumber: true,
      quoteStatus: true,
      recipientName: true,
      cateringDetails: true,
    },
  });

  const events = quotes
    .map((q) => {
      const details = q.cateringDetails as Record<string, unknown> | null;
      if (!details?.eventDate) return null;

      const eventDate = details.eventDate as string;
      if (eventDate < start || eventDate > end) return null;

      const startTime = details.startTime as string || "09:00";
      const endTime = details.endTime as string || "10:00";

      return {
        id: q.id,
        title: (details.eventName as string) || q.recipientName || q.quoteNumber || "Catering Event",
        start: `${eventDate}T${startTime}:00`,
        end: `${eventDate}T${endTime}:00`,
        location: details.location as string || "",
        headcount: details.headcount as number || null,
        quoteId: q.id,
        quoteNumber: q.quoteNumber,
        quoteStatus: q.quoteStatus,
        setupTime: details.setupTime as string || null,
        takedownTime: details.takedownTime as string || null,
      };
    })
    .filter(Boolean);

  return NextResponse.json(events);
});
```

- [ ] **Step 2: Create calendar API client**

```typescript
import { ApiError } from "@/domains/shared/types";

const BASE = "/api/calendar";

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  headcount: number | null;
  quoteId: string;
  quoteNumber: string | null;
  quoteStatus: string;
  setupTime: string | null;
  takedownTime: string | null;
}

export const calendarApi = {
  async getEvents(start: string, end: string): Promise<CalendarEvent[]> {
    return request<CalendarEvent[]>(`${BASE}/events?start=${start}&end=${end}`);
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/events/route.ts src/domains/calendar/api-client.ts
git commit -m "feat: add calendar events API endpoint and client"
```

---

### Task 14: Full Calendar Page

**Files:**
- Create: `src/app/calendar/page.tsx`

- [ ] **Step 1: Install FullCalendar packages**

Run:
```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

- [ ] **Step 2: Create calendar page**

A client component that renders FullCalendar with:
- Month, Week (default), Day views
- Event source fetching from `/api/calendar/events` with date range params
- Orange-themed events
- Click handler navigating to `/quotes/[quoteId]`
- Event content showing time, title, location, headcount

```typescript
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { calendarApi } from "@/domains/calendar/api-client";

export default function CalendarPage() {
  const router = useRouter();

  const fetchEvents = useCallback(
    async (
      fetchInfo: { startStr: string; endStr: string },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void
    ) => {
      try {
        const events = await calendarApi.getEvents(
          fetchInfo.startStr.split("T")[0],
          fetchInfo.endStr.split("T")[0]
        );
        successCallback(
          events.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            backgroundColor: "rgba(249, 115, 22, 0.15)",
            borderColor: "rgb(249, 115, 22)",
            textColor: "rgb(249, 115, 22)",
            extendedProps: {
              location: e.location,
              headcount: e.headcount,
              quoteId: e.quoteId,
              setupTime: e.setupTime,
              takedownTime: e.takedownTime,
            },
          }))
        );
      } catch (err) {
        failureCallback(err instanceof Error ? err : new Error("Failed to fetch events"));
      }
    },
    []
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const quoteId = info.event.extendedProps.quoteId;
      if (quoteId) router.push(`/quotes/${quoteId}`);
    },
    [router]
  );

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Calendar</h1>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={fetchEvents}
        eventClick={handleEventClick}
        height="auto"
        weekends={false}
        slotMinTime="07:00:00"
        slotMaxTime="19:00:00"
      />
    </div>
  );
}
```

- [ ] **Step 3: Add Calendar to nav**

In `src/components/nav.tsx`, add to the `links` array after "Quotes":

```typescript
{ href: "/calendar", label: "Calendar" },
```

- [ ] **Step 4: Commit**

```bash
git add src/app/calendar/page.tsx src/components/nav.tsx package.json package-lock.json
git commit -m "feat: add full calendar page with FullCalendar"
```

---

### Task 15: Dashboard "Today's Events" Widget

**Files:**
- Create: `src/components/dashboard/todays-events.tsx`
- Modify: `src/components/dashboard/draggable-dashboard.tsx`

- [ ] **Step 1: Create Today's Events widget**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { calendarApi, type CalendarEvent } from "@/domains/calendar/api-client";

export function TodaysEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    calendarApi
      .getEvents(today, today)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="card-hover">
        <CardContent className="py-3 px-4">
          <div className="skeleton h-3 w-28 mb-3" />
          <div className="skeleton h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Today&apos;s Events
            </span>
            {events.length > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-orange-500 rounded-full">
                {events.length}
              </span>
            )}
          </div>
          <Link
            href="/calendar"
            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Calendar →
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No events today
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/quotes/${event.quoteId}`}
                className="block border border-orange-500/20 rounded-lg p-2.5 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">🍽 {event.title}</span>
                  <span className="text-xs font-semibold text-orange-500">
                    {new Date(event.start).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {event.location && <span>📍 {event.location}</span>}
                  {event.headcount && <span>👥 {event.headcount}</span>}
                </div>
                {(event.setupTime || event.takedownTime) && (
                  <div className="flex gap-1.5 mt-1.5">
                    {event.setupTime && (
                      <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                        Setup {event.setupTime}
                      </span>
                    )}
                    {event.takedownTime && (
                      <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">
                        Takedown {event.takedownTime}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add to DraggableDashboard**

In `src/components/dashboard/draggable-dashboard.tsx`:

Add import:
```typescript
import { TodaysEvents } from "./todays-events";
```

Add to `SORTABLE_WIDGETS` array:
```typescript
{ id: "todays-events", label: "Today's Events", component: () => <TodaysEvents /> },
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/todays-events.tsx src/components/dashboard/draggable-dashboard.tsx
git commit -m "feat: add Today's Events dashboard widget"
```

---

### Task 16: Update Quote PDF Template

**Files:**
- Modify: `src/lib/pdf/templates/quote.ts`

- [ ] **Step 1: Update quote PDF to show margin and tax**

When `marginEnabled`, show the charged price (not cost price) in the PDF line items — the customer never sees the original cost.

When `taxEnabled`, add a tax line after subtotal:
```
Subtotal:                    $331.70
CA Sales Tax (9.75%):        $ 30.56
Total:                       $362.26
```

When `isCateringEvent`, add catering details section to the PDF with event info, contact, location, setup/takedown.

- [ ] **Step 2: Commit**

```bash
git add src/lib/pdf/templates/quote.ts
git commit -m "feat: add margin, tax, and catering to quote PDF template"
```

---

### Task 17: Remove Tax Quick Pick + Final Cleanup

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Remove the "CA State Tax" quick pick from seed**

In `prisma/seed.ts`, remove from the `defaultQuickPicks` array:
```typescript
{ id: "default-ca-state-tax", department: "__ALL__", description: "CA State Tax (9.5%)", defaultPrice: 0 },
```

- [ ] **Step 2: Add a migration script to remove the quick pick from existing data**

Run via the API or a one-off script:
```sql
DELETE FROM quick_pick_items WHERE id = 'default-ca-state-tax';
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: remove CA State Tax quick pick, replaced by proper tax system"
```

---

### Task 18: Push and Create PR

- [ ] **Step 1: Push branch and create PR**

```bash
git push -u origin feature/quote-enhancements
gh pr create --title "feat: quote enhancements — catering, calendar, margin, tax" --body "..."
gh pr merge <number> --auto --squash
```

Include PR link in response.
