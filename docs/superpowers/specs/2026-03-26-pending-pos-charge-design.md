# Pending POS Charge Workflow — Design Spec

## Overview

Add a "Charge at Register" save option to the invoice creation flow. Users can save a nearly-complete invoice as "Pending POS Charge" when they haven't yet charged at the POS system. They come back later to enter the AG-XXXXXX invoice number, adjust line items if needed, upload the PrismCore PDF, and finalize.

## Problem

Users often create invoices but can't finalize them immediately because they haven't walked to the POS to make the formal charge. Today they either lose their work or save an incomplete draft with no clear indication that it's waiting on POS action. There's no accountability mechanism showing who has outstanding charges.

## Invoice Status

Add `PENDING_CHARGE` to the existing `InvoiceStatus` enum:

```
DRAFT | FINAL | PENDING_CHARGE
```

An invoice with `status: PENDING_CHARGE` means: all data is filled in except the formal AG invoice number and the PrismCore PDF. It is ready to be charged at the register.

## Save Flow

During invoice creation (KeyboardMode / QuickMode), a new button appears alongside "Save Draft" and "Generate PDF":

**"Save — Charge at Register"**

When clicked:
1. Invoice is validated the same as a draft save, except `invoiceNumber` is not required.
2. `invoiceNumber` is set to the placeholder `"NEEDPOSCHARGE"`.
3. `status` is set to `PENDING_CHARGE`.
4. Invoice is saved via `POST /api/invoices` (same endpoint, the schema already allows empty invoice numbers).
5. User is redirected to the invoice detail page showing the pending status.

## Completion Flow

When a user opens a `PENDING_CHARGE` invoice for editing:

1. The full edit form loads (same KeyboardMode form as any draft edit).
2. A **banner** appears at the top: "This invoice needs a POS charge. Enter the AG number and upload the PrismCore PDF to finalize."
3. The **invoice number field** has a highlighted visual treatment (colored border, subtle background) to draw attention — it currently shows "NEEDPOSCHARGE" which the user replaces with the real AG-XXXXXX.
4. The **PrismCore upload section** also has the highlighted treatment.
5. User enters the AG number, optionally adjusts line items, uploads PrismCore PDF.
6. User clicks "Generate PDF" to finalize — same finalization flow as today.
7. Status changes from `PENDING_CHARGE` to `FINAL`.

### Edit Form Highlighting

Fields that need input on a `PENDING_CHARGE` invoice get visual treatment:
- **Left border accent** (primary color) on the field container.
- **Subtle background tint** (primary at 5% opacity).
- The invoice number input auto-focuses on page load.
- The banner at the top is styled as an info/warning card (not dismissible).

## Visibility — Three Surfaces

### 1. Invoice List Filter

The existing status filter dropdown on `/invoices` gains a new option:
- All | Draft | Final | **Pending Charge**

When filtered to "Pending Charge", the list shows all `PENDING_CHARGE` invoices across all users. Each row shows the creator name, so anyone can see who has outstanding charges. This encourages accountability and competition.

### 2. Dashboard Card

A new card on the dashboard page, positioned between the stats cards and the recent invoices section:

**"Pending POS Charges"**
- Shows total count of `PENDING_CHARGE` invoices across all users.
- Lists each pending invoice as a quick link: creator name, department, date, total amount.
- Clicking a link navigates to `/invoices/{id}/edit`.
- If there are no pending charges, the card does not appear.
- Sorted by oldest first (longest-waiting charges surface to the top).

### 3. URL Filter Preset

The dedicated "pending section" is implemented as a filter preset rather than a separate page:
- `/invoices?status=PENDING_CHARGE` shows only pending charges.
- The dashboard card's "View all" link points here.
- This keeps things DRY — no new page needed.

## API Changes

### Status Enum

Add `PENDING_CHARGE` to the Prisma `InvoiceStatus` enum:

```prisma
enum InvoiceStatus {
  DRAFT
  FINAL
  PENDING_CHARGE
}
```

### POST /api/invoices

No changes needed — the endpoint already accepts invoices with empty invoice numbers (changed during Quote feature). The `status` field needs to accept `PENDING_CHARGE` as a valid value.

### PUT /api/invoices/[id]

Currently blocks updates when `status === "FINAL"`. Add: also allow updates when `status === "PENDING_CHARGE"` (same as DRAFT — fully editable).

### GET /api/invoices

The existing `status` query parameter already filters by status. Adding `PENDING_CHARGE` to the enum means `?status=PENDING_CHARGE` works automatically.

### Dashboard Stats Endpoint

Add a query for pending charge count to the dashboard stats, or expose it via the existing `/api/invoices?status=PENDING_CHARGE&pageSize=1` count.

## UI Components

### Modified Components

**`keyboard-mode.tsx`** — Add "Save — Charge at Register" button next to existing save buttons. When clicked, sets `invoiceNumber` to `"NEEDPOSCHARGE"` and saves with `status: PENDING_CHARGE`.

**`invoice-detail.tsx`** — Show `PENDING_CHARGE` status badge (amber/warning color). Show "Edit" and "Delete" buttons (same as DRAFT). Add prominent "Complete POS Charge" action button that links to the edit page.

**`invoice-table.tsx`** — Handle `PENDING_CHARGE` status badge rendering (amber variant).

**`invoice-filters.tsx`** — Add "Pending Charge" to the status dropdown options.

**Edit page (`invoices/[id]/edit/page.tsx`)** — When loading a `PENDING_CHARGE` invoice, pass a flag to KeyboardMode indicating pending charge state. KeyboardMode renders the info banner and highlights the invoice number + PrismCore upload fields.

### New Components

**`dashboard/pending-charges.tsx`** — Dashboard card showing pending POS charges. Fetches from `/api/invoices?status=PENDING_CHARGE&pageSize=20&sortBy=createdAt&sortDir=asc`. Renders as a Card with a list of quick links. Hidden when count is 0.

## Validation

- When saving as "Charge at Register", the invoice number field is ignored (auto-set to `"NEEDPOSCHARGE"`).
- When finalizing a `PENDING_CHARGE` invoice, the invoice number must be non-empty and not equal to `"NEEDPOSCHARGE"`.
- PrismCore PDF is optional for finalization (same as today) but highlighted as needed.

## Out of Scope

- Email notifications when invoices are pending too long.
- Auto-reminders or escalation for stale pending charges.
- Per-user pending charge limits.
- Any changes to the Quote workflow (Quotes have their own lifecycle).
