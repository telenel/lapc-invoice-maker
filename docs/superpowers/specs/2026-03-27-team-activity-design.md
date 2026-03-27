# Team Activity — Subtle Competitive Invoice Processing Visibility

**Date:** 2026-03-27
**Goal:** Show who's processing invoices, how many, and how much — framed as "team activity" rather than a leaderboard. Subconsciously competitive.

## 1. Dashboard — "Team Activity" Card

New card on the dashboard, placed after Recent Invoices.

### Content
- Title: "Team Activity" with "This month" label in top-right
- All users who finalized invoices in the current month, sorted by total amount descending
- Each row: avatar initials (32px rounded-lg), name, total amount (bold, right-aligned), invoice count (small muted text below amount)
- Scrollable container if more than ~5 users (`max-h-[300px] overflow-y-auto`)
- Empty state: "No finalized invoices this month"

### Style
- Same shadow card as other dashboard cards
- Border-bottom dividers between rows
- Avatar + name on left, numbers on right (same clean-numbers pattern as recent invoices)

## 2. Recent Invoices — Creator Name

Add the creator name to each row in the dashboard Recent Invoices card.

Currently each row shows: `{invoiceNumber} · {staff.name}` on line 1, `{department} · {date}` on line 2.

Change line 2 to: `{department} · {date} · by {creator.name}`

The API already returns `creator: { name }` in the invoice response. No backend change needed.

## 3. Invoices Page — Header Strip

### User Activity Strip
Horizontal strip above the invoice table (below the page title, above the filters).

- Shows all users with finalized invoices this month
- Each user shown as a compact inline element: avatar initials + name + count + total
- Horizontally scrollable if many users (`overflow-x-auto flex gap-3`)
- Each element is a small card: `px-3 py-2 bg-muted/30 rounded-lg`
- Sorted by total amount descending

### Creator Column on Invoice Table

Add creator info to each invoice row in the full invoice table.

Currently each row's subtitle line shows: `{department} · {date} · {category}`

Add: `· by {creator.name}` at the end.

The invoice table already receives `creator: { name }` from the API. No backend change needed for the column.

## 4. API — Creator Stats Endpoint

Add a new aggregation mode to the invoices API.

`GET /api/invoices?statsOnly=true&groupBy=creator`

Returns:
```json
{
  "users": [
    {
      "id": "uuid",
      "name": "M. Montalvo",
      "invoiceCount": 18,
      "totalAmount": 24500.00
    }
  ]
}
```

Implementation: use Prisma `groupBy` on `createdById` with `_count` and `_sum` on `totalAmount`, filtered by `status: FINAL`, `type: INVOICE`, and `createdAt` in the current month. Join with User to get names. Sort by `totalAmount` descending.

## What Stays the Same

- Invoice table filtering, sorting, pagination
- Dashboard stats cards
- Recent invoices avatar row design
- All existing functionality
