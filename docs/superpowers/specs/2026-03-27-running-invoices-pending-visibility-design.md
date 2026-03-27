# Running Invoices, Pending Charge Visibility & Team Activity Update

**Date:** 2026-03-27
**Goal:** Add titled running invoices for long-lived accumulating charges, make pending POS charges visible to all users collapsed by creator, and include pending amounts in team activity totals.

## Feature 1: Running Invoices

### Data Model

Add to the Invoice model in `prisma/schema.prisma`:

```prisma
isRunning    Boolean   @default(false) @map("is_running")
runningTitle String?   @map("running_title")
```

### Creation Flow

In the keyboard-mode invoice form, add a "Running Invoice" toggle (switch or checkbox) near the top of the form (after the staff/department section). When enabled:
- A "Title" text input appears (required when running is enabled)
- The invoice is saved as DRAFT with `isRunning: true` and `runningTitle` set
- The form otherwise works identically

### Dashboard Card: "Running Invoices"

New card on the dashboard, placed between Pending Charges and Recent Invoices.

- Header: "Running Invoices" with count badge
- Each row: running title (bold), staff name + department (subtitle), item count + current total (right-aligned)
- "Add Items" link on each row → navigates to `/invoices/[id]/edit`
- Empty state: hidden (return null if no running invoices)
- Fetches from: `GET /api/invoices?status=DRAFT&isRunning=true&pageSize=50`

### API Change

Add `isRunning` filter to the invoices API GET handler. When `isRunning=true` query param is present, add `where.isRunning = true` to the Prisma query.

The invoice create/update (POST/PUT) handlers already accept arbitrary fields — `isRunning` and `runningTitle` will pass through to Prisma as long as they're in the schema.

### Finalization

Running invoices finalize the same way as any draft. The user opens the edit page, fills in the invoice number, clicks Finalize. `isRunning` stays true (for record-keeping), status becomes FINAL. The card stops showing it because it filters by `status=DRAFT`.

## Feature 2: Pending Charges — Visible to All, Collapsed by User

### Dashboard Card Redesign

Replace the current pending charges card internals. Instead of showing individual charges for the current user, show all users' pending charges as collapsed summaries.

Each row:
- Avatar initials + creator name
- Pending invoice count + total amount (right-aligned)
- Entire row is a link → `/invoices?status=PENDING_CHARGE&creator=[creatorName]` (or use search filter)

Sorted by total amount descending.

Header badge shows total pending count across all users.

### API

The pending charges fetch changes from the current user-scoped query to all users. Use the existing `statsOnly=true&groupBy=creator` pattern but for PENDING_CHARGE status:

`GET /api/invoices?statsOnly=true&groupBy=creator&status=PENDING_CHARGE`

Update the API's `groupBy=creator` handler to respect the `status` filter parameter (currently hardcoded to FINAL).

## Feature 3: Team Activity — Include Pending Charges

Update the creator stats aggregation in the invoices API. The `groupBy=creator` handler currently filters by `status: "FINAL"` only. Change to include both FINAL and PENDING_CHARGE:

```typescript
status: { in: ["FINAL", "PENDING_CHARGE"] }
```

This means the Team Activity card on the dashboard and the invoices page header strip will show combined totals from both finalized and pending invoices.

## Feature 4: Onboarding Tour — Running Invoices Step

Add step 10 to the onboarding tour in `src/components/onboarding-tour.tsx`:

```typescript
{
  selector: null,
  title: "Running Invoices",
  description: "For recurring charges like weekly department supplies, create a Running Invoice. It stays open so you can add line items over time, then finalize when ready.",
  icon: "📌",
}
```

## What Stays the Same

- Invoice creation flow (just adds a toggle + title field)
- Pending charge workflow (create without number, finalize later)
- Invoice table, filters, pagination
- All existing functionality
