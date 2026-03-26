# Quote Creation Feature — Design Spec

## Overview

Add a Quote creation tool to the LAPC InvoiceMaker app. Quotes are pre-invoice estimates that can be sent to internal departments or external recipients. When accepted, a Quote converts into an Invoice DRAFT that the user must edit before finalizing (adding POS data, SKUs, exact pricing, and the PO number).

## Data Model

### Approach: Shared Model

Quotes and Invoices share the same `Invoice` table, distinguished by a `type` field. This maximizes code reuse across forms, line items, quick picks, and staff selection.

### New Enums

```prisma
enum DocumentType {
  INVOICE
  QUOTE
}

enum QuoteStatus {
  DRAFT
  SENT
  ACCEPTED
  DECLINED
  EXPIRED
}
```

### New Fields on `Invoice` Model

| Field | Type | Notes |
|---|---|---|
| `type` | `DocumentType` | Default `INVOICE`. Discriminator field. |
| `quoteStatus` | `QuoteStatus?` | Only used when `type = QUOTE`. |
| `expirationDate` | `DateTime?` | User-set expiration for quotes. |
| `recipientName` | `String?` | External recipient name. |
| `recipientEmail` | `String?` | External recipient email. |
| `recipientOrg` | `String?` | External recipient organization/department. |
| `quoteNumber` | `String?` | Unique. Separate numbering: `Q-YYYY-NNNN`. |
| `convertedFromQuoteId` | `String?` | FK on Invoice pointing back to source Quote. |
| `convertedToInvoiceId` | `String?` | FK on Quote pointing to resulting Invoice. |
| `convertedAt` | `DateTime?` | Timestamp of conversion. Only used on Quotes. |

### New Field on `InvoiceItem` Model

| Field | Type | Notes |
|---|---|---|
| `sku` | `String?` | POS system SKU. Only populated on Invoices post-conversion, not on Quotes. |

### Invoice Number Handling

- Quotes use `Q-YYYY-NNNN` auto-generated numbering.
- Invoices created from Quotes use `PO-XXXXXX` format, entered manually by the user from the POS system.
- Regular invoices (not from Quotes) continue using the existing auto-generated numbering.

## Quote Lifecycle

```
DRAFT → SENT → ACCEPTED → (converts to Invoice DRAFT)
  │        │
  │        └→ DECLINED
  │        └→ EXPIRED (auto, on access)
  └→ DECLINED
  └→ EXPIRED (auto, on access)
```

### Status Rules

- **DRAFT**: Editable. Not yet shared with recipient.
- **SENT**: Editable. Has been shared (PDF download or future email).
- **ACCEPTED**: Read-only. Converted to an Invoice DRAFT.
- **DECLINED**: Read-only. Manually marked by user.
- **EXPIRED**: Read-only. Auto-set when `expirationDate` has passed (checked on page load / list fetch, not via cron).

## Conversion: Quote → Invoice

When a user accepts a Quote:

1. A new record is created with `type: INVOICE`, `status: DRAFT`.
2. All relevant fields are copied: staff, department, account code, category, notes, line items (descriptions, quantities, prices, sort order).
3. `invoiceNumber` is left **blank** — user must enter the `PO-XXXXXX` number from the POS system.
4. SKU fields on line items are left blank — user fills these in.
5. `convertedFromQuoteId` is set on the new Invoice.
6. `convertedToInvoiceId` and `quoteStatus: ACCEPTED` are set on the Quote.
7. `convertedAt` timestamp is recorded on the Quote.
8. User is redirected to the Invoice edit page to fill in POS data.

The Invoice DRAFT always requires user editing before finalization because:
- The PO number comes from the POS system.
- Line item names must match POS item names exactly.
- SKUs must be added from POS inventory.
- Prices may be adjusted to match actual POS charges.
- New line items may be added (e.g., custom items created in POS).

## Routes & Pages

### Pages

| Route | Purpose |
|---|---|
| `/quotes` | Quote list with filters (status, department, date, expiration). |
| `/quotes/new` | Create new Quote. Reuses invoice form components with Quote-specific fields (recipient info, expiration date). |
| `/quotes/[id]` | Quote detail view. Shows status, expiration countdown, actions (edit, send, convert, generate PDF, decline). |
| `/quotes/[id]/edit` | Edit Quote. Only when `quoteStatus` is `DRAFT` or `SENT`. |

### API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/quotes` | `GET` | List quotes (filtered, paginated). Queries `Invoice` table where `type = QUOTE`. |
| `/api/quotes` | `POST` | Create quote. Same validation as invoice plus recipient/expiration fields. |
| `/api/quotes/[id]` | `GET` | Get single quote. |
| `/api/quotes/[id]` | `PUT` | Update quote. Rejects if status is `ACCEPTED`, `DECLINED`, or `EXPIRED`. |
| `/api/quotes/[id]` | `DELETE` | Delete quote. |
| `/api/quotes/[id]/convert` | `POST` | Accept quote, create Invoice DRAFT, link records, redirect to edit. |
| `/api/quotes/[id]/pdf` | `GET` | Download quote PDF. |
| `/api/quotes/[id]/send` | `POST` | Mark as `SENT`. |

## Quote PDF

Single-page, portrait Letter format. Formal document layout:

- **Header**: LAPC logo (left), "QUOTE" title with quote number, date, and expiration date in red (right). Separated by branded horizontal rule.
- **From/To blocks**: LAPC College Store address on left, recipient name/org/email on right.
- **Metadata row**: Department, Category, Account Code in a shaded bar.
- **Line items table**: Description, Qty, Unit Price, Amount columns. Dark branded header row.
- **Totals**: Right-aligned subtotal, tax (9.5%), and bold total.
- **Notes**: Left-bordered block for free-text notes.
- **Footer**: Validity statement and college name.

Generated via Puppeteer (same as invoices), all styles inline. Template lives at `src/lib/pdf/templates/quote.ts`.

## UI Components

### Reused from Invoices (no changes needed)
- `line-items.tsx` — line item table editor
- `staff-select.tsx` — staff member autocomplete
- `account-select.tsx` — account code selector
- `quick-pick-panel.tsx` — quick item suggestions

### New Components
- `quote-form.tsx` — wraps `useInvoiceForm` hook with Quote-specific fields (recipient name, email, org, expiration date). Uses the same form modes (keyboard/quick).
- `quote-detail.tsx` — detail view with Quote-specific actions (send, convert to invoice, decline) and expiration countdown.
- `quote-table.tsx` — list view with Quote-specific columns (quote number, recipient, expiration, quote status).

### Modified Components
- `invoice-form.tsx` — add optional SKU field support to line items for post-conversion editing.
- Navigation sidebar — add "Quotes" entry parallel to "Invoices".

## Expiration Logic

Checked on access (not via cron):
- When fetching a quote list or single quote, if `expirationDate < now` and `quoteStatus` is `DRAFT` or `SENT`, update to `EXPIRED` before returning.
- Quote detail page shows expiration countdown (e.g., "Expires in 12 days" or "Expired 3 days ago").

## Navigation

"Quotes" appears as its own top-level sidebar entry, parallel to "Invoices". The quotes section is fully independent with its own list, create, detail, and edit pages.

## Validation

Zod schemas for Quote operations extend the existing invoice schemas:
- `quoteCreateSchema` — requires `recipientName`, `expirationDate`, and standard invoice fields (department, staff, line items). Does not require `invoiceNumber`.
- `quoteUpdateSchema` — same as create, all fields optional.
- `quoteConvertSchema` — no body needed, just the quote ID in the URL.

## Out of Scope

- Email sending (marking as SENT is manual for now; email integration is a future enhancement).
- Quote versioning / revision history.
- Internal approval chain on Quotes (only Invoices go through the signature workflow).
- Recurring quotes.
