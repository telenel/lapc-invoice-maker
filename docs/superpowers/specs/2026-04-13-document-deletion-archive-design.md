# Document Deletion Archive — Design Spec

## Overview

Replace destructive quote and invoice deletion with a recoverable deleted archive. Users can delete their own quotes and invoices regardless of status. Admins can delete any quote or invoice regardless of status. Every delete action requires an explicit confirmation dialog in the UI.

Deleted documents are moved into a private archive instead of being physically removed. A user can view and restore their own deleted documents at any time. Admins can view and restore any deleted document.

This design applies only to quotes and invoices. Other resources keep their existing delete behavior.

## Goals

- Remove status-based delete restrictions for quotes and invoices.
- Keep owner/admin authorization rules simple and consistent across UI, API, and assistant tools.
- Preserve deleted documents for later recovery.
- Add a deleted archive that is visible only to the document owner and admins.
- Preserve conversion and revision chains when a source quote is deleted.
- Keep public quote routes inaccessible while a quote is deleted.

## Non-Goals

- Permanent hard-delete UI for quotes or invoices.
- Expanding archive behavior to contacts, staff, templates, or other models.
- Multi-step approval for restore actions.

## Product Rules

### Delete Authorization

- A signed-in user can delete their own invoice or quote regardless of status.
- An admin can delete any invoice or quote regardless of status.
- Delete always requires an in-app confirmation dialog.

### Archive Visibility

- A signed-in user can see archived documents where `createdBy = session.user.id`.
- An admin can see all archived documents.
- Users do not see other users' archived documents.

### Restore Authorization

- A signed-in user can restore their own archived invoice or quote.
- An admin can restore any archived invoice or quote.

### Meaning of "Delete"

- "Delete" now means "move to Deleted Archive".
- Deleted documents disappear from normal lists, dashboards, search results, and active workflows.
- Deleted documents remain restorable indefinitely.

## Data Model

Quotes and invoices already share the `Invoice` table, so the archive should live on that same model as a soft-delete state.

### New Fields on `Invoice`

| Field | Type | Notes |
|---|---|---|
| `deletedAt` | `DateTime?` | Null for active records. Set when moved to archive. |
| `deletedBy` | `String?` | User ID of the actor who deleted the record. |

### Optional Relation

Add a nullable relation from `Invoice.deletedBy` to `User.id` so archived UI can show who deleted the document when available. Use `onDelete: SetNull`.

### Query Rules

- Active document queries must filter `deletedAt: null`.
- Archive queries must filter `deletedAt: { not: null }`.
- `GET /api/invoices/[id]` and `GET /api/quotes/[id]` may load archived records only for authorized owner/admin viewers.
- Public quote routes must always treat archived quotes as not found.

### Indexes

Add indexes that support the most common archive lookups:

- `@@index([type, deletedAt])`
- `@@index([createdBy, deletedAt])`
- `@@index([deletedBy, deletedAt])`

## Delete Behavior

### Invoices

Deleting an invoice:

1. Verifies owner/admin access.
2. Sets `deletedAt` and `deletedBy`.
3. Leaves all invoice data intact, including status, PDF paths, line items, and related metadata.
4. Removes the invoice from active lists and workflows.

Deleting a `FINAL` invoice is allowed. Finalized invoices are archived, not destroyed.

### Quotes

Deleting a quote:

1. Verifies owner/admin access.
2. Sets `deletedAt` and `deletedBy`.
3. Leaves all quote data intact, including status, share token, views, follow-ups, and recipient data.
4. Removes the quote from active lists and workflows.

Deleting an `ACCEPTED`, `REVISED`, converted, declined, expired, or draft quote is allowed.

### Linked Records

Because deleted documents are archived rather than hard-deleted, linked records should remain attached:

- A converted invoice can continue pointing at its archived source quote.
- A revised quote can continue pointing at its archived source quote.
- Quote views, follow-ups, and notifications remain in place.

This is safer and simpler than nulling backlinks because restore returns the original document with its original relationships intact.

## Restore Behavior

Restoring an archived document:

1. Verifies owner/admin access.
2. Sets `deletedAt = null`.
3. Sets `deletedBy = null`.
4. Returns the document to active lists and workflows with its original status and relationships preserved.

### Restore Notes

- Restoring does not rewrite `quoteStatus`, `status`, `acceptedAt`, `convertedAt`, `convertedFromQuoteId`, or `revisedFromQuoteId`.
- If a restored quote is already past its expiration date, existing quote-expiration logic may move it to `EXPIRED` on access if applicable.
- Restoring a quote re-enables its internal detail view immediately.
- Public quote access remains governed by existing share-token and workflow rules after restore.

## UI Changes

### Active Detail Views

### Quote Detail

- Keep the existing confirmation dialog.
- Remove quote-status gating for the `Delete` action.
- Show `Delete` for any owner/admin-manageable quote.
- Update dialog copy to explain that the quote moves to the deleted archive and can be restored later.
- Success toast should say `Quote moved to Deleted Archive`.

### Invoice Detail

- Replace the mixed `window.confirm` and dialog behavior with a single confirmation dialog for all invoice statuses.
- Keep `Delete` visible for any owner/admin-manageable invoice.
- Update dialog copy to explain that the invoice moves to the deleted archive and can be restored later.
- Success toast should say `Invoice moved to Deleted Archive`.

### Archived Detail State

If an owner/admin opens a deleted quote or invoice detail page directly:

- Show an archived banner at the top of the page.
- Hide workflow actions that mutate active lifecycle state, such as send, approve, convert, finalize, email, and edit.
- Show a `Restore` action.
- Keep read-only inspection available.

If a non-owner non-admin attempts to access an archived record, return the existing forbidden/not-found behavior.

## Deleted Archive Surface

Add a top-level deleted archive page:

- Route: `/archive`
- Audience: authenticated users only
- Purpose: list deleted quotes and invoices available to the current viewer

### Archive List Behavior

- Default filter: all deleted documents visible to the current viewer
- Type filters: `All`, `Invoices`, `Quotes`
- Search by invoice number, quote number, department, recipient, or creator
- Show deleted timestamp and deleter when available
- Show document type and original status
- Primary row actions: `Open`, `Restore`

### Visibility Rules

- Standard users see only their own deleted documents.
- Admin sees all deleted documents.

## Routing and API

### New Archive Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/archive` | `GET` | List deleted quotes/invoices visible to current user |
| `/api/archive/[id]/restore` | `POST` | Restore an archived quote or invoice |

### Existing Endpoints to Update

| Endpoint | Method | Change |
|---|---|---|
| `/api/invoices/[id]` | `DELETE` | Archive instead of hard-delete |
| `/api/quotes/[id]` | `DELETE` | Archive instead of hard-delete |
| `/api/invoices/[id]` | `GET` | Allow owner/admin retrieval of archived records |
| `/api/quotes/[id]` | `GET` | Allow owner/admin retrieval of archived records |

### Public Quote Endpoints

Archived quotes must be inaccessible from public routes:

- `/api/quotes/public/[token]`
- `/api/quotes/public/[token]/respond`
- `/api/quotes/public/[token]/payment`
- `/quotes/review/[token]`

These routes should behave as not found when the quote is archived.

## Domain and Repository Changes

### Invoice Domain

- Add archive-aware list and lookup behavior.
- Replace destructive delete logic with `archive(id, actorId)`.
- Add `restore(id, actorId)`.
- Ensure active queries ignore archived records by default.
- Reject finalize, update, and other active-state mutation workflows while an invoice is archived.

### Quote Domain

- Add archive-aware list and lookup behavior.
- Replace destructive delete logic with `archive(id, actorId)`.
- Add `restore(id, actorId)`.
- Ensure active queries ignore archived records by default.
- Block public quote workflows when the quote is archived.
- Reject send, approve, decline, convert, revise, update, and payment-resolution workflows while a quote is archived.

### Shared Query Pattern

Repository methods should support one of these patterns:

- default active-only lookups
- explicit `includeDeleted`
- explicit archive-only lookups

The key requirement is that archive visibility is opt-in and never leaks into normal lists by accident.

## Assistant and Tooling Consistency

Update the internal chat tools to match the same policy:

- `deleteInvoice` should allow owner/admin delete for all invoice statuses.
- `deleteQuote` should allow owner/admin delete for all quote statuses.
- Both tools should describe the operation as moving the document to the deleted archive.
- Add restore-capable tool support if needed after the archive endpoints exist.

## Security

- All archive endpoints require authentication.
- Archive list responses must enforce owner/admin scoping server-side.
- Restore endpoints must enforce owner/admin scoping server-side.
- Public quote share routes must never expose archived quotes.
- Deleted records must not leak into team activity, shared staff visibility, or public links unless explicitly restored.

## Testing

### Unit Tests

- Invoice service archives any invoice status.
- Quote service archives any quote status.
- Restore returns archived documents to active state.
- Active list queries exclude archived records.
- Archive list queries respect owner/admin scope.
- Public quote lookups reject archived quotes.

### API Tests

- Owner can archive and restore their own invoice.
- Owner can archive and restore their own quote.
- Non-owner non-admin is forbidden from archive and restore.
- Admin can archive and restore any document.
- Archive list only returns the current user's records unless admin.

### Component Tests

- Quote detail shows delete for owner/admin on any status.
- Invoice detail uses the same confirmation dialog for all statuses.
- Archived detail state shows restore and hides active workflow actions.
- Archive list renders correct actions and scoped results.

### E2E Tests

- Delete a draft quote and restore it from the archive.
- Delete an accepted quote with a converted invoice and restore it.
- Delete a finalized invoice and restore it.
- Verify deleted quotes disappear from active lists and public review links.
- Verify restored records reappear in active lists.

## Migration and Backfill

- Add the new nullable archive columns through Prisma migration.
- Existing records backfill with `deletedAt = null` and `deletedBy = null`.
- No data migration is required beyond schema expansion.

## Rollout Notes

- This change intentionally redefines delete semantics from hard-delete to archive.
- Existing "deleted" success copy throughout the app should be updated to archive-oriented copy where user-facing.
- Physical file cleanup is no longer part of normal delete flow because archived records must remain recoverable.

## Out of Scope

- Permanent purge from archive
- Archive export
- Bulk restore
- Archive for non-document models
