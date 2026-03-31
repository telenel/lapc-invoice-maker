# UX Batch: Approval Blockers, URL Filters, Action Polish

Three independent workstreams executed in parallel. No schema changes, no shared files between workstreams.

---

## Workstream A: Approval Blockers & Catering Validation (#80)

### Problem
Users can't tell why Finalize/Send is blocked. Validation is toast-only with no field-level or summary feedback. Catering invoices have extra required fields that aren't visually marked.

### Design

**1. Inline field errors**
- New `FormError` component: red text below input, appears on validation failure
- Red border on invalid inputs via `aria-invalid` + Tailwind `aria-invalid:border-red-500`
- Applied to required fields: staffId, invoiceNumber, category, department

**2. Catering required fields**
- When `isCateringEvent` is true, mark additional fields required: eventDate, startTime, endTime, location, contactName, contactPhone
- Red asterisks on labels for required fields
- Same inline error pattern

**3. Preflight validation summary**
- On Finalize/Send click: collect all validation errors into an array
- Display a persistent error card at top of form: "X issues to resolve before finalizing"
- Each error is a clickable link that scrolls to the field (via `id` + `scrollIntoView`)
- Finalize/Send button disabled while errors exist
- Errors clear as user fixes them (re-validate on field change)

### Files

| File | Change |
|------|--------|
| `src/components/ui/form-error.tsx` | **New** — `<FormError message={string}/>` component |
| `src/components/invoice/keyboard-mode.tsx` | Add validation state, preflight check, error display, field IDs |
| `src/components/quote/quote-mode.tsx` | Same pattern for quote form |
| `src/components/invoice/line-items.tsx` | Highlight rows with empty description |

---

## Workstream B: URL-Synced Filters & Saved Views (#81)

### Problem
Filters are local state — can't deep-link, bookmark, or share filtered views. Dashboard widgets navigate to list pages but can't pre-filter.

### Design

**1. `useUrlFilters` hook**
- Generic hook: reads typed filters from `useSearchParams()`, writes back on change
- Handles: search (debounced 300ms), status, category, department, dateFrom, dateTo, page, pageSize, sortBy, sortOrder
- Returns `{ filters, setFilter, resetFilters, activeCount }`
- Browser back/forward works natively via URL

**2. Invoice table migration**
- Replace `useState<FilterBarFilters>` with `useUrlFilters()`
- Filter bar reads from URL on mount, writes to URL on change
- Pagination updates URL

**3. Quote table migration**
- Same as invoice table
- Additional filter: `quoteStatus`

**4. Dashboard deep links**
- Stats cards link to filtered list: "12 invoices this month" → `/invoices?dateFrom=2026-03-01&dateTo=2026-03-31`
- YourFocus items link to specific filtered views
- Running Invoices → `/invoices?status=DRAFT&isRunning=true`
- Pending Charges already has deep links (confirmed in codebase)

**5. Saved view presets**
- Tab/chip bar above table with preset filters:
  - Invoices: My Drafts, Running, Pending Charges
  - Quotes: Awaiting Response, Expiring Soon, My Drafts
- Each preset is a `<Link>` to the URL with preset params
- Active preset highlighted based on current URL match

### Files

| File | Change |
|------|--------|
| `src/lib/use-url-filters.ts` | **New** — Generic URL filter hook |
| `src/components/invoices/invoice-table.tsx` | Replace local state with URL filters, add saved views |
| `src/components/quotes/quote-table.tsx` | Same |
| `src/components/dashboard/stats-cards.tsx` | Add filter links |
| `src/components/dashboard/your-focus.tsx` | Add filter links |
| `src/components/dashboard/running-invoices.tsx` | Add filter links |

---

## Workstream C: Action Surface Polish (#83)

### Problem
Core workflows use `window.confirm()`. Destructive actions lack consistent confirmation. Async button states are ad-hoc. PDF open behavior varies.

### Design

**1. ConfirmDialog component**
- New shared component: `<ConfirmDialog open, onOpenChange, title, description, confirmLabel, variant, onConfirm />`
- Variants: `destructive` (red confirm button) and `default`
- Uses existing Dialog component as base
- Trap focus, keyboard dismissible (Escape)

**2. Replace all confirm() calls (5 locations)**
- `src/components/admin/user-management.tsx` (2): reset password, delete user
- `src/components/quick-picks/quick-pick-table.tsx` (1): delete quick-pick
- `src/components/staff/staff-table.tsx` (1): deactivate staff
- `src/components/invoices/invoice-detail.tsx` (1): delete draft invoice

Each gets a `ConfirmDialog` with appropriate title, description, and variant.

**3. AsyncButton component**
- Wraps `Button` with loading state: shows spinner + label during async operation
- Auto-disables while loading
- Used pattern: `<AsyncButton onClick={asyncFn} loadingLabel="Deleting...">`

**4. PDF/download consistency**
- Audit all PDF open/download buttons across invoice-detail, quote-detail
- Standardize: open in new tab with inline disposition
- Consistent button label: "View PDF" (not "Download", "Open", etc.)

**5. Accessibility fixes**
- Replace `<div onClick>` patterns with `<button>` where found
- Add `aria-label` to icon-only buttons (close, delete, etc.)

### Files

| File | Change |
|------|--------|
| `src/components/ui/confirm-dialog.tsx` | **New** — Shared confirmation dialog |
| `src/components/ui/async-button.tsx` | **New** — Button with loading state |
| `src/components/admin/user-management.tsx` | Replace 2 confirm() calls |
| `src/components/quick-picks/quick-pick-table.tsx` | Replace 1 confirm() call |
| `src/components/staff/staff-table.tsx` | Replace 1 confirm() call |
| `src/components/invoices/invoice-detail.tsx` | Replace 1 confirm() call |
| Quote/invoice detail PDF buttons | Standardize PDF open pattern |

---

## Verification

Each workstream verified independently:

- **A:** Open invoice form, leave required fields blank, click Finalize → see error summary + inline errors. Toggle catering → see additional required fields. Fix errors → button enables.
- **B:** Navigate to `/invoices?status=DRAFT` → table shows filtered. Change filters → URL updates. Back button → previous filters. Click dashboard stat → lands on filtered view. Click saved view chip → loads preset.
- **C:** Delete an invoice → see app dialog (not browser confirm). Check all 5 locations replaced. PDF buttons say "View PDF" and open in new tab.

All: `npm run ship-check` passes.
