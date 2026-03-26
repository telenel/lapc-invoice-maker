# Keyboard-First Invoice Creation — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Problem

The current Quick Mode invoice creation form has tab-order issues that make keyboard-only use frustrating:

- Two-column card layout causes Tab to jump left-to-right across columns instead of top-to-bottom
- Popover-based dropdowns (staff select, signature select) trap focus — must Escape or click to exit
- Non-essential elements (hints, edit buttons, bookmark icons) pollute the tab order
- Weak focus indicators make it hard to track which field is active
- Auto-filled fields that rarely need editing still require tabbing through

## Solution

Build a new **Keyboard Mode** (`keyboard-mode.tsx`) as the primary invoice creation experience. It reuses the existing `useInvoiceForm` hook for all state management and API logic, but provides a new layout and interaction model optimized for keyboard-only entry.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Flat single-column | Tab order = visual order, no column jumps |
| Staff/Signature select | Inline combobox (no popover) | Tab/Enter selects and moves on, never traps focus |
| Auto-filled fields | Read-only text, out of tab order | Skip what doesn't need editing; click to edit if needed |
| Account Number & Code | In tab order | These are rarely auto-populated and need manual entry |
| Focus style | Bold ring + subtle background tint | Clear visual feedback, scoped to keyboard mode |
| Shortcut | Ctrl+Enter (Cmd+Enter Mac) | Generate PDF from any field |
| Approach | New component alongside existing modes | Build/test independently, no risk to current users |

## Component 1: Inline Combobox (`src/components/ui/inline-combobox.tsx`)

A generic combobox component that replaces popover-based selects. Used for staff, signatures, category, and account number selection.

### Props

```typescript
interface InlineComboboxProps {
  items: { id: string; label: string; sublabel?: string; searchValue?: string }[]
  value: string                    // selected item id
  onSelect: (item) => void
  placeholder?: string
  displayValue?: string            // shown when an item is selected
  className?: string
  loading?: boolean
}
```

### Behavior

- Renders as a plain `<input>` — participates in normal tab flow
- On focus or typing, a suggestion dropdown appears below (absolutely positioned, not a portal)
- Filters items as user types (fuzzy match on label, sublabel, searchValue)
- First match is auto-highlighted
- **Arrow Up/Down** navigates suggestions
- **Tab or Enter** accepts the highlighted suggestion, closes dropdown, advances focus
- **Escape** closes dropdown without selecting
- **Blur** with partial match auto-accepts top match

### Wrappers

- `StaffInlineSelect` — fetches from `/api/staff`, maps to combobox interface, triggers auto-fill on select
- `SignatureInlineSelect` — fetches from `/api/staff`, maps to combobox, used for the 3 signature lines
- Category and Account Number use the generic combobox directly with their respective data sources

## Component 2: Keyboard Mode Layout (`src/components/invoice/keyboard-mode.tsx`)

Single-column form using the existing `useInvoiceForm` hook.

### Tab Order (= Visual Order)

| # | Field | Type | Notes |
|---|-------|------|-------|
| 1 | Staff Member | Inline combobox | Auto-fills dept, ext, email, phone, signatures |
| 2 | Account Number | Inline combobox | Shows recent numbers for staff; new number triggers description save |
| 3 | Account Code | Text input | Rarely auto-filled |
| 4 | Invoice Number | Text input | Required |
| 5 | Date | Date input | Defaults to today |
| 6 | Category | Inline combobox | Required |
| 7 | Semester/Year/Dept | Text input | Optional |
| 8+ | Line Items | Desc → Qty → Price per row | Tab/Enter adds new row from last row |
| N | Notes | Textarea | Optional |
| N+1 | Signature 1 | Inline combobox | Auto-filled from signer history |
| N+2 | Signature 2 | Inline combobox | Auto-filled from signer history |
| N+3 | Signature 3 | Inline combobox | Auto-filled from signer history |
| Last | Generate PDF button | Button | Ctrl+Enter shortcut |

### Out of Tab Order

These are displayed as a **read-only summary row** below the staff field after selection:

```
Workforce Development · ext. 4201 · jane@lapc.edu · (213) 555-0100
```

- Department
- Extension
- Email
- Phone

Clicking any value makes it editable inline. They use `tabIndex={-1}`.

Also out of tab order:
- Edit Staff button (`tabIndex={-1}`)
- Hint dismiss buttons (`tabIndex={-1}`)
- Line item bookmark/save buttons (`tabIndex={-1}`)
- Extended price cells (read-only)
- Save Draft button (accessible by click, not in tab flow)

### Section Dividers

Light horizontal rules with small uppercase labels instead of cards:

- **STAFF** — staff combobox + auto-filled summary
- **INVOICE** — account number, account code, invoice #, date, category, semester
- **LINE ITEMS** — item rows + notes
- **SIGNATURES** — 3 signature comboboxes
- Action buttons at bottom

### Account Number — New Entry Flow

When the user types a number that doesn't match existing account numbers:

1. Combobox shows "Add new: [typed value]" as a suggestion
2. Selecting it accepts the number and reveals an inline description field below
3. User types a description (e.g. "ASB Fund, Grant #1234")
4. Tab moves on — the account number + description are saved to the database via the existing API

## Component 3: Focus Styles

Scoped CSS additions for keyboard mode.

```css
.keyboard-mode input:focus-visible,
.keyboard-mode textarea:focus-visible,
.keyboard-mode [role="combobox"]:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px oklch(from var(--ring) l c h / 0.15);
  background-color: oklch(from var(--ring) l c h / 0.04);
  transition: border-color 150ms, box-shadow 150ms, background-color 150ms;
}
```

- Derived from `--ring` CSS variable so it works across all themes (light, dark, catppuccin)
- Scoped to `.keyboard-mode` to avoid affecting other pages
- Read-only auto-filled fields get no focus ring; hover shows `cursor: pointer` to indicate editability

## Component 4: Keyboard Shortcut

- **Ctrl+Enter** (Windows/Linux) / **Cmd+Enter** (Mac) triggers Generate PDF
- Implemented as a `useEffect` keydown listener on the form container
- Detects `(e.metaKey || e.ctrlKey) && e.key === "Enter"`
- Calls existing `handleFinalize` from `useInvoiceForm`
- Same validation as button click — if validation fails, focus moves to first invalid field with toast
- Button label shows platform-aware hint: `Generate PDF ⌘↵` or `Generate PDF Ctrl↵`

## Integration

- Added as a new tab option on `/invoices/new` alongside Wizard and Quick modes
- Made the default mode (tab renders first, selected by default)
- Shares `useInvoiceForm` hook — no state/API changes needed
- Existing Wizard Mode and Quick Mode remain unchanged
- Quick Pick Panel is available as a collapsible section above line items. Collapsed by default (out of tab order). Click the "Quick Picks" toggle to expand. When expanded, quick pick buttons are focusable. Clicking a quick pick adds a line item row pre-filled with that item's description and price, same as current behavior.

## What This Does NOT Change

- API routes — no backend changes
- `useInvoiceForm` hook — no state logic changes
- Wizard Mode — untouched
- Quick Mode — untouched (can be removed later once Keyboard Mode is validated)
- PDF generation flow — same progress modal and finalize endpoint
- Database schema — no changes
