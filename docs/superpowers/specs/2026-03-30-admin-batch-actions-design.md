# Admin Batch Actions — Design Spec

## Problem

The admin panel's invoice manager only supports single-row delete. There are no batch operations for invoices, and no quote management tab exists at all.

## Design

### Selection UI

- Checkbox column on the left of each table row
- "Select all" checkbox in the header (toggles current page only)
- Selected count shown in a batch action bar that appears when 1+ items are selected

### Batch Action Bar

Shared component used by both invoice and quote managers. Appears above the table when items are selected.

**Contents:**
- Selected count label — "5 invoices selected" / "3 quotes selected"
- **Change Status** — dropdown with available statuses for the entity type
- **Reassign** — combobox to pick a user (fetches user list from admin API)
- **Delete** — red destructive button
- **Clear selection** — X button to deselect all

**Confirmation:** Every action shows a confirmation dialog before executing. Format: "Delete 5 invoices?" or "Change status to FINAL for 3 quotes?" with Confirm/Cancel buttons.

**After action completes:** Clear selection, refetch the table data, show success toast.

### API Endpoints

**`PATCH /api/admin/invoices/batch`**
```typescript
{
  ids: string[];
  action: "status" | "reassign" | "delete";
  value?: string; // new status or userId for reassign
}
```

**`PATCH /api/admin/quotes/batch`**
Same shape. Quote-specific statuses.

Both require `withAdmin` middleware.

**Behavior:**
- `delete` — deletes all records with matching IDs (and their line items via cascade)
- `status` — updates status field on all matching records
- `reassign` — updates `createdBy` on all matching records

**Response:** `{ updated: number }` or `{ deleted: number }`

**Error handling:** If any ID is not found, skip it and process the rest. Return the count of actually affected records.

### Invoice Statuses

DRAFT, FINAL, PENDING_CHARGE

### Quote Statuses

DRAFT, SENT, SUBMITTED_EMAIL, SUBMITTED_MANUAL, ACCEPTED, DECLINED, REVISED, EXPIRED

### Quote Manager Tab

New "Quotes" tab in the admin settings panel. Pattern mirrors the invoice manager.

**Table columns:** Quote number, date, recipient, status, total, category
**Features:** Search (by quote number, recipient, staff), status filter dropdown, pagination (20 per page), checkbox selection + batch action bar
**No inline editing** — quotes have revision chains and sharing state that make inline edits risky. Batch actions only.

### Invoice Manager Changes

Add checkbox column to existing `invoice-manager-table.tsx`. Wire selection state and batch action bar. Existing single-row actions (inline edit, delete) remain alongside batch operations.

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/admin/batch-action-bar.tsx` | **New** — shared batch action bar with status dropdown, reassign combobox, delete button, confirmation dialog |
| `src/components/admin/invoice-manager-table.tsx` | Add checkbox column, selection state, integrate batch bar |
| `src/components/admin/quote-manager.tsx` | **New** — quote table with search, filters, pagination, checkboxes, batch bar |
| `src/components/admin/settings-panel.tsx` | Add "Quotes" tab pointing to QuoteManager |
| `src/app/api/admin/invoices/batch/route.ts` | **New** — batch actions endpoint for invoices |
| `src/app/api/admin/quotes/batch/route.ts` | **New** — batch actions endpoint for quotes |
| `src/domains/admin/service.ts` | Add batchUpdateInvoices, batchUpdateQuotes methods |
| `src/domains/admin/repository.ts` | Add batch DB operations (updateMany, deleteMany) |
| `src/domains/admin/types.ts` | Add BatchActionInput type |
| `src/domains/admin/api-client.ts` | Add batchInvoices, batchQuotes API calls |

### Not in Scope

- Batch export/CSV
- Inline editing for quotes
- Shift+click range select
- Cross-page selection (only current page)
