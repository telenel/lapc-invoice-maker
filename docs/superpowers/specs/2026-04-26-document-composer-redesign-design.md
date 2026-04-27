# Document Composer Redesign — Design Spec

**Date:** 2026-04-26
**Branch:** `feat/document-composer-redesign`
**Status:** Approved (design phase complete, awaiting user review of this spec)
**Source brief:** `LAPortal-3.zip → composer-redesign/HANDOFF.md` (high-fidelity UI/UX overhaul)

---

## 1. Overview

A high-fidelity UI/UX overhaul of LAPortal's invoice and quote creation experience, unifying both into a single **Document Composer** pattern. The composer has a structured 6-section workflow column, a sticky 360px summary rail (readiness + totals + checklist + draft state), three right-side drawers (product catalog, templates, preview), and a status-aware action toolbar.

**This is a UI/UX overhaul only.** Backend routes, API contracts, persistence, autosave, draft restore, PDF generation, product catalog handoff, templates table, validation rules, and data flows are preserved. The redesign reads from and writes to the existing `useInvoiceForm` / `useQuoteForm` hooks and supporting domain APIs without modification (one additive exception: `internalNotes` stashed in the existing `pdfMetadata` JSON).

## 2. Scope

**In scope:**
- `src/app/invoices/new/page.tsx`
- `src/app/quotes/new/page.tsx`
- `src/app/invoices/[id]/edit/page.tsx`
- `src/app/quotes/[id]/edit/page.tsx`
- New `src/components/composer/` tree (shell, sections, rail, drawers, primitives, hooks)
- CSS token additions to `src/app/globals.css` (positive, warn, info, surface, canvas, border-strong, etc.) under all themes
- Restyle of `<DraftRecoveryBanner>` (visual only)
- Status-aware toolbar adaptation for FINALIZED / SENT / etc. on edit pages
- Mobile responsive layout (sticky bottom action bar + summary bottom sheet)
- Vitest unit tests + Playwright e2e for the new composer flows

**Out of scope (preserved unchanged):**
- `useInvoiceForm`, `useQuoteForm`, all hooks under `src/components/invoice/hooks/`
- `LineItems` data layer / `line-item-utils.ts`
- `LazyProductSearchPanel` body (it gets re-mounted inside a drawer)
- `openDeferredRegisterPrintWindow` (register print)
- `templateApi` create/list/delete (additive fields if the existing `CreateTemplateInput` lacks them)
- PDF generator pipeline (`src/lib/pdf/templates/cover-sheet.ts` — extracts shared layout constants, otherwise unchanged)
- Existing `useAutoSave` / `loadDraft` localStorage scheme
- Public-facing `/quotes/payment/[token]` and `/quotes/review/[token]`
- List/detail pages (`/invoices/page.tsx`, `/invoices/[id]/page.tsx`, etc.)
- Invoice number assignment (server-side as today)

**Deferred to follow-ups:**
- Functional drag-to-reorder line items (visual grip handle present)
- Real-time multi-user composer collaboration

## 3. Architecture

```
src/components/composer/
├─ document-composer.tsx          # Shell: header, grid, mobile layout, drawer mount
├─ composer-header.tsx            # Sticky breadcrumb + title row + top-right actions
├─ composer-layout.tsx            # Two-column grid wrapper
├─ sections/
│   ├─ section-card.tsx           # Numbered step badge + status + scroll-anchor primitive
│   ├─ people-section.tsx         # Section 1
│   ├─ department-account.tsx     # Section 2 (incl. semesterYearDept)
│   ├─ document-details.tsx       # Section 3 (running/catering toggle + sub-blocks)
│   ├─ items-pricing.tsx          # Section 4 (table + margin/tax cards)
│   ├─ notes-section.tsx          # Section 5 (public + internal)
│   └─ approval-output.tsx        # Section 6 (approver slots + prismcore + action toolbar)
├─ rail/
│   ├─ summary-rail.tsx           # Sticky aside, mobile collapse to bottom action bar
│   ├─ readiness-card.tsx
│   ├─ checklist-card.tsx
│   └─ draft-state-card.tsx
├─ drawers/
│   ├─ catalog-drawer.tsx         # Wraps existing ProductSearchPanel inside a Sheet
│   ├─ templates-drawer.tsx       # Load + Save tabs
│   ├─ preview-drawer.tsx         # Stylized HTML preview
│   └─ blocker-summary.tsx        # Inline destructive banner above sections
├─ primitives/
│   ├─ approver-slot-card.tsx     # Each of the 3 signature cards
│   ├─ density-toggle.tsx         # compact / standard / comfortable segmented
│   ├─ status-pill.tsx            # DRAFT / FINALIZED / SENT etc.
│   ├─ doc-type-badge.tsx         # INVOICE / QUOTE
│   ├─ draft-restore-banner.tsx   # Restyled wrapper of existing DraftRecoveryBanner
│   └─ bottom-action-bar.tsx      # Mobile sticky bottom bar
├─ hooks/
│   ├─ use-composer-validation.ts # Blockers + checklist + readiness, derived from form
│   ├─ use-approver-slots.ts      # View-model bridging slots ↔ signatureStaffIds
│   ├─ use-density.ts             # localStorage persistence
│   └─ use-section-jump.ts        # Smooth-scroll + pulse highlight
└─ types.ts                       # Shared types (DocType, BlockerEntry, etc.)
```

**Page wrappers stay thin:** the four page files do nothing more than fetch (edit only), map API → form (edit only), call `useInvoiceForm` / `useQuoteForm`, then render `<DocumentComposer composer={...} mode={...} status={...} canManageActions={...} documentNumber={...} />`.

**Existing files to delete after Phase 8:**
- `src/components/invoice/keyboard-mode.tsx`
- `src/components/quote/quote-mode.tsx`
- The sticky `<LazyProductSearchPanel>` mounting code in the four pages

## 4. State & View-Models

The composer reads from existing form hooks unchanged. New UI shape lives in **derived view-models** computed inside the composer.

### `<DocumentComposer>` props

```ts
type ComposerForm =
  | { docType: "invoice"; form: ReturnType<typeof useInvoiceForm> }
  | { docType: "quote";   form: ReturnType<typeof useQuoteForm> };

interface DocumentComposerProps {
  composer: ComposerForm;
  mode: "create" | "edit";
  status?: string;        // DRAFT | FINALIZED | SENT | EXPIRED — drives header pill + toolbar
  canManageActions?: boolean;
  documentNumber?: string;
}
```

### Derived view-models (computed inside `useComposerValidation`)

| View-model | Source of truth | Derivation |
|---|---|---|
| `approverSlots` | `form.signatureStaffIds.line{1,2,3}` + staff lookup | UI writes back into existing `signatures` + `signatureStaffIds` per slot. No persistence change. |
| `recipient` | quote: `form.recipientName` / `recipientEmail` / `recipientOrg` + `form.staffId` | If `staffId` set → "internal"; else → "external". |
| `running` | invoice: `form.isRunning` + `form.runningTitle` | Direct passthrough. |
| `catering` | quote: `form.isCateringEvent` + full `form.cateringDetails` | Section 3 surfaces 4 fields per handoff; full rest stays in a `<More details>` disclosure. |
| `blockers` | live derivation per validation rules | See validation table below. |
| `checklist` | live derivation | See checklist table below. |
| `readiness` | `complete / total` of checklist | 0..1. |
| `totals` | `form.items` + margin + tax | Subtotal, taxable subtotal, taxAmount, marginAmount, grandTotal, itemCount, taxableCount. |

### Validation — invoice blockers

| Field | Rule |
|---|---|
| `requestor` | `form.staffId` truthy |
| `department` | `form.department` truthy |
| `accountNumber` | `form.accountNumber` truthy |
| `category` | `form.category` truthy |
| `items` | `form.items.length > 0` |
| `itemsValid` | every `description.trim()` and `quantity > 0` |
| `approvers` | at least 2 of `signatureStaffIds.line{1,2,3}` populated |

### Validation — quote blockers

Same as invoice except no `approvers`; instead:

| Field | Rule |
|---|---|
| `recipient` | If `staffId` set (internal) → satisfied. If external → `recipientName.trim()` truthy. |

Each blocker carries `{ field, label, anchor }` where `anchor` matches a section id (`section-people`, `section-department`, `section-details`, `section-items`, `section-notes`, `section-approval`).

### Checklist — invoice (6 items)

1. Requestor selected (anchor `section-people`)
2. Department & account (anchor `section-department`)
3. Category chosen (anchor `section-details`)
4. Line items added (anchor `section-items`)
5. Items valid — description + qty > 0 (anchor `section-items`)
6. At least 2 approvers assigned (anchor `section-approval`)

### Checklist — quote (6 items)

1. Requestor selected (anchor `section-people`)
2. Recipient set (anchor `section-people`)
3. Category chosen (anchor `section-details`)
4. Line items added (anchor `section-items`)
5. Items valid (anchor `section-items`)
6. Margin & tax confirmed — soft, non-blocker (anchor `section-items`)

### Save Draft gating (server-validation aware)

The composer separates **two gating levels**:

| Level | Used by | Required fields |
|---|---|---|
| **Schema minimum** (server will accept) | "Save Draft" button + rail "Save Draft" | `department`, `date`, `staffId` (or `contactId`), at least 1 line item where each has `description` + `quantity > 0`. Quote also: `recipientName`. |
| **Full readiness** (no blockers) | "Generate PDF" / "Save Quote & Generate PDF" primary action | Schema minimum + `accountNumber` + `category` + (invoice) ≥2 approver slots filled |

These map to the existing validators (`invoiceCreateSchema` / `quoteCreateSchema`) which already enforce the schema-minimum server-side. If a user clicks "Save Draft" without meeting schema minimum, the existing toast error path surfaces the first field error from the server response — we do not silently swallow it.

The composer adds a `useComposerValidation` derivation `canSaveDraft: boolean` based on the schema-minimum subset, and disables the "Save Draft" button when false (with a small muted hint "Add a department, date, requestor, and at least one valid item to save").

`blockers` continues to drive the primary action gating (full readiness).

### Persistence rules (preserved)

- **Margin formula stays markup**: `cost * (1 + marginPercent / 100)` per existing `useInvoiceFormState`. The handoff prototype's `cost / (1 - marginPercent)` is **not adopted**. Backend contract preserved.
- **Recurring fields** (`isRecurring`, `recurringInterval`, `recurringEmail`): persisted at hook defaults (false / empty / empty), no UI surface in the composer. Matches today's behavior. Detail/list pages continue to read them.
- **`semesterYearDept`**: surfaces as a quiet auto-derived field in section 2. Defaults to `form.department` if empty (matches existing `service.ts` behavior). Used by PDF cover sheet.
- **`signatureStaffIds` + `signatures`**: shape unchanged. The `approverSlots: [{id, name, title}, {id, name, title}, {id, name, title}]` view-model reads/writes both fields per slot.
- **Density preference**: `localStorage["composer.density"]` ("compact" | "standard" | "comfortable"), default "standard".
- **Last-used doc type**: `localStorage["composer.lastDocType"]`. Reserved for future use (e.g., "New" button defaults). Not consumed by the composer itself.

### Persistence change (one additive)

**`internalNotes`** for invoices and quotes:
- Stashed inside the existing `pdfMetadata` JSON column on the Invoice table (quotes are rows in the same table — confirmed in spec review).
- Accessor: `pdfMetadata.internalNotes: string | null`.
- Form shape: flat `form.internalNotes: string` on both `useInvoiceForm` and `useQuoteForm`. The save hooks nest it into the `pdfMetadata` payload — same pattern `use-invoice-save.ts` uses today for `signatures` and `signatureStaffIds`.
- Validators:
  - `invoiceCreateSchema.pdfMetadata` z.object: add `internalNotes: z.string().optional()` (additive)
  - `quoteCreateSchema`: add a new `pdfMetadata: z.object({ internalNotes: z.string().optional() }).optional()` field (the quote validator does not currently have a `pdfMetadata` block; add one)
- Services:
  - Invoice service already merges `pdfMetadata` — add `internalNotes` to the merge logic alongside `signatures`/`signatureStaffIds`
  - Quote service: add the same `pdfMetadata` merge pattern (currently no pdfMetadata handling)
- Rule: PDF templates explicitly **skip** the `internalNotes` key. A unit test in P4 asserts the cover-sheet HTML output does not contain internal-notes content.
- Loaded on edit-page hydrate via `mapApiToFormData` (added field on both invoice + quote edit pages).
- No schema migration — `pdfMetadata` is already a JSON column.

## 5. CSS Tokens

Add to `src/app/globals.css` under `:root` (light) and `.dark` plus the four Catppuccin theme blocks. Keep names matching the handoff so prototype-to-shadcn mapping is mechanical.

### New tokens (light)

```css
--canvas:        oklch(0.965 0.004 75);
--surface:       oklch(0.975 0.003 75);
--border-strong: oklch(0.84 0.005 75);

--positive:        oklch(0.5 0.12 165);
--positive-bg:     oklch(0.96 0.04 165);
--positive-border: oklch(0.85 0.07 165);

--warn:        oklch(0.62 0.13 70);
--warn-bg:     oklch(0.97 0.04 80);
--warn-border: oklch(0.86 0.08 80);

--info:        oklch(0.5 0.12 240);
--info-bg:     oklch(0.96 0.03 240);
--info-border: oklch(0.85 0.06 240);

--teal:    oklch(0.55 0.1 195);
--teal-bg: oklch(0.96 0.025 195);
```

### Dark + theme variants

Mirror values with bumped lightness for foreground hues (positive `0.65 0.12 165`, warn `0.7 0.12 70`, info `0.65 0.12 240`) and darkened fill bgs. Match for `.theme-frappe`, `.theme-macchiato`, `.theme-mocha` so the multi-theme contract isn't broken.

### Tailwind utility export (in `@theme inline`)

```css
--color-canvas:          var(--canvas);
--color-surface:         var(--surface);
--color-border-strong:   var(--border-strong);
--color-positive:        var(--positive);
--color-positive-bg:     var(--positive-bg);
--color-positive-border: var(--positive-border);
--color-warn:            var(--warn);
--color-warn-bg:         var(--warn-bg);
--color-warn-border:     var(--warn-border);
--color-info:            var(--info);
--color-info-bg:         var(--info-bg);
--color-info-border:     var(--info-border);
--color-teal:            var(--teal);
--color-teal-bg:         var(--teal-bg);
```

### Shadows

Add a `shadow-rail` utility to globals.css for the rail card lift:

```css
.shadow-rail {
  box-shadow:
    0 1px 2px oklch(0 0 0 / 0.03),
    0 8px 24px oklch(0 0 0 / 0.05);
}
```

Dark mode: same utility but with stronger black at higher alpha.

### Existing tokens (unchanged)

`--primary` (LAPortal red), `--brand-teal`, `--destructive`, `--border`, `--card`, `--muted`, `--muted-foreground`, `--accent`, `--radius` (0.625rem ≈ 10px).

### Fonts

Inter (UI) and JetBrains Mono (SKU, account number, tabular numerics). Verify they're loaded via `next/font/google` in `app/layout.tsx`; add if missing during P1. Tailwind v4 includes a `tabular-nums` utility — use it directly.

## 6. Composer Shell + Layout

### `<DocumentComposer>`

- Renders `<ComposerHeader>`, the main grid, `<DraftRestoreBanner>` (when active), `<BlockerSummary>` (when triggered), and mounts the three drawers.
- Owns drawer state: `const [drawer, setDrawer] = useState<"catalog" | "templates" | "preview" | null>(null)`.
- Owns blocker-summary visibility: `const [showBlockers, setShowBlockers] = useState(false)`.
- Calls `useComposerValidation(form, docType)` for `{ blockers, checklist, readiness, totals }`.
- Calls `useDensity()` for table density.
- Provides `useSectionJump()` (smooth scroll + 900ms pulse ring) for checklist items, blocker summary, and rail card actions.
- Exposes an `openCatalog(categoryFilter?: string)` callback so the catering-preset button can pre-filter to "Catering".

### `<ComposerHeader>`

Sticky element, `top: 0`, `backdrop-blur-md`, semi-transparent canvas background, `border-b border-border`. Two rows.

**Row 1 — breadcrumb strip** (`px-6 py-2.5`):
- LAPORTAL wordmark (red, mono, tracked, 12px)
- chevron · "Invoices" or "Quotes" · chevron · "New" or document number
- right side: `<StatusPill>` (DRAFT / FINALIZED / SENT / EXPIRED — color-mapped) and `<DocTypeBadge>` (INVOICE red-soft / QUOTE teal-soft)

**Row 2 — title row** (`px-6 pb-4`):
- Left: `<h1>` 22px `font-bold tracking-tight` ("New Invoice" / "Edit Invoice" / "New Quote" / "Edit Quote") + mono doc number + middot + date + optional `<RunningBadge>` (info-tone) when `form.isRunning`
- Right: ghost `<TemplatesButton>` → opens templates drawer; ghost `<PreviewButton>` → opens preview drawer; vertical separator; default `<PrintRegisterButton>` → calls `openDeferredRegisterPrintWindow`

### Edit-mode toolbar adaptation (driven by `status` + `canManageActions`)

| Status | Header pill | Primary action | Save Draft | Save as Template |
|---|---|---|---|---|
| DRAFT (manageable) | `bg-muted` "DRAFT" | Generate PDF / Save Quote & Generate PDF | shown | shown |
| FINALIZED (manageable, invoice) | `bg-positive-bg` "FINALIZED" | "Re-generate PDF" | hidden | shown |
| SENT / PAID (manageable, quote) | tone-mapped | status-specific | hidden | shown |
| Any, **not manageable** | tone-mapped, no action | hidden entirely | hidden | hidden |

The composer reads existing edit-page status flags (`viewerAccess.canManageActions`) and renders accordingly. No new server-side permission logic.

### Layout

```tsx
<main className="mx-auto max-w-[1440px] px-6 pt-4 pb-20 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
  <div className="min-w-0 space-y-3.5">{/* sections + banners */}</div>
  <SummaryRail className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" />
</main>
```

`14px` between section cards via `space-y-3.5`. `18px` card padding via Tailwind `p-[18px]` or a `composer-card` class.

### Mobile (`< lg`)

- Stack rail under workflow.
- Catalog drawer becomes a full-screen `<Sheet side="bottom">`.
- Sticky bottom action bar (`<BottomActionBar>`): primary action (Generate PDF / Save Quote) + grand total + "Open summary" trigger that opens the rail content as a bottom sheet.
- Header collapses Row 1 (breadcrumb hides on `< sm`); Row 2 keeps title + doc number + the single primary right-side action.

Page-enter animation reuses existing `.page-enter` / `.page-enter-1` / `.page-enter-2` class pattern.

## 7. Sections 1–6

### `<SectionCard>` primitive

Bordered card, 18px padding, sticky-ish header strip with:
- left: `<StepBadge step={n} status={"default"|"complete"|"blocker"}>` — circle with number, flips to filled-green ✓ when complete or filled-destructive ✕ when blocker
- title (semibold 14px) + optional muted description (12.5px)
- right: optional `action` slot (density toggle, etc.)
- `id={anchor}` for `useSectionJump` to scroll/pulse

Status driven by `useComposerValidation` mapping anchor → checklist completion + blocker presence.

### Section 1 — People (`people-section.tsx`)

Two-column grid, `gap-3.5`. Description copy doc-type-aware:
- Invoice: "Who is the requestor of these items / services, and what are we charging them for?"
- Quote: "Who is requesting these items, and who will receive this quote?"

**Column 1 — Requestor / Staff:**
- Wraps existing `<StaffSelect>` / `<StaffSummaryEditor>`. Reuses `handleStaffSelect`, `handleStaffEdit`, `staffAccountNumbers` from the form hook.
- Hint: "Autofills department & contact"
- Restyle the trigger to match the handoff's `<Field>` pattern (label above, mono mute hint, error state).

**Column 2 — Recipient (quote) OR Contact info card (invoice):**
- **Quote**: segmented control "Internal dept." / "External party". Internal collapses to a hint reading "Quote will be sent to the requestor's email." External expands inline `<Input>` for name + optional `<Input type="email">` for address. Both write to existing `recipientName` / `recipientEmail` / `recipientOrg`.
- **Invoice**: editable contact card. The handoff drew this as a read-only display, but the existing app surfaces editable fields here that the staff-auto-save hook persists back to the staff record (`useStaffAutoSave`). To preserve current functionality:
  - `form.contactName` — small editable `<Input>`. Autofills from staff but editable per-document. Persisted via `pdfMetadata.contactName`.
  - `form.contactExtension` — small editable mono `<Input>`. Persisted via `pdfMetadata.contactExtension`.
  - `form.contactEmail` (mono) — editable `<Input type="email">`. Auto-saves to staff record after 1s debounce when changed.
  - `form.contactPhone` (mono tnum) — editable `<Input>`. Auto-saves to staff record after 1s debounce.
  - Fallback "— select a staff member —" when no staff is set.

  Visually: stays compact (single muted-bordered container, fields stacked vertically) so it reads more like an inline summary card than a form section. The handoff's read-only feel is approximated by treating these as quiet 12.5px inputs without prominent labels.

**Validation:**
- Invoice: blocker if `!form.staffId`
- Quote: blocker if `!form.staffId` (internal mode) OR `!recipientName.trim()` (external mode)

### Section 2 — Department & Account (`department-account.tsx`)

Three-column grid (`grid-cols-[1.2fr_1fr_1fr] gap-3.5`):

| Field | Behavior |
|---|---|
| Department | `<Select>` over BKST / AUXS / MATH / BIOL / ATHL / STDV / FINC and others currently in data. Autofills account number from staff. |
| Account Number | Wraps existing `<AccountNumberSelect>`. Mono tnum, `placeholder="00-0000-000"`. Required. Inline error "Required for GL posting — verify with department" when empty. |
| Account Code | mono `<Input>`, optional, placeholder `—`. |

Below the three columns, a quiet auto-derived field row:
- **Term / Semester** (`semesterYearDept`): small `<Input>` labeled "Semester (PDF cover)" with hint "Auto-generated from department". Defaults to `form.department` if empty. Editable for overrides like "SP26-IT". Non-blocking.

**Validation:**
- Blocker if `!department`
- Blocker if `!accountNumber`

### Section 3 — Document Details (`document-details.tsx`)

Three-column grid:

| Field | Behavior |
|---|---|
| Category | `<Select>` from `categoryApi.list()`. Required. |
| Date | `<Input type="date">`. Required, defaults to today. |
| Mode toggle | Invoice → "Running invoice" toggle box; Quote → "Catering quote" toggle box. Toggle box = bordered container with `<Switch>` + helper text that flips between muted/info color. |

When Running enabled (invoice): inline `<Input>` "Running invoice title" appears below the grid. Stored in `form.runningTitle`.

When Catering enabled (quote): an `info-bg` info-tone container appears below. Inside it, a 4-column primary block per handoff:
- Event name | Date | Attendees (number) | Location

Below those, a `<details>` disclosure "More catering details" (closed by default), expanding to a 2-column grid of the **preserved rich fields**:
- Start time, End time
- Headcount (separate from attendees if needed)
- Setup required + setup time + setup instructions
- Takedown required + takedown time + takedown instructions
- Contact name, contact phone, contact email
- Special instructions

All read/write `form.cateringDetails.*` unchanged.

**Validation:** soft only — Category appears in checklist but not as a blocker.

### Section 4 — Items & Pricing (`items-pricing.tsx`)

**Header strip action**: `<DensityToggle>` — segmented `compact / standard / comfortable`. Persists via `useDensity()`. Drives row vertical padding (4px / 7px / 10px) and font size (12.5 / 13 / 13).

**`<LineItemsTable>`** — bordered container (`border border-border-strong rounded-lg overflow-hidden`). Real `<table>` for accessibility + tabular-nums alignment.

Columns (variants conditional on margin/tax enabled):

| Col | Width | Content |
|---|---|---|
| `#` | 36px | drag handle (`<GripVertical>` opacity 40%) + 2-digit row number (mono) |
| `SKU` | 110px | catalog `<Package>` icon prefix when `fromCatalog` (teal); editable mono `<input>` |
| `Description` | flex min 220px | uppercase auto-transform; error background when empty |
| `Qty` | 64px right | `<input type="number" min={0}>`; error bg when ≤ 0 |
| `Cost` | 84px right | `<input type="number" step="0.01">` bound to `item.costPrice` (falls back to `item.unitPrice` if null); muted text. When `marginEnabled`, editing Cost is the canonical entry point — Charged auto-derives. When `!marginEnabled`, this column is informational; editing it does not auto-update charged. |
| `Charged` | 84px right | When `marginEnabled`: read-only display (12.5px tabular-num) of `Math.round(cost * (1 + (marginOverride ?? marginPercent) / 100) * 100) / 100`. Per-row override is set via the Margin column (see below), not by editing Charged directly. When `!marginEnabled`: editable `<input type="number" step="0.01">` bound to `item.unitPrice`. **Rationale:** the existing `buildPayload` recomputes `unitPrice = cost * (1 + m/100)` at save time when margin is on; allowing Charged to be edited directly would let the displayed value drift from the saved value. Read-only display when margin is on keeps display ↔ persistence in sync. |
| `Margin` | 70px right | only when margin enabled. Read-only `XX.X%`. Trailing `•` and info-blue when override set. |
| `Tax` | 50px center | only when tax enabled. Toggle button cycling `TAX` (positive) / `—` (muted). |
| `Extended` | 96px right | bold tabular-num. Computed from charged × qty (uses `itemsWithMargin` derivation when margin enabled). |
| `⋮` | 32px right | trash icon → `removeItem(idx)` |

`fromCatalog` is **inferred from `sku != null`** (no schema change). Row error state: pale destructive tint background.

**Drag-to-reorder**: visual grip handle present, no functional drag (deferred).

**Toolbar below table** (in a muted footer strip with `bg-muted` rounded-bottom):
- left: primary red `<Button>` "Search Product Catalog" with `<SearchIcon>` → opens **Catalog Drawer**
- left next: `<Button variant="outline">` "Add custom line" → `addItem()`
- left next, conditional (quote + catering): `<Button variant="ghost">` "Catering preset" → opens catalog drawer pre-filtered to "Catering" category (preferred over direct `addItems` because it reuses one code path)
- right: muted `<kbd>Tab</kbd>` "next field" · `<kbd>Enter</kbd>` "add row". Existing keyboard handlers preserved.

**Margin & Tax cards below table** — `grid-cols-2 gap-3`:

Each card has a header row (uppercase mono label + `<InfoPop>` + right `<Switch>`) and a body that appears when enabled.
- **Margin card**: `<Slider>` 0–60%, value display "XX%" tnum, hint "Cost prices stay internal; charged price updates automatically." Writes `form.marginPercent`.
- **Tax card**: `<Input>` for rate (e.g., `0.0975`), reuses existing `useTaxCalculation`. Hint shows resolved percentage and taxable item count.

Margin and tax are independently toggleable, both default off. When margin is enabled and `marginPercent === 0`, soft warn hint "Set a margin above 0% for it to take effect" — non-blocking.

### Section 5 — Notes & Internal Details (`notes-section.tsx`)

Two-column grid, `gap-3.5`:

| Field | Behavior |
|---|---|
| Notes (visible on PDF) | `<Textarea>` rows=4. Counter "0 / 500" (warn-tone ≥ 480, destructive-tone over 500). Writes `form.notes`. |
| Internal notes (not on PDF) | `<Textarea>` rows=4. Writes `form.internalNotes` → persists via `pdfMetadata.internalNotes`. PDF template explicitly skips this key. |

Validation: neither field is a blocker. Notes counter is warn-only.

### Section 6 — Approval & Output (invoice) / Output & Reuse (quote) (`approval-output.tsx`)

**Invoice — Approver slot grid** (`grid-cols-3 gap-3`):

Three `<ApproverSlotCard>`s, each wrapping the existing `<StaffSignatureSelect>`:
- header: label "Signature 1 · Required" / "Signature 2 · Required" / "Signature 3 · Optional"
- approver `<Select>` populates `signatureStaffIds.line{n}` and computes display string for `signatures.line{n}` as `${staff.name} — ${staff.title}`
- approver title (12px muted) below the select once filled
- signature underline preview with cursive-italic display name; dashed muted underline when empty
- subtle status pill: green-tinted when filled-and-required, muted when empty-and-optional, destructive-bordered when empty-and-required-and-form-attempted-submit

**Two-of-three required** ⇒ blocker `"${2 - filledRequiredCount} approver(s) missing (2 required)"`. Slot 3 is optional but if filled it renders on the PDF as a third signature.

**Read-only when status = FINALIZED**: slots display the staff name but the `<Select>` is disabled.

**Invoice — Upload PrismCore Invoice** (full width below the grid):
- Initial: default-styled button "Upload PrismCore Invoice" with `<UploadCloudIcon>`. Calls existing `<PrismcoreUpload>` body / endpoint.
- Success: row swaps to `bg-positive-bg border-positive-border` strip with `<CheckCircleIcon>`, mono `prismcorePath`, ghost `Remove` button.
- Available only when DRAFT status (matches today).

**Quote — same section minus approvers and PrismCore.**

**Action toolbar** — full width, three labeled groups separated by vertical 1px dividers:

```
┌─ Output ──────────────────────┐ │ ┌─ Save ──────┐ │ ┌─ Reuse ────────────┐
│ Generate PDF (primary red)     │ │ Save Draft   │ │ Save as Template     │
│ Print for Register (default)   │ │              │ │                      │
└───────────────────────────────┘ └─────────────┘ └────────────────────────┘
```

- Invoice: "Generate PDF" → existing `saveAndFinalize`. **This is a 2-step server flow**: (1) POST/PUT to `/api/invoices` (writing the form including the new `pdfMetadata.internalNotes`), (2) `invoiceApi.finalize(id, { prismcorePath, signatures, signatureStaffIds, semesterYearDept, contactName, contactExtension })` triggers PDF generation server-side. Existing `<PdfProgress>` modal shows "saving" → "generating" → "done". Then redirects to `/invoices/${id}`.
- Quote: "Save Quote & Generate PDF" → `saveQuote` (saves + redirects to `/quotes/${id}`) + open `/api/quotes/${id}/pdf` (GET — binary PDF inline) in a new tab.
- "Print for Register" → `openDeferredRegisterPrintWindow(...)` unchanged.
- "Save Draft" → invoice: existing `saveDraft`. Quote: existing `saveQuote`. **Both navigate to the detail page after success** (`router.push(/invoices/${id})` / `router.push(/quotes/${id})`). This matches current UX — saving a new doc creates an id, then takes the user to the detail/edit surface to continue. Server validation gates saving (see "Save Draft gating" below).
- "Save as Template" → opens templates drawer in "Save" tab, prefilled.

Group labels (uppercase mono 10.5px tracked) sit above each cluster.

**Disabling primary action**: when `blockers.length > 0`, the primary red button is disabled. Below it, a 12.5px destructive-tinted "Resolve N blocker(s) below to continue" — clicking opens the blocker summary banner.

## 8. Right Summary Rail

`<SummaryRail>` — sticky aside, 360px wide on `lg+`, `top-4`, `max-h-[calc(100vh-2rem)]`, internally scrollable. Three stacked cards.

### `<ReadinessCard>`

**Top strip:**
- left: uppercase mono "READINESS" 11px tracked
- right: status text, color-mapped:
  - 100% complete, 0 blockers → `text-positive` "Ready"
  - 0 blockers, mid-progress → `text-primary` "XX%"
  - blockers > 0 → `text-warn` "N blocker(s)"

**Progress bar**: 4px, rounded-full, fill matches status color, transition 240ms.

**Totals block** (dashed `border-t border-border` separator above):

```
Subtotal · 5 items                  $1,247.18
Margin (when enabled)               +$184.32 ⓘ
Sales tax · 9.75% · 4 taxable        $86.07
─────────────────────────────────────────────
INVOICE TOTAL                       $1,333.25  (22px tnum bold)
```

- Subtotal label includes item count.
- Margin row only when `marginEnabled`. Positive-tone with `<InfoPop>`.
- Sales tax row only when `taxEnabled`. Resolved rate + taxable count.
- Grand-total: top border, label flips by doc type ("INVOICE TOTAL" / "QUOTED TOTAL"), value 22px tabular `font-bold`.

**Account-status callout:**
- `accountNumber` + `department` truthy → `bg-positive-bg border-positive-border` "Charging `${accountNumber} · ${department}`" with `<CheckIcon>`
- else → `bg-warn-bg border-warn-border` "Account number missing" with `<AlertTriangleIcon>` + small "Set in section 2" anchor button

**Primary action** — full-width red `<Button>`:
- Invoice: "Generate PDF" → `saveAndFinalize`
- Quote: "Save Quote & Generate PDF" → `saveQuote` (POST/PUT to `/api/quotes` — returns the quote id and triggers existing `router.push(/quotes/${id})`); then `window.open(/api/quotes/${id}/pdf, "_blank")` to open the PDF inline. The PDF route is `GET /api/quotes/[id]/pdf` (verified at `src/app/api/quotes/[id]/pdf/route.ts`) — it serves a binary PDF with `Content-Disposition: inline`. **Not a POST.**
- Disabled when `blockers.length > 0`. Below, 12.5px destructive-tinted "Resolve N blocker(s) below to continue" → opens blocker summary.
- When `saving === true`: inline spinner + "Saving…"; existing `<PdfProgress>` modal handles full-screen progress for invoice finalize.

**Two secondary buttons** `grid-cols-2 gap-2`:
- "Save Draft" → invoice: `saveDraft`. Quote: `saveQuote`. Disabled when `!canSaveDraft` (see "Save Draft gating" in section 4); below it, a 12.5px muted "Fill department, date, requestor, and one valid item to save".
- "Print Register" → `openDeferredRegisterPrintWindow(...)`

### `<ChecklistCard>`

Header: "CHECKLIST" uppercase mono 11px + "· N/M" count. Right side: tiny ghost `<ChevronUp>` to collapse on mobile.

Each checklist item:
- 14px circle icon: filled green check when `complete`, filled destructive ✕ when `blocker`, dashed muted circle otherwise
- 12.5px label: line-through + muted when `complete`, destructive + semibold when `blocker`
- right `<ChevronRight>` (only when not complete)
- entire row is a button → `useSectionJump(anchor)` smooth-scrolls + 900ms pulse ring

Hover: `bg-muted` row background.

### `<DraftStateCard>`

Compact pill row, single line:
- **Saved** — `<CheckCircleIcon>` positive + "Saved" + relative time "2m ago"
- **Saving…** — spinning `<RefreshCwIcon>` info-tone + "Saving…"
- **Unsaved changes** — pulsing `<DotIcon>` warn-tone + "Unsaved changes"

Reads existing `useAutoSave` exposed flags. No new persistence.

### Mobile collapse

- Rail content moves below sections.
- Readiness card primary action + grand total duplicate into `<BottomActionBar>` (sticky bottom).
- "Open summary" trigger opens a `<Sheet side="bottom">` with the full readiness + checklist + draft state cards.

## 9. Drawers + Banners

### Catalog Drawer (`drawers/catalog-drawer.tsx`)

Wraps existing `<LazyProductSearchPanel>` inside a shadcn `<Sheet>`. Desktop (`lg+`): `side="right"`, 580px width, full viewport height. Mobile (`< lg`): `side="bottom"`, full-screen height.
- Header: title "Product Catalog" + filter pill showing current category filter; close button.
- Body: re-uses `<LazyProductSearchPanel>` body unchanged.
- Footer (fixed bottom): "N selected" counter, ghost "Clear", primary red "Add N to document" → `composer.form.addItems(mapProductsToItems(selected))` then closes the drawer.
- Pre-filter support: `openCatalog(categoryFilter?: string)` exposed by `<DocumentComposer>`.

The existing sticky right-panel mounting on `/invoices/new` and `/quotes/new` goes away.

### Templates Drawer (`drawers/templates-drawer.tsx`)

Two tabs (`<Tabs>`), default to "Load":

**Load tab:**
- Auto-fetch via `templateApi.list("INVOICE" | "QUOTE")` on open.
- List of `<TemplateRow>`: name + item-count badge, note, "Used X · Category" footer.
- Click → inline confirmation panel: "Replace current items? You have N items." with Cancel / Confirm Replace. Confirm replaces the current items and copies the template's category/notes/margin/tax/catering settings into form fields.

  Implementation note: `useInvoiceFormState` and quote form state both expose `setForm` via the returned object (the hook spreads it). The composer calls `setForm(prev => ({ ...prev, items: mappedTemplateItems, category: template.category, notes: template.notes, marginEnabled: ..., marginPercent: ..., taxEnabled: ..., taxRate: ... }))`. If `setForm` isn't currently surfaced, we add it as an additive return — same pattern as `updateField`. Confirm in P5.

**Save tab:**
- Inputs: template name (required), category `<Select>`, notes `<Textarea>` (optional)
- Info banner: "Items, category, notes, and margin/tax settings. Requestor, account number, dates, and signatures are not saved."
- Primary save → `templateApi.create({ name, category, notes, type, items: prepareLineItemsForSubmit(form.items), marginEnabled, marginPercent, taxEnabled, taxRate })`. Toasts "Template saved".

**Confirmed during spec review**: `CreateTemplateInput` in `src/domains/template/types.ts` already accepts `marginEnabled`, `marginPercent`, `taxEnabled`, `taxRate`, `notes`, `category`, `isCateringEvent`, `cateringDetails`, and the items payload. No backend extension required — wire directly.

### Preview Drawer (`drawers/preview-drawer.tsx`)

Stylized HTML preview, **not** real PDF.
- Header: title "Preview" + hint "Visual preview only. Final PDF is generated on save."
- Body: centered "page" element (8.5 × 11 ratio, `max-w-[640px]`, scaled to fit). Layout matches `cover-sheet.ts`:
  - LAPortal red header bar with logo wordmark
  - "BILL TO" + "CATEGORY" + "DATE" three-column block
  - Line-item table: SKU / DESCRIPTION / QTY / PRICE / EXTENDED
  - Totals block
  - Signature section (invoice only): three approver lines, italic display name + title
  - Notes (public only — internal notes excluded by design)
- Footer: ghost "Close" + primary red "Generate PDF".

To prevent drift, extract layout constants (column widths in print %, font sizes) into `src/lib/pdf/pdf-layout.ts`. Both `cover-sheet.ts` (HTML for puppeteer) and `<PreviewDrawer>` (JSX) consume it. Done in P6.

### Draft Restore Banner (`primitives/draft-restore-banner.tsx`)

Wraps existing `<DraftRecoveryBanner>` from `src/components/ui/draft-recovery-banner.tsx`, restyled.
- `bg-info-bg border-info-border` rounded strip above section 1
- `<InfoIcon>` + "Draft from `${relativeTime(savedAt)}` · `${itemCount}` line items, `${formatMoney(total)}` — last modified `${relativeTime}` ago"
- Right side: ghost "Discard" + default "Restore Draft"
- Slides up on mount.

Autosave / `loadDraft` logic in `@/lib/use-auto-save` unchanged — only visual treatment swaps.

### Blocker Summary Banner (`drawers/blocker-summary.tsx`)

Inline destructive-tinted banner above section 1. Shown when:
- User clicks the rail's primary action (Generate PDF / Save Quote) **and** `blockers.length > 0`, OR
- User clicks the "Resolve N blockers" link below the primary action

Visual: `bg-destructive/[0.05] border-destructive/30` rounded panel:
- header: `<AlertTriangleIcon>` (destructive) + "Cannot generate PDF — N issue(s) to resolve" + ghost close
- list: each blocker as a `<button>` with destructive text, dotted underline, `<ChevronRight>` → `useSectionJump(blocker.anchor)` scrolls and pulses ring 900ms

`slide-up` animation on mount via existing `tw-animate-css`.

## 10. Edit-Page Integration

### `/invoices/[id]/edit/page.tsx`

Keeps:
- `useEffect` fetch from `/api/invoices/${id}`
- `mapApiToFormData(invoice)` (current logic, plus added `internalNotes` field)
- `viewerAccess.canManageActions` extraction

Replaces the current `<KeyboardMode {...invoiceForm} />` body and the sticky `<LazyProductSearchPanel>` with:

```tsx
<DocumentComposer
  composer={{ docType: "invoice", form: invoiceForm }}
  mode="edit"
  status={invoice.status}
  canManageActions={canManageActions}
  documentNumber={invoice.invoiceNumber}
/>
```

### `/quotes/[id]/edit/page.tsx`

Same treatment, plus passes `convertedToInvoice` so the header can show a "Converted to invoice INV-1234" pill (existing functionality preserved).

### Status-driven behavior

| Status | Approver slots | PrismCore upload | Save Draft button | Save as Template |
|---|---|---|---|---|
| DRAFT (manageable) | editable | available | shown | shown |
| FINALIZED (manageable) | read-only display | hidden | hidden | shown |
| Any status, not manageable | read-only | hidden | hidden | hidden |

Catalog drawer is available at any status if `canManageActions` is true.

## 11. Phase Plan

Eight phases, each green-CI shippable per `git:checkpoint` + Codex adversarial review. Each phase ends with localhost verification.

### P1 — Tokens + primitives (no UI swap)

- Add CSS tokens to globals.css (light + dark + 4 Catppuccin themes)
- Add `shadow-rail` utility
- Build `<SectionCard>`, `<StepBadge>`, `<DocTypeBadge>`, `<StatusPill>`, `<DensityToggle>`, `<ApproverSlotCard>` primitives
- Build `useDensity()`, `useSectionJump()` hooks
- Vitest tests for primitives + hooks
- **Verifies**: a temporary `/dev/composer-primitives` route or via tests only

### P2 — Validation engine + `<DocumentComposer>` shell

- Build `useComposerValidation(form, docType)` returning `{ blockers, checklist, readiness, totals }`
- Build `<ComposerHeader>`, `<ComposerLayout>`, `<DocumentComposer>` (empty workflow column, empty rail, drawer slots stubbed)
- Wire `/invoices/new` to the new composer with placeholder sections so the page loads. Old `KeyboardMode` still mounts on `/quotes/new` and edit pages.
- **Localhost verify**: `/invoices/new` renders the new shell with header + grid + rail card showing 0% readiness

### P3 — Sections 1–3 (People, Department, Document Details)

- Build the three section files, wire to existing form hooks
- Surface `semesterYearDept` in section 2
- Catering "more details" disclosure in section 3 (quote)
- **Localhost verify**: filling sections 1–3 advances readiness % and lights checklist items

### P4 — Section 4 (Items & Pricing) + new internal-notes plumbing

- Build `<LineItemsTable>` with density support, redesign visuals
- Build `<MarginCard>`, `<TaxCard>`
- **Persistence change**: add `internalNotes` to `pdfMetadata` JSON for invoice + quote (validators, service, mappers, edit-page hydrate). Excluded from PDF templates explicitly.
- **Localhost verify**: line-item editing, margin/tax toggles, density switching, totals updating

### P5 — Sections 5–6 (Notes + Approval/Output) + drawer plumbing

- Build `<NotesSection>` with public + internal textareas
- Build `<ApprovalOutputSection>` with three approver cards
- Wire action toolbar (Generate PDF, Save Draft, Save as Template, Print Register, PrismCore Upload)
- Build `<CatalogDrawer>` wrapping `<LazyProductSearchPanel>`. Remove old sticky-panel mounting.
- Build `<TemplatesDrawer>` (Load + Save). Extend `templateApi` if needed (additive).
- **Localhost verify**: full invoice flow on `/invoices/new` end-to-end including template save/load

### P6 — Right Summary Rail + Preview + Draft Restore

- Build `<SummaryRail>`, `<ReadinessCard>`, `<ChecklistCard>`, `<DraftStateCard>`, `<BlockerSummary>` banner
- Wire mobile collapse (`<BottomActionBar>` + summary bottom sheet)
- Build `<PreviewDrawer>`, extract `pdf-layout.ts` constants from `cover-sheet.ts`
- Build `<DraftRestoreBanner>` restyle
- **Localhost verify**: full invoice composer feature-complete; readiness, blockers, checklist navigation, preview, draft restore all working

### P7 — Quote variant

- Wire `/quotes/new` to `<DocumentComposer docType="quote">`. Section 1 recipient segmented control, section 3 catering rich block, section 6 quote toolbar (no approver slots, no PrismCore).
- Catering catalog preset → `openCatalog("Catering")`
- **Localhost verify**: full quote flow on `/quotes/new` including external recipient + catering details

### P8 — Edit pages + cleanup

- Wire `/invoices/[id]/edit` and `/quotes/[id]/edit` to `<DocumentComposer mode="edit">`
- Status-aware toolbar variants (FINALIZED, SENT, etc.)
- Read-only approver slots when finalized
- **Delete** `keyboard-mode.tsx`, `quote-mode.tsx`, sticky-panel mounting code
- Run full test suite + e2e for create + edit + status transitions
- **Localhost verify**: edit-existing-invoice and edit-existing-quote flows; status pill renders correctly; FINALIZED freezes the right things

### Per-phase quality gates

1. Plankton write-time quality (auto-format, lint via existing global hook)
2. `npm run lint` + `tsc --noEmit` clean
3. `npm test` 80%+ for new files
4. Localhost verify on `npm run dev` for the affected page
5. `npm run ship-check` + `npm run git:checkpoint` to update the draft PR
6. `/codex:adversarial-review` before any push that publishes the PR

## 12. Testing, Accessibility, Mobile

### Testing strategy (TDD + 80% coverage)

| Layer | Tests |
|---|---|
| `useComposerValidation` | unit — every blocker/checklist combo per doc type, edge cases (external recipient, isCatering, isRunning, finalized read-only) |
| Section components | RTL — render with mock form, verify error states, verify writes to `updateField` |
| `<LineItemsTable>` | RTL — density classes, error backgrounds, taxable toggle, margin override visualization, drag-grip a11y |
| `<ApproverSlotCard>` | RTL — required vs optional badge, two-of-three blocker derivation |
| Rail | RTL — readiness color states, blocker count, account callout positive/warn variants |
| Drawers | RTL — open/close, catalog "N selected", template save submit, preview rendering |
| Hooks (`useDensity`, `useSectionJump`) | unit — localStorage persistence, scroll + pulse mock |
| PDF skip-internal-notes | unit — assert cover-sheet HTML output excludes `internalNotes` content |
| E2E (Playwright) | new specs: create invoice end-to-end; create quote end-to-end with catering; edit existing invoice through finalize. Existing e2e specs continue to pass against the new UI. |

### Accessibility

- Every section has a heading (`<h2>`) at consistent level
- `<SectionCard>` uses `<section aria-labelledby={...}>`
- Step badges have `aria-label="Step N of 6, complete"` etc.
- Density toggle uses `role="radiogroup"`
- Drawer close has labeled icon button
- Color is never the sole signal: blockers use `<AlertTriangleIcon>`, completes use `<CheckIcon>`, status pills include text
- Inline errors connected to inputs via `aria-describedby`
- "Resolve N blockers" link has `aria-haspopup="dialog"` (opens blocker summary banner)
- Keyboard: Tab order follows section order, Enter inside line-item adds row (existing), Esc closes drawers

### Mobile responsive (`< 1024px`)

- Header Row 1 hides breadcrumb on `< sm`, keeps doc type + status pills
- Rail content moves below sections
- Readiness card primary action + grand total duplicate into `<BottomActionBar>` (sticky bottom)
- "Open summary" trigger in bottom bar opens `<Sheet side="bottom">` with full readiness + checklist + draft state
- Catalog drawer becomes `<Sheet side="bottom">` full-screen
- Templates and preview drawers also use bottom-sheet on mobile
- Section cards reduce to `p-4` instead of `p-[18px]`; sections stack to single column

### Deferred / explicitly out of scope

- Drag-to-reorder line items (visual grip handle present; no functional drag) — follow-up PR
- Real-time collaboration on the composer (no Supabase broadcast on the form itself)
- Auto-numbering preview for invoice number before save — stays server-assigned
- Theming variants beyond existing Catppuccin themes

### Risks

- **Regression on edit pages with in-flight drafts**: mitigated by P8 running full e2e + manual edit verification before deleting `KeyboardMode` / `QuoteMode`.
- **`templateApi` additive fields**: verify in P5; if needed, additive backend change with no migration (the templates table likely has a JSON column for items already).
- **`internalNotes` on `pdfMetadata`**: PDF generator must explicitly skip the key. P4 unit test asserts this.
- **Mobile layout has many moving parts**: the bottom-action-bar + summary-sheet pattern needs real device testing before P7 ships.

## 13. Files Changed

### New files

- `src/components/composer/document-composer.tsx`
- `src/components/composer/composer-header.tsx`
- `src/components/composer/composer-layout.tsx`
- `src/components/composer/types.ts`
- `src/components/composer/sections/section-card.tsx`
- `src/components/composer/sections/people-section.tsx`
- `src/components/composer/sections/department-account.tsx`
- `src/components/composer/sections/document-details.tsx`
- `src/components/composer/sections/items-pricing.tsx`
- `src/components/composer/sections/notes-section.tsx`
- `src/components/composer/sections/approval-output.tsx`
- `src/components/composer/rail/summary-rail.tsx`
- `src/components/composer/rail/readiness-card.tsx`
- `src/components/composer/rail/checklist-card.tsx`
- `src/components/composer/rail/draft-state-card.tsx`
- `src/components/composer/drawers/catalog-drawer.tsx`
- `src/components/composer/drawers/templates-drawer.tsx`
- `src/components/composer/drawers/preview-drawer.tsx`
- `src/components/composer/drawers/blocker-summary.tsx`
- `src/components/composer/primitives/approver-slot-card.tsx`
- `src/components/composer/primitives/density-toggle.tsx`
- `src/components/composer/primitives/status-pill.tsx`
- `src/components/composer/primitives/doc-type-badge.tsx`
- `src/components/composer/primitives/draft-restore-banner.tsx`
- `src/components/composer/primitives/bottom-action-bar.tsx`
- `src/components/composer/hooks/use-composer-validation.ts`
- `src/components/composer/hooks/use-approver-slots.ts`
- `src/components/composer/hooks/use-density.ts`
- `src/components/composer/hooks/use-section-jump.ts`
- `src/lib/pdf/pdf-layout.ts` (extracted constants)
- Test files mirroring each component / hook

### Modified files

- `src/app/globals.css` (token additions, all themes)
- `src/app/layout.tsx` (font loading verification, possibly)
- `src/app/invoices/new/page.tsx` (thin wrapper)
- `src/app/quotes/new/page.tsx` (thin wrapper)
- `src/app/invoices/[id]/edit/page.tsx` (thin wrapper, add `internalNotes` to mapApiToFormData)
- `src/app/quotes/[id]/edit/page.tsx` (thin wrapper, add `internalNotes`)
- `src/components/invoice/hooks/use-invoice-form-state.ts` (add `internalNotes` to form state)
- `src/components/invoice/hooks/use-invoice-save.ts` (include `internalNotes` in payload via `pdfMetadata.internalNotes`, same pattern as `signatures` / `signatureStaffIds`)
- `src/components/quote/quote-form.ts` (add `internalNotes` field to QuoteFormData; in `buildPayload`, add `pdfMetadata: { internalNotes: form.internalNotes }`)
- `src/lib/validators.ts`:
  - `invoiceCreateSchema.pdfMetadata`: additive `internalNotes: z.string().optional()` inside the existing z.object (matches `signatures` / `signatureStaffIds` pattern)
  - `quoteCreateSchema`: new top-level `pdfMetadata: z.object({ internalNotes: z.string().optional() }).optional()` (quote validator currently has no `pdfMetadata` block — adding it)
- `src/domains/invoice/service.ts` (extend `pdfMetadata` merge to include `internalNotes`)
- `src/domains/quote/service.ts` (add new `pdfMetadata` merge logic patterned after invoice service)
- `src/lib/pdf/templates/cover-sheet.ts` (consume shared layout constants)
- `src/domains/template/types.ts` (additive fields if missing)

### Deleted files (P8)

- `src/components/invoice/keyboard-mode.tsx`
- `src/components/quote/quote-mode.tsx`
- `src/components/shared/lazy-product-search-panel.tsx` mounting code in pages (the component itself stays — it's used inside the catalog drawer)

## 14. References

- Source brief: `LAPortal-3.zip → composer-redesign/HANDOFF.md`
- Prototype: `/tmp/composer-redesign/{index.html,app.jsx,data.jsx,drawers.jsx,line-items.jsx,rail.jsx,tweaks-panel.jsx,ui.jsx}`
- Existing related specs:
  - `docs/superpowers/specs/2026-03-26-keyboard-first-invoice-creation-design.md`
  - `docs/superpowers/specs/2026-03-26-quote-creation-design.md`
  - `docs/superpowers/specs/2026-04-16-product-search-integration-design.md`
  - `docs/superpowers/specs/2026-04-16-register-print-design.md`
  - `docs/superpowers/specs/2026-03-27-domain-module-architecture-design.md`
