# Repetitive Data Entry Elimination — Design Spec

**Date:** 2026-03-29
**Problem:** Users create similar invoices/quotes repeatedly, retyping the same staff, items, margin/tax settings. No way to duplicate, template, or leverage past work.
**Outcome:** Four features that eliminate repetitive data entry: Duplicate, Templates, Smart Chatbot Memory, and Draft Auto-Save.

---

## 1. Duplicate Button

### Behavior
- **Location:** Action bar on both invoice detail (`src/components/invoices/invoice-detail.tsx`) and quote detail (`src/components/quotes/quote-detail.tsx`)
- **Available on:** ALL statuses (DRAFT, FINAL, PENDING_CHARGE for invoices; all 8 statuses for quotes)
- **On click:** POST to `/api/invoices/{id}/duplicate` or `/api/quotes/{id}/duplicate`

### What gets copied
| Field | Copied | Reset/Changed |
|-------|--------|---------------|
| Staff/Contact | Yes | — |
| Department, Category | Yes | — |
| Account Code/Number | Yes | — |
| All line items (description, qty, price, taxable, costPrice, marginOverride) | Yes | — |
| Margin/Tax settings | Yes | — |
| Catering details | Yes | — |
| Notes | Yes | — |
| Approval chain | Yes | — |
| Date | No | Today |
| Invoice/Quote number | No | Auto-generated |
| Status | No | DRAFT |
| Expiration date (quotes) | No | 30 days from today |
| Share token (quotes) | No | Cleared |
| PDF path | No | Cleared |
| convertedFromQuoteId | No | Cleared |
| revisedFromQuoteId | No | Cleared |

### API
- `POST /api/invoices/{id}/duplicate` → returns `{ id, redirectTo: "/invoices/{id}/edit" }`
- `POST /api/quotes/{id}/duplicate` → returns `{ id, redirectTo: "/quotes/{id}/edit" }`
- Service methods: `invoiceService.duplicate(id, creatorId)`, `quoteService.duplicate(id, creatorId)`
- Both verify the source exists and the user has access (owner or admin)

### UI
- Button: `Duplicate` with copy icon, outline variant
- On click: redirect to new draft's edit page
- Toast: "Draft created from [number] — edit and save when ready"

---

## 2. Save as Template / New from Template

### Data Model

New `Template` Prisma model:
```prisma
model Template {
  id          String   @id @default(uuid())
  name        String
  type        DocumentType  // INVOICE or QUOTE
  staffId     String?
  department  String?
  category    String?
  accountCode String?
  marginEnabled Boolean @default(false)
  marginPercent Decimal? @db.Decimal(5, 2)
  taxEnabled  Boolean @default(false)
  notes       String?
  isCateringEvent Boolean @default(false)
  cateringDetails Json?
  items       Json     // Array of { description, quantity, unitPrice, isTaxable, costPrice, marginOverride }
  createdBy   String
  creator     User     @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("templates")
}
```

### Save as Template (from form)

- **Location:** Button next to "Save Draft" on both invoice and quote forms
- **Flow:** Click → modal prompts for template name → saves current form state as template
- **What's saved:** All form fields except date, invoice/quote number, expiration date, status
- **Stores line items as JSON** (not relational — templates are snapshots, not live data)

### New from Template (on creation pages)

- **Location:** Dropdown/combobox at top of New Invoice / New Quote pages
- **Shows:** User's templates filtered by type (INVOICE or QUOTE), sorted by most recently used
- **On select:** Pre-fills entire form with template data
- **User can edit** anything before saving — template is a starting point, not a constraint
- **Staff handling:** If template has staffId, auto-selects that staff member (triggering auto-fill). If no staffId, leaves staff blank.

### API
- `GET /api/templates?type=INVOICE|QUOTE` — list user's templates
- `POST /api/templates` — create template from form data
- `DELETE /api/templates/{id}` — delete a template
- Domain: `src/domains/template/` with types, repository, service, api-client

---

## 3. Smart Chatbot Memory

### New Chat Tools

**`duplicateInvoice`**
- Input: `{ id: string }` or `{ invoiceNumber: string }`
- Calls `invoiceService.duplicate()`
- Returns new draft with edit link
- Example: "duplicate invoice 0045" or "repeat the last invoice for Candy Van"

**`duplicateQuote`**
- Input: `{ id: string }` or `{ quoteNumber: string }`
- Calls `quoteService.duplicate()`
- Returns new draft with edit link
- Example: "copy Q-2026-0019" or "same quote as last time for Grigor"

**`listTemplates`**
- Input: `{ type?: "INVOICE" | "QUOTE" }`
- Returns template names and IDs
- Example: "show me my templates"

**`createFromTemplate`**
- Input: `{ templateName: string, overrides?: { staffId?, items?, marginPercent?, ... } }`
- Looks up template by name, creates a new draft with optional overrides
- Example: "use the Catering Package A template for Grigor, change quantity to 50"

### System Prompt Updates
Add section explaining duplicate and template capabilities. Examples:
- "duplicate Q-2026-0019" → calls duplicateQuote
- "same as last invoice for [staff name]" → searches recent invoices, duplicates
- "create from template [name]" → uses createFromTemplate

---

## 4. Draft Auto-Save

### Behavior
- **Trigger:** Form state changes (debounced 30 seconds)
- **Storage:** localStorage keyed by route: `draft:/invoices/new`, `draft:/quotes/new`, `draft:/invoices/{id}/edit`, `draft:/quotes/{id}/edit`
- **On page load:** If draft exists for current route, show banner:
  > "You have an unsaved draft from [relative time]. **Resume** or **Discard**?"
- **Resume:** Restores form state from localStorage
- **Discard:** Clears localStorage entry, loads fresh/existing data
- **Auto-clear:** On successful save/submit, clear the draft entry

### Implementation
- New hook: `useAutoSave(formState, routeKey)` in `src/lib/use-auto-save.ts`
- Banner component: `DraftRecoveryBanner` in `src/components/ui/draft-recovery-banner.tsx`
- Used in: invoice form (`keyboard-mode.tsx`), quote form (`quote-mode.tsx`), and edit pages

### Edge Cases
- Edit pages: draft keyed by specific ID, so editing invoice A doesn't restore invoice B's draft
- Multiple tabs: each tab saves independently (last write wins on same key)
- Stale drafts: auto-expire after 7 days

---

## Implementation Order

1. **Duplicate** — smallest scope, immediate value, no new models
2. **Draft Auto-Save** — no backend changes, pure client-side
3. **Templates** — new Prisma model + full domain + UI
4. **Chatbot Memory** — builds on duplicate + templates

---

## Verification

1. Open any invoice → click Duplicate → verify new draft with all fields copied, date = today
2. Open any quote → click Duplicate → verify same, expiration = 30 days out
3. Create invoice → click "Save as Template" → name it → verify it appears in dropdown on New Invoice
4. Go to New Invoice → select template from dropdown → verify form pre-fills
5. Ask chatbot "duplicate invoice [number]" → verify new draft created with link
6. Ask chatbot "use template [name] for [staff]" → verify creation
7. Start filling out a new invoice → navigate away → come back → see recovery banner
8. Click Resume → verify form restores
9. Click Discard → verify fresh form
