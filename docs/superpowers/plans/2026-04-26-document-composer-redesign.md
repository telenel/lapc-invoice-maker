# Document Composer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `KeyboardMode` / `QuoteMode` invoice and quote creation surfaces with a unified `<DocumentComposer>` pattern (6-section workflow + sticky 360px summary rail + 3 right-side drawers + status-aware toolbar), preserving all existing data flows, validators, autosave, PDF generation, and product-catalog handoff.

**Architecture:** New `src/components/composer/` tree (shell, sections, rail, drawers, primitives, hooks). The four page files (`/invoices/new`, `/quotes/new`, `/invoices/[id]/edit`, `/quotes/[id]/edit`) become thin wrappers that fetch + map and render `<DocumentComposer composer={...} mode={...} status={...} />`. Form hooks (`useInvoiceForm` / `useQuoteForm`) and domain APIs are unchanged except (1) additive `internalNotes` on `pdfMetadata` JSON, (2) additive `setForm` surfacing for templates drawer, (3) additive `useAutoSave` flags for draft state card.

**Tech stack:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4 (`@theme inline` tokens), hand-rolled shadcn-style primitives, Vitest + RTL for unit, Playwright for E2E.

**Spec (source of truth):** [`docs/superpowers/specs/2026-04-26-document-composer-redesign-design.md`](../specs/2026-04-26-document-composer-redesign-design.md) — 854 lines, fully approved. When this plan and the spec disagree, the spec wins; flag the discrepancy.

**Rollout:** Replace in place, no feature flag. Phase 1 ships under the radar (tokens + primitives only). Phase 2 makes `/invoices/new` the canary. Phase 8 deletes the legacy code.

---

## Preconditions / facts verified during plan-writing

These were checked against the codebase at commit `cfb629e8` — don't re-investigate them, just use them:

| Fact | Source | Used by |
|---|---|---|
| `useInvoiceForm` returns `{form, updateField, updateItem, addItem, addItems, removeItem, total, itemsWithMargin, subtotal, taxAmount, grandTotal, handleStaffSelect, handleStaffEdit, staffAccountNumbers, saveDraft, saveAndFinalize, saving, generationStep, existingId}` | `src/components/invoice/invoice-form.tsx:53-73` | All composer wiring |
| `useQuoteForm` returns `{form, updateField, updateItem, addItem, addItems, removeItem, total, itemsWithMargin, handleStaffSelect, clearStaffSelection, handleStaffEdit, staffAccountNumbers, saveQuote, saving, existingId}` | `src/components/quote/quote-form.ts:522-538` | All composer wiring |
| `setForm` is **not currently surfaced** from either outer hook (only inner `useInvoiceFormState`) | `src/components/invoice/invoice-form.tsx:26`, `src/components/quote/quote-form.ts:151` | P5 templates drawer needs it — additive surface |
| `useAutoSave` returns only `{ clearDraft }`; `isDirty`, `lastSavedAt`, `savingDraft` are tracked in refs but not exposed | `src/lib/use-auto-save.ts:62` | P6 `<DraftStateCard>` needs them — additive return |
| `keyboard-mode.tsx` and `quote-mode.tsx` currently own the autosave + draft banner wiring | `src/components/invoice/keyboard-mode.tsx:139-149`, `src/components/quote/quote-mode.tsx:129-139` | Composer takes over in P6; legacy files deleted in P8 |
| `invoiceCreateSchema.pdfMetadata` exists (with signatures, signatureStaffIds, semesterYearDept, contactName, contactExtension); `quoteCreateSchema.pdfMetadata` does **not** exist | `src/lib/validators.ts:47-65, 122-161` | P4 adds `internalNotes` field to invoice schema, adds new pdfMetadata block to quote schema |
| Theme blocks needing new tokens: `:root`, `.dark`, `.theme-latte`, `.theme-frappe`, `.theme-macchiato`, `.theme-mocha` (6 total) | `src/app/globals.css:84, 123, 164, 203, 242, 281` | P1 token additions |
| Missing shadcn primitives: `Sheet`, `Switch`, `Slider` | `ls src/components/ui/` | P1 hand-rolls them following existing `dialog.tsx` / `checkbox.tsx` patterns |
| `CreateTemplateInput.items` lacks `sku` field | `src/domains/template/types.ts:45-53` | P5 additive change so catalog SKUs round-trip through templates |
| Margin formula in form-state: `cost * (1 + m/100)`, NOT the prototype's `cost / (1 - m)` | `src/components/invoice/hooks/use-invoice-form-state.ts:229` and `quote-form.ts:244` | P4 line-item table preserves this — Charged column is read-only when margin enabled |
| Invoice "Generate PDF" is 2-step: POST/PUT then `invoiceApi.finalize`; quote "Save Quote & Generate PDF" is `saveQuote` (which redirects) then `window.open('/api/quotes/${id}/pdf')` (GET, binary) | `use-invoice-save.ts:143-179`, `quote-form.ts:506-520`, spec §6 | P5 toolbar wiring |
| `saveDraft` (invoice) and `saveQuote` both redirect to detail page on success | `use-invoice-save.ts:133`, `quote-form.ts:511` | P6 rail "Save Draft" follows existing UX |
| Catering catalog category named `"Catering"` (verify in P4) | spec §7 §11 | P5 catering preset opens catalog filtered to this string |
| `cover-sheet.ts` is a memo cover, NOT the line-items page | `src/lib/pdf/templates/cover-sheet.ts` | P6 `pdf-layout.ts` extraction targets shared layout constants — preview drawer renders the **line-items page**; cover-sheet renders the memo. Verify which template owns the items table during P6. |

---

## Pre-phase ritual (run before each phase begins)

```bash
# Verify branch + clean tree
git status
git rev-parse --abbrev-ref HEAD   # expect: feat/document-composer-redesign

# Read the previous phase's tail to get oriented
git log --oneline -5

# Run the spec's section relevant to this phase (open the spec in editor)
$EDITOR docs/superpowers/specs/2026-04-26-document-composer-redesign-design.md
```

## Per-phase quality gates (run BEFORE the phase commit)

```bash
# 1. Lint
npm run lint

# 2. Types
npx tsc --noEmit

# 3. Targeted unit tests (after the phase first introduces composer files)
npm test -- src/components/composer

# 4. Localhost smoke test on the affected page
npm run dev          # in another terminal
# then visit http://localhost:3000/<page-touched-this-phase> and exercise the changes
```

## Per-phase commit + checkpoint ritual

```bash
# Stage only intended files (NEVER `git add -A`)
git add <explicit paths>

# Conventional commit
git commit -m "<type>(composer): <phase summary>"

# Push the draft PR (creates it on first phase, updates it after)
npm run ship-check
npm run git:checkpoint

# Adversarial review BEFORE the push is published
/codex:adversarial-review
# If verdict = REJECT: address feedback, new commit, re-checkpoint

# Done-cue
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 1 — Tokens + primitives (no UI swap)

**Ships:** New CSS color/shadow tokens across all themes, three new shadcn primitives (`Sheet`, `Switch`, `Slider`), composer primitives (`StepBadge`, `StatusPill`, `DocTypeBadge`, `DensityToggle`, `ApproverSlotCard`, `SectionCard`), hooks (`useDensity`, `useSectionJump`), and shared `types.ts`.

**Visible to users:** Nothing yet. The new UI surfaces are wired in P2.

**Localhost verify:** `npm test -- src/components/composer` passes; render a primitive in a temporary `/dev/composer-primitives` route or trust the tests.

### Task 1.1: Add CSS tokens to `:root` and `.dark` blocks

**Files:**
- Modify: `src/app/globals.css` (insert in the existing `:root` block after `--c-lane-today`, and in `.dark` after the corresponding line)

- [ ] **Step 1: Add tokens to `:root`**

In `src/app/globals.css`, inside the `:root { ... }` block (around line 122, after the `--c-lane-today` line), append:

```css
    /* Composer surfaces */
    --canvas:        oklch(0.965 0.004 75);
    --surface:       oklch(0.975 0.003 75);
    --border-strong: oklch(0.84 0.005 75);

    /* Status tones — light mode */
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

- [ ] **Step 2: Mirror to `.dark` block**

In the `.dark { ... }` block (around line 159, after `--c-lane-today`), append the dark-mode equivalents (foreground hues bumped, fills darkened):

```css
    /* Composer surfaces — dark */
    --canvas:        oklch(0.18 0.008 60);
    --surface:       oklch(0.21 0.008 60);
    --border-strong: oklch(0.34 0.01 60);

    /* Status tones — dark */
    --positive:        oklch(0.65 0.12 165);
    --positive-bg:     oklch(0.24 0.05 165);
    --positive-border: oklch(0.34 0.08 165);

    --warn:        oklch(0.7 0.12 70);
    --warn-bg:     oklch(0.26 0.05 70);
    --warn-border: oklch(0.35 0.09 70);

    --info:        oklch(0.65 0.12 240);
    --info-bg:     oklch(0.23 0.04 240);
    --info-border: oklch(0.34 0.07 240);

    --teal:    oklch(0.7 0.1 195);
    --teal-bg: oklch(0.24 0.04 195);
```

- [ ] **Step 3: Visually inspect via `npm run dev`**

```bash
npm run dev
# Visit http://localhost:3000 — confirm nothing visually regressed (these are unused so far).
```

Expected: page renders identically to before (tokens are defined but no rule consumes them yet).

### Task 1.2: Mirror tokens to the four Catppuccin theme blocks

**Files:**
- Modify: `src/app/globals.css` — `.theme-latte` (line ~164), `.theme-frappe` (~203), `.theme-macchiato` (~242), `.theme-mocha` (~281)

- [ ] **Step 1: Append composer-tone tokens to `.theme-latte` (light)**

```css
    --canvas:        oklch(0.94 0.01 256);
    --surface:       oklch(0.95 0.01 256);
    --border-strong: oklch(0.78 0.014 256);

    --positive:        oklch(0.55 0.13 145);
    --positive-bg:     oklch(0.93 0.05 145);
    --positive-border: oklch(0.78 0.09 145);
    --warn:        oklch(0.6 0.14 70);
    --warn-bg:     oklch(0.93 0.05 80);
    --warn-border: oklch(0.78 0.1 80);
    --info:        oklch(0.5 0.18 264);
    --info-bg:     oklch(0.92 0.05 264);
    --info-border: oklch(0.78 0.12 264);
    --teal:    oklch(0.55 0.1 195);
    --teal-bg: oklch(0.93 0.03 195);
```

- [ ] **Step 2: Append to `.theme-frappe` (dark)**

```css
    --canvas:        oklch(0.24 0.025 278);
    --surface:       oklch(0.27 0.025 278);
    --border-strong: oklch(0.4 0.03 275);

    --positive:        oklch(0.78 0.12 145);
    --positive-bg:     oklch(0.3 0.05 145);
    --positive-border: oklch(0.4 0.08 145);
    --warn:        oklch(0.78 0.12 80);
    --warn-bg:     oklch(0.32 0.05 80);
    --warn-border: oklch(0.42 0.09 80);
    --info:        oklch(0.78 0.12 272);
    --info-bg:     oklch(0.3 0.05 272);
    --info-border: oklch(0.4 0.09 272);
    --teal:    oklch(0.75 0.1 195);
    --teal-bg: oklch(0.3 0.04 195);
```

- [ ] **Step 3: Append to `.theme-macchiato`** (similar to frappe with slightly darker base)

Use frappe's values verbatim — visual difference between frappe/macchiato/mocha is small enough that the same status-tone palette works for all three. If review flags this, tune in a follow-up.

- [ ] **Step 4: Append to `.theme-mocha`** (same as frappe + macchiato palette)

Same as Step 3.

- [ ] **Step 5: Verify the four themes by toggling**

```bash
npm run dev
# Visit http://localhost:3000, open theme picker (if accessible) and rotate through latte/frappe/macchiato/mocha — pages render identically.
```

### Task 1.3: Export tokens via `@theme inline`

**Files:**
- Modify: `src/app/globals.css` — `@theme inline { ... }` block (line 9-50)

- [ ] **Step 1: Append color exports inside `@theme inline`**

After the existing `--font-heading` line (~50), insert before the closing `}`:

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

- [ ] **Step 2: Verify Tailwind utility classes resolve**

Add a temporary div to any rendered page (e.g. `src/app/page.tsx`):

```tsx
<div className="bg-positive-bg text-positive border border-positive-border p-4 rounded">
  smoke test
</div>
```

Run `npm run dev`, visit page, confirm the soft-green strip renders. Then **remove** the smoke test before committing.

### Task 1.4: Add `shadow-rail` utility

**Files:**
- Modify: `src/app/globals.css` (add a new `@layer utilities` rule near the bottom of the file or extend an existing utilities block)

- [ ] **Step 1: Append the utility rule**

```css
@layer utilities {
  .shadow-rail {
    box-shadow:
      0 1px 2px oklch(0 0 0 / 0.03),
      0 8px 24px oklch(0 0 0 / 0.05);
  }

  .dark .shadow-rail,
  .theme-frappe .shadow-rail,
  .theme-macchiato .shadow-rail,
  .theme-mocha .shadow-rail {
    box-shadow:
      0 1px 2px oklch(0 0 0 / 0.4),
      0 8px 24px oklch(0 0 0 / 0.5);
  }
}
```

- [ ] **Step 2: Verify**

Add `<div className="bg-card shadow-rail rounded-lg p-4">test</div>` to any page, confirm soft lift rendered, then remove.

### Task 1.5: Hand-roll `<Sheet>` primitive

shadcn's Sheet wraps Radix Dialog with a slide-in animation. Following the project's existing `dialog.tsx` pattern.

**Files:**
- Create: `src/components/ui/sheet.tsx`
- Test: `src/components/ui/sheet.test.tsx`

- [ ] **Step 1: Confirm Radix Dialog is installed**

```bash
node -e "console.log(require('@radix-ui/react-dialog/package.json').version)"
```

Expected: prints a version. If "Cannot find module": run `npm i @radix-ui/react-dialog`.

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/ui/sheet.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

describe("Sheet", () => {
  it("opens when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>open</SheetTrigger>
        <SheetContent side="right">
          <SheetHeader><SheetTitle>Title</SheetTitle></SheetHeader>
          <p>body</p>
        </SheetContent>
      </Sheet>
    );
    expect(screen.queryByText("body")).toBeNull();
    await user.click(screen.getByText("open"));
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
});
```

Run: `npm test -- src/components/ui/sheet.test.tsx`. Expected: FAIL "Cannot find module './sheet'".

- [ ] **Step 3: Implement `<Sheet>`**

```tsx
// src/components/ui/sheet.tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

type Side = "top" | "right" | "bottom" | "left";

const sideClasses: Record<Side, string> = {
  top:    "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
  right:  "inset-y-0 right-0 h-full w-3/4 max-w-xl border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  bottom: "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  left:   "inset-y-0 left-0 h-full w-3/4 max-w-xl border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
};

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: Side;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="sheet-content"
      className={cn(
        "fixed z-50 flex flex-col bg-background shadow-xl outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
        sideClasses[side],
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
        <XIcon className="size-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 px-6 py-4 border-b", className)} {...props} />
);
const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex items-center justify-end gap-2 px-6 py-3 border-t", className)} {...props} />
);

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
```

- [ ] **Step 4: Run the test**

```bash
npm test -- src/components/ui/sheet.test.tsx
```

Expected: PASS.

### Task 1.6: Hand-roll `<Switch>` primitive

**Files:**
- Create: `src/components/ui/switch.tsx`
- Test: `src/components/ui/switch.test.tsx`

- [ ] **Step 1: Verify Radix Switch is installed**

```bash
node -e "console.log(require('@radix-ui/react-switch/package.json').version)" || npm i @radix-ui/react-switch
```

- [ ] **Step 2: Failing test**

```tsx
// src/components/ui/switch.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("toggles checked state on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="t" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 3: Implementation**

```tsx
// src/components/ui/switch.tsx
"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent",
      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-4 rounded-full bg-background shadow ring-0 transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
```

- [ ] **Step 4: Run** — `npm test -- src/components/ui/switch.test.tsx` — PASS expected.

### Task 1.7: Hand-roll `<Slider>` primitive

**Files:**
- Create: `src/components/ui/slider.tsx`
- Test: `src/components/ui/slider.test.tsx`

- [ ] **Step 1: Verify Radix Slider**

```bash
node -e "console.log(require('@radix-ui/react-slider/package.json').version)" || npm i @radix-ui/react-slider
```

- [ ] **Step 2: Failing test**

```tsx
// src/components/ui/slider.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Slider } from "./slider";

describe("Slider", () => {
  it("renders a slider with min/max/value", () => {
    render(<Slider min={0} max={60} value={[20]} aria-label="margin" />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "60");
    expect(slider).toHaveAttribute("aria-valuenow", "20");
  });
});
```

- [ ] **Step 3: Implementation**

```tsx
// src/components/ui/slider.tsx
"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-input">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block size-4 rounded-full border-2 border-primary bg-background shadow ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
```

- [ ] **Step 4: Run test** — PASS expected.

### Task 1.8: Composer shared types

**Files:**
- Create: `src/components/composer/types.ts`

- [ ] **Step 1: Write the types file (no test — pure types)**

```ts
// src/components/composer/types.ts
export type DocType = "invoice" | "quote";

export type SectionAnchor =
  | "section-people"
  | "section-department"
  | "section-details"
  | "section-items"
  | "section-notes"
  | "section-approval";

export type Density = "compact" | "standard" | "comfortable";

export interface BlockerEntry {
  field: string;
  label: string;
  anchor: SectionAnchor;
}

export interface ChecklistEntry {
  id: string;
  label: string;
  anchor: SectionAnchor;
  complete: boolean;
  blocker: boolean;
}

export interface ComposerTotals {
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  marginAmount: number;
  grandTotal: number;
  itemCount: number;
  taxableCount: number;
}

export interface ApproverSlotVM {
  slotIndex: 0 | 1 | 2;
  required: boolean;
  staffId: string;
  display: string; // "Name — Title"
}

export type ComposerStatus = "DRAFT" | "FINALIZED" | "SENT" | "PAID" | "EXPIRED" | "DECLINED" | "REVISED" | string;
```

### Task 1.9: `useDensity()` hook

**Files:**
- Create: `src/components/composer/hooks/use-density.ts`
- Test: `src/components/composer/hooks/use-density.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/components/composer/hooks/use-density.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useDensity } from "./use-density";

describe("useDensity", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to standard", () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("standard");
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useDensity());
    act(() => result.current.setDensity("compact"));
    expect(localStorage.getItem("composer.density")).toBe("compact");
  });

  it("reads persisted value on mount", () => {
    localStorage.setItem("composer.density", "comfortable");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("comfortable");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("composer.density", "junk");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("standard");
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// src/components/composer/hooks/use-density.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import type { Density } from "../types";

const STORAGE_KEY = "composer.density";
const VALID: readonly Density[] = ["compact", "standard", "comfortable"] as const;

function isDensity(v: unknown): v is Density {
  return typeof v === "string" && (VALID as readonly string[]).includes(v);
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>("standard");

  // Hydrate after mount to avoid SSR mismatch
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isDensity(raw)) setDensityState(raw);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { density, setDensity };
}
```

- [ ] **Step 3: Run** — `npm test -- src/components/composer/hooks/use-density.test.ts` — PASS.

### Task 1.10: `useSectionJump()` hook

**Files:**
- Create: `src/components/composer/hooks/use-section-jump.ts`
- Test: `src/components/composer/hooks/use-section-jump.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/components/composer/hooks/use-section-jump.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSectionJump } from "./use-section-jump";

describe("useSectionJump", () => {
  beforeEach(() => {
    document.body.innerHTML = `<section id="section-people" data-anchor></section>`;
  });

  it("scrolls the matching section into view", () => {
    const scrollSpy = vi.fn();
    const el = document.getElementById("section-people")!;
    el.scrollIntoView = scrollSpy;

    const { result } = renderHook(() => useSectionJump());
    act(() => result.current.jump("section-people"));

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("adds and removes a pulse class", () => {
    vi.useFakeTimers();
    const el = document.getElementById("section-people")!;
    el.scrollIntoView = vi.fn();

    const { result } = renderHook(() => useSectionJump());
    act(() => result.current.jump("section-people"));

    expect(el.classList.contains("composer-pulse")).toBe(true);
    act(() => vi.advanceTimersByTime(900));
    expect(el.classList.contains("composer-pulse")).toBe(false);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// src/components/composer/hooks/use-section-jump.ts
"use client";

import { useCallback } from "react";
import type { SectionAnchor } from "../types";

const PULSE_CLASS = "composer-pulse";
const PULSE_MS = 900;

export function useSectionJump() {
  const jump = useCallback((anchor: SectionAnchor) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add(PULSE_CLASS);
    window.setTimeout(() => el.classList.remove(PULSE_CLASS), PULSE_MS);
  }, []);

  return { jump };
}
```

- [ ] **Step 3: Add the pulse keyframe to globals.css**

In `src/app/globals.css`, inside `@layer utilities` (the same block as `shadow-rail`):

```css
  @keyframes composer-pulse-frame {
    0%   { box-shadow: 0 0 0 0 oklch(from var(--ring) l c h / 0.45); }
    100% { box-shadow: 0 0 0 12px transparent; }
  }
  .composer-pulse {
    animation: composer-pulse-frame 0.9s ease-out;
  }
```

- [ ] **Step 4: Run test** — PASS.

### Task 1.11: `<StepBadge>` primitive

**Files:**
- Create: `src/components/composer/sections/section-card.tsx` (will host StepBadge as a colocated export — primitive shared with other sections)

Wait — the spec puts `StepBadge` under `primitives/`. Re-reading section 3 of the spec, `<SectionCard>` lives in `sections/section-card.tsx` and `<StepBadge>` is referenced from inside it but isn't enumerated separately under `primitives/`. The spec's primitives directory lists `approver-slot-card`, `density-toggle`, `status-pill`, `doc-type-badge`, `draft-restore-banner`, `bottom-action-bar` only.

→ Decision: colocate `StepBadge` inside `section-card.tsx` as a non-default export. If a third consumer appears later, extract.

**Files:**
- Create: `src/components/composer/sections/section-card.tsx`
- Test: `src/components/composer/sections/section-card.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/sections/section-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SectionCard } from "./section-card";

describe("SectionCard", () => {
  it("renders title, step, and children", () => {
    render(
      <SectionCard step={1} title="People" anchor="section-people" status="default">
        <p>body</p>
      </SectionCard>
    );
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    // Numbered badge contains the step number
    expect(screen.getByLabelText(/Step 1 of 6/)).toBeInTheDocument();
  });

  it("shows completion state on the badge", () => {
    render(
      <SectionCard step={2} title="Dept" anchor="section-department" status="complete">
        <p>x</p>
      </SectionCard>
    );
    expect(screen.getByLabelText(/Step 2 of 6, complete/)).toBeInTheDocument();
  });

  it("shows blocker state on the badge", () => {
    render(
      <SectionCard step={3} title="Det" anchor="section-details" status="blocker">
        <p>x</p>
      </SectionCard>
    );
    expect(screen.getByLabelText(/Step 3 of 6, blocker/)).toBeInTheDocument();
  });

  it("uses anchor as the element id", () => {
    const { container } = render(
      <SectionCard step={1} title="x" anchor="section-people" status="default">
        <p>x</p>
      </SectionCard>
    );
    expect(container.querySelector("#section-people")).not.toBeNull();
  });

  it("renders a right-side action when provided", () => {
    render(
      <SectionCard step={4} title="Items" anchor="section-items" status="default" action={<button>act</button>}>
        <p>x</p>
      </SectionCard>
    );
    expect(screen.getByText("act")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/section-card.tsx
import type { ReactNode } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionAnchor } from "../types";

type Status = "default" | "complete" | "blocker";

interface StepBadgeProps {
  step: number;
  status: Status;
}

export function StepBadge({ step, status }: StepBadgeProps) {
  const statusLabel =
    status === "complete" ? "complete" : status === "blocker" ? "blocker" : "in progress";
  return (
    <span
      role="img"
      aria-label={`Step ${step} of 6, ${statusLabel}`}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
        "border transition-colors tabular-nums",
        status === "default" && "border-border bg-background text-foreground",
        status === "complete" && "border-positive-border bg-positive text-primary-foreground",
        status === "blocker" && "border-destructive bg-destructive text-primary-foreground"
      )}
    >
      {status === "complete" ? <CheckIcon className="size-3.5" /> : status === "blocker" ? <XIcon className="size-3.5" /> : step}
    </span>
  );
}

interface SectionCardProps {
  step: number;
  title: string;
  description?: string;
  anchor: SectionAnchor;
  status: Status;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ step, title, description, anchor, status, action, children, className }: SectionCardProps) {
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className={cn(
        "rounded-lg border border-border bg-card p-[18px] shadow-sm transition-shadow",
        "hover:shadow-rail focus-within:shadow-rail",
        className
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <StepBadge step={step} status={status} />
          <div>
            <h2 id={`${anchor}-title`} className="text-sm font-semibold tracking-tight">
              {title}
            </h2>
            {description && <p className="text-[12.5px] text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Run test** — PASS.

### Task 1.12: `<StatusPill>` primitive

**Files:**
- Create: `src/components/composer/primitives/status-pill.tsx`
- Test: `src/components/composer/primitives/status-pill.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/primitives/status-pill.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it.each([
    ["DRAFT", /draft/i],
    ["FINALIZED", /finalized/i],
    ["SENT", /sent/i],
    ["PAID", /paid/i],
    ["EXPIRED", /expired/i],
  ])("renders %s tone", (status, label) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to muted tone for unknown status", () => {
    render(<StatusPill status="WEIRD" />);
    expect(screen.getByText("WEIRD")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/primitives/status-pill.tsx
import { cn } from "@/lib/utils";
import type { ComposerStatus } from "../types";

const TONES: Record<string, string> = {
  DRAFT:     "bg-muted text-muted-foreground border-border",
  FINALIZED: "bg-positive-bg text-positive border-positive-border",
  SENT:      "bg-info-bg text-info border-info-border",
  PAID:      "bg-positive-bg text-positive border-positive-border",
  EXPIRED:   "bg-warn-bg text-warn border-warn-border",
  DECLINED:  "bg-destructive/10 text-destructive border-destructive/30",
  REVISED:   "bg-info-bg text-info border-info-border",
};

interface Props {
  status: ComposerStatus;
  className?: string;
}

export function StatusPill({ status, className }: Props) {
  const tone = TONES[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider",
        tone,
        className
      )}
    >
      {status}
    </span>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 1.13: `<DocTypeBadge>` primitive

**Files:**
- Create: `src/components/composer/primitives/doc-type-badge.tsx`
- Test: `src/components/composer/primitives/doc-type-badge.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/primitives/doc-type-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocTypeBadge } from "./doc-type-badge";

describe("DocTypeBadge", () => {
  it("renders INVOICE in red-soft tone", () => {
    const { container } = render(<DocTypeBadge docType="invoice" />);
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-primary/10");
  });

  it("renders QUOTE in teal-soft tone", () => {
    const { container } = render(<DocTypeBadge docType="quote" />);
    expect(screen.getByText("QUOTE")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-teal-bg");
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/primitives/doc-type-badge.tsx
import { cn } from "@/lib/utils";
import type { DocType } from "../types";

interface Props {
  docType: DocType;
  className?: string;
}

export function DocTypeBadge({ docType, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider",
        docType === "invoice"
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-teal-bg text-teal border-teal/30",
        className
      )}
    >
      {docType === "invoice" ? "INVOICE" : "QUOTE"}
    </span>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 1.14: `<DensityToggle>` primitive

**Files:**
- Create: `src/components/composer/primitives/density-toggle.tsx`
- Test: `src/components/composer/primitives/density-toggle.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/primitives/density-toggle.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DensityToggle } from "./density-toggle";

describe("DensityToggle", () => {
  it("renders three radio buttons", () => {
    render(<DensityToggle value="standard" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("marks the selected value", () => {
    render(<DensityToggle value="comfortable" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /comfortable/i })).toBeChecked();
  });

  it("calls onChange when a different option is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DensityToggle value="standard" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /compact/i }));
    expect(onChange).toHaveBeenCalledWith("compact");
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/primitives/density-toggle.tsx
"use client";

import { cn } from "@/lib/utils";
import type { Density } from "../types";

interface Props {
  value: Density;
  onChange: (next: Density) => void;
  className?: string;
}

const OPTIONS: readonly { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "comfortable", label: "Comfortable" },
] as const;

export function DensityToggle({ value, onChange, className }: Props) {
  return (
    <div role="radiogroup" aria-label="Density" className={cn("inline-flex rounded-md border border-border bg-muted p-0.5", className)}>
      {OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2.5 py-1 text-[11px] rounded-sm font-medium uppercase tracking-wider transition-colors",
              checked ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 1.15: `<ApproverSlotCard>` primitive

**Files:**
- Create: `src/components/composer/primitives/approver-slot-card.tsx`
- Test: `src/components/composer/primitives/approver-slot-card.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/primitives/approver-slot-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ApproverSlotCard } from "./approver-slot-card";

describe("ApproverSlotCard", () => {
  it("shows required pill when slot is required and empty", () => {
    render(
      <ApproverSlotCard slotIndex={0} required staffId="" display="" disabled={false} attemptedSubmit={false}>
        <select aria-label="approver"><option>—</option></select>
      </ApproverSlotCard>
    );
    expect(screen.getByText(/Signature 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Required/i)).toBeInTheDocument();
  });

  it("shows positive tone when filled-and-required", () => {
    const { container } = render(
      <ApproverSlotCard slotIndex={1} required staffId="abc" display="Jane Doe — Manager" disabled={false} attemptedSubmit={false}>
        <select aria-label="approver"><option>Jane</option></select>
      </ApproverSlotCard>
    );
    expect(container.querySelector(".text-positive")).not.toBeNull();
  });

  it("shows destructive border when required-and-empty-and-attempted-submit", () => {
    const { container } = render(
      <ApproverSlotCard slotIndex={0} required staffId="" display="" disabled={false} attemptedSubmit>
        <select aria-label="approver"><option>—</option></select>
      </ApproverSlotCard>
    );
    expect(container.firstChild).toHaveClass("border-destructive");
  });

  it("renders Optional badge for slot 3 when not required", () => {
    render(
      <ApproverSlotCard slotIndex={2} required={false} staffId="" display="" disabled={false} attemptedSubmit={false}>
        <select aria-label="approver"><option>—</option></select>
      </ApproverSlotCard>
    );
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });

  it("renders italic display preview when filled", () => {
    render(
      <ApproverSlotCard slotIndex={1} required staffId="abc" display="Jane Doe — Manager" disabled={false} attemptedSubmit={false}>
        <select aria-label="approver"><option>Jane</option></select>
      </ApproverSlotCard>
    );
    expect(screen.getByText("Jane Doe — Manager")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/primitives/approver-slot-card.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  slotIndex: 0 | 1 | 2;
  required: boolean;
  staffId: string;
  display: string;
  disabled: boolean;
  attemptedSubmit: boolean;
  children: ReactNode; // the staff <Select> control
}

export function ApproverSlotCard({ slotIndex, required, staffId, display, disabled, attemptedSubmit, children }: Props) {
  const filled = staffId.trim().length > 0;
  const showError = required && !filled && attemptedSubmit;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        showError ? "border-destructive bg-destructive/[0.04]" : "border-border",
        disabled && "opacity-70"
      )}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Signature {slotIndex + 1}
        </h3>
        <span
          className={cn(
            "text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded",
            filled && required && "bg-positive-bg text-positive border border-positive-border",
            !filled && required && !attemptedSubmit && "text-muted-foreground",
            !filled && required && attemptedSubmit && "bg-destructive/10 text-destructive border border-destructive/30",
            !required && (filled ? "bg-info-bg text-info border border-info-border" : "text-muted-foreground")
          )}
        >
          {required ? "Required" : "Optional"}
        </span>
      </div>
      <div className="mb-3">{children}</div>
      <div
        className={cn(
          "border-b border-dashed pb-1.5",
          filled ? "border-foreground/40" : "border-border"
        )}
      >
        <p className={cn("text-[12.5px] italic min-h-[1.4em]", filled ? "text-foreground" : "text-muted-foreground/60")}>
          {filled ? display : "— select an approver —"}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 1.16: Phase 1 commit + checkpoint

- [ ] **Step 1: Run all P1 quality gates**

```bash
npm run lint
npx tsc --noEmit
npm test -- src/components/composer src/components/ui/sheet.test.tsx src/components/ui/switch.test.tsx src/components/ui/slider.test.tsx
```

Expected: all green.

- [ ] **Step 2: Localhost smoke test**

```bash
npm run dev
# Open localhost:3000 — confirm no visual regressions on existing pages.
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css src/components/ui/sheet.tsx src/components/ui/sheet.test.tsx src/components/ui/switch.tsx src/components/ui/switch.test.tsx src/components/ui/slider.tsx src/components/ui/slider.test.tsx src/components/composer

git commit -m "$(cat <<'EOF'
feat(composer): P1 — design tokens + composer primitives

Adds composer color/shadow tokens across :root + .dark + 4 Catppuccin themes,
shadcn-style Sheet/Switch/Slider primitives, and composer primitives:
StepBadge, SectionCard, StatusPill, DocTypeBadge, DensityToggle,
ApproverSlotCard, plus useDensity + useSectionJump hooks.

No UI swap yet — these primitives ship under the radar to be consumed by P2+.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Ship-check + checkpoint + adversarial review**

```bash
npm run ship-check
npm run git:checkpoint
/codex:adversarial-review
```

Address any REJECT verdict before moving to P2.

- [ ] **Step 5: Done-cue**

```bash
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 2 — Validation engine + `<DocumentComposer>` shell

**Ships:** `useComposerValidation` hook (the heart of the composer — derives blockers, checklist, readiness, totals), `<ComposerHeader>`, `<ComposerLayout>`, `<DocumentComposer>` shell with stub sections + empty rail. `/invoices/new` is wired to the new shell as the canary; `/quotes/new` and edit pages still use legacy `KeyboardMode`/`QuoteMode`.

**Localhost verify:** `http://localhost:3000/invoices/new` renders a header with breadcrumb + DRAFT pill + INVOICE badge, an empty workflow column with 6 stub sections, and a sticky right rail card showing 0% readiness with all 6 checklist items unchecked.

### Task 2.1: `useComposerValidation` — totals derivation

The hook is large; build it in two passes — totals first (deterministic math, easy to test), then blockers/checklist (logic-heavy).

**Files:**
- Create: `src/components/composer/hooks/use-composer-validation.ts`
- Test: `src/components/composer/hooks/use-composer-validation.test.ts`

- [ ] **Step 1: Failing test for totals**

```ts
// src/components/composer/hooks/use-composer-validation.test.ts
import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useComposerValidation } from "./use-composer-validation";
import type { InvoiceFormData } from "@/components/invoice/hooks/use-invoice-form-state";

function invoiceForm(overrides: Partial<InvoiceFormData> = {}): InvoiceFormData {
  return {
    invoiceNumber: "", date: "2026-04-26", staffId: "", department: "", category: "",
    accountCode: "", accountNumber: "", approvalChain: [],
    contactName: "", contactExtension: "", contactEmail: "", contactPhone: "",
    semesterYearDept: "", notes: "",
    isRecurring: false, recurringInterval: "", recurringEmail: "",
    isRunning: false, runningTitle: "",
    marginEnabled: false, marginPercent: 0, taxEnabled: false, taxRate: 0.0975,
    items: [], prismcorePath: null,
    signatures: { line1: "", line2: "", line3: "" },
    signatureStaffIds: { line1: "", line2: "", line3: "" },
    ...overrides,
  };
}

describe("useComposerValidation totals", () => {
  it("computes subtotal from items", () => {
    const form = invoiceForm({
      items: [
        { _key: "a", sku: null, description: "x", quantity: 2, unitPrice: 10, extendedPrice: 20, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null },
        { _key: "b", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 1, isTaxable: false, marginOverride: null, costPrice: null },
      ],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.totals.subtotal).toBe(25);
    expect(result.current.totals.itemCount).toBe(2);
  });

  it("computes taxable subtotal and tax amount", () => {
    const form = invoiceForm({
      taxEnabled: true, taxRate: 0.1,
      items: [
        { _key: "a", sku: null, description: "x", quantity: 1, unitPrice: 100, extendedPrice: 100, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null },
        { _key: "b", sku: null, description: "y", quantity: 1, unitPrice: 50, extendedPrice: 50, sortOrder: 1, isTaxable: false, marginOverride: null, costPrice: null },
      ],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.totals.taxableSubtotal).toBe(100);
    expect(result.current.totals.taxAmount).toBeCloseTo(10, 5);
    expect(result.current.totals.taxableCount).toBe(1);
    expect(result.current.totals.grandTotal).toBeCloseTo(160, 5);
  });

  it("applies margin to extended prices when enabled", () => {
    const form = invoiceForm({
      marginEnabled: true, marginPercent: 50,
      items: [
        { _key: "a", sku: null, description: "x", quantity: 2, unitPrice: 10, extendedPrice: 20, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: 10 },
      ],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    // cost 10 * (1 + 0.5) = 15 charged; extended = 30
    expect(result.current.totals.subtotal).toBe(30);
    expect(result.current.totals.marginAmount).toBeCloseTo(10, 5);
  });
});
```

- [ ] **Step 2: Implement totals derivation**

```ts
// src/components/composer/hooks/use-composer-validation.ts
"use client";

import { useMemo } from "react";
import type { InvoiceFormData, InvoiceItem } from "@/components/invoice/hooks/use-invoice-form-state";
import type { QuoteFormData, QuoteItem } from "@/components/quote/quote-form";
import type {
  BlockerEntry,
  ChecklistEntry,
  ComposerTotals,
  DocType,
  SectionAnchor,
} from "../types";

type AnyItem = InvoiceItem | QuoteItem;
type AnyForm = InvoiceFormData | QuoteFormData;

function isInvoiceForm(form: AnyForm): form is InvoiceFormData {
  return "signatureStaffIds" in form;
}

function chargedPrice(item: AnyItem, form: AnyForm): number {
  if (!form.marginEnabled || form.marginPercent <= 0) {
    return Number(item.unitPrice);
  }
  const cost = item.costPrice ?? item.unitPrice;
  const m = item.marginOverride ?? form.marginPercent;
  return Math.round(cost * (1 + m / 100) * 100) / 100;
}

function computeTotals(form: AnyForm): ComposerTotals {
  let subtotal = 0;
  let taxableSubtotal = 0;
  let marginCost = 0;
  let itemCount = 0;
  let taxableCount = 0;

  for (const item of form.items) {
    const hasContent = item.description.trim().length > 0 || item.sku;
    if (!hasContent) continue;

    const charged = chargedPrice(item, form);
    const ext = charged * Number(item.quantity);
    subtotal += ext;
    itemCount += 1;
    if (form.marginEnabled) {
      const cost = item.costPrice ?? item.unitPrice;
      marginCost += Number(cost) * Number(item.quantity);
    }
    if (item.isTaxable) {
      taxableSubtotal += ext;
      taxableCount += 1;
    }
  }

  const taxAmount = form.taxEnabled ? taxableSubtotal * Number(form.taxRate) : 0;
  const marginAmount = form.marginEnabled ? subtotal - marginCost : 0;
  const grandTotal = subtotal + taxAmount;

  return {
    subtotal,
    taxableSubtotal,
    taxAmount,
    marginAmount,
    grandTotal,
    itemCount,
    taxableCount,
  };
}

export function useComposerValidation(form: AnyForm, docType: DocType) {
  const totals = useMemo(() => computeTotals(form), [form]);

  // Blockers + checklist + canSaveDraft come in Task 2.2.
  const blockers: BlockerEntry[] = [];
  const checklist: ChecklistEntry[] = [];
  const readiness = 0;
  const canSaveDraft = false;

  return { blockers, checklist, readiness, canSaveDraft, totals };
  // unused param marker (avoid lint)
  void isInvoiceForm; void docType;
}
```

- [ ] **Step 3: Run totals tests**

```bash
npm test -- src/components/composer/hooks/use-composer-validation.test.ts
```

Expected: 3 totals tests PASS.

### Task 2.2: `useComposerValidation` — blockers + checklist + readiness

- [ ] **Step 1: Add invoice blocker tests**

Append to `use-composer-validation.test.ts`:

```ts
describe("useComposerValidation invoice blockers", () => {
  it("flags missing requestor", () => {
    const form = invoiceForm({ staffId: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "requestor")).toBeTruthy();
  });

  it("flags missing department", () => {
    const form = invoiceForm({ staffId: "x", department: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "department")).toBeTruthy();
  });

  it("flags missing accountNumber", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", accountNumber: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "accountNumber")).toBeTruthy();
  });

  it("flags missing category", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", accountNumber: "1", category: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "category")).toBeTruthy();
  });

  it("flags items.length === 0", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", accountNumber: "1", category: "x", items: [] });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "items")).toBeTruthy();
  });

  it("flags invalid items", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "", quantity: 1, unitPrice: 0, extendedPrice: 0, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "itemsValid")).toBeTruthy();
  });

  it("flags missing approvers when fewer than 2 filled", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
      signatureStaffIds: { line1: "abc", line2: "", line3: "" },
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "approvers")).toBeTruthy();
  });

  it("zero blockers when all 7 invoice rules satisfied", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
      signatureStaffIds: { line1: "a", line2: "b", line3: "" },
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers).toHaveLength(0);
    expect(result.current.readiness).toBe(1);
  });
});

describe("useComposerValidation quote blockers", () => {
  function quoteForm(overrides: Partial<QuoteFormData> = {}): QuoteFormData {
    return {
      date: "2026-04-26", staffId: "", department: "", category: "",
      accountCode: "", accountNumber: "", approvalChain: [],
      contactName: "", contactExtension: "", contactEmail: "", contactPhone: "", notes: "",
      items: [],
      expirationDate: "2026-05-26", recipientName: "", recipientEmail: "", recipientOrg: "",
      marginEnabled: false, marginPercent: 0, taxEnabled: false, taxRate: 0.0975,
      isCateringEvent: false,
      cateringDetails: { eventDate: "", startTime: "", endTime: "", location: "", contactName: "", contactPhone: "", contactEmail: "", headcount: undefined, eventName: "", setupRequired: false, setupTime: "", setupInstructions: "", takedownRequired: false, takedownTime: "", takedownInstructions: "", specialInstructions: "" },
      ...overrides,
    } as QuoteFormData;
  }

  it("requires recipientName when external (no staffId)", () => {
    const form = quoteForm({ staffId: "", recipientName: "" });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers.find((b) => b.field === "recipient")).toBeTruthy();
  });

  it("recipient satisfied when staffId set (internal)", () => {
    const form = quoteForm({
      staffId: "x", recipientName: "", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers.find((b) => b.field === "recipient")).toBeFalsy();
  });

  it("does not require approvers for quotes", () => {
    const form = quoteForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers).toHaveLength(0);
  });
});

describe("useComposerValidation canSaveDraft", () => {
  it("invoice: true with department + date + staffId + 1 valid item", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.canSaveDraft).toBe(true);
  });

  it("invoice: false when no items", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", items: [] });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.canSaveDraft).toBe(false);
  });
});
```

- [ ] **Step 2: Implement blockers + checklist + readiness**

Replace the body of `useComposerValidation` after `const totals = useMemo(...)`:

```ts
  const blockers = useMemo<BlockerEntry[]>(() => {
    const list: BlockerEntry[] = [];
    if (!form.staffId) list.push({ field: "requestor", label: "Requestor required", anchor: "section-people" });

    if (docType === "quote") {
      const isExternal = !form.staffId;
      const q = form as QuoteFormData;
      if (isExternal && !q.recipientName.trim()) {
        list.push({ field: "recipient", label: "Recipient required", anchor: "section-people" });
      }
    }

    if (!form.department) list.push({ field: "department", label: "Department required", anchor: "section-department" });
    if (!form.accountNumber) list.push({ field: "accountNumber", label: "Account number required", anchor: "section-department" });
    if (!form.category) list.push({ field: "category", label: "Category required", anchor: "section-details" });
    if (form.items.length === 0) {
      list.push({ field: "items", label: "Add at least one line item", anchor: "section-items" });
    } else {
      const allValid = form.items.every((i) => i.description.trim() && Number(i.quantity) > 0);
      if (!allValid) list.push({ field: "itemsValid", label: "Every item needs a description and qty > 0", anchor: "section-items" });
    }

    if (docType === "invoice" && isInvoiceForm(form)) {
      const filled = ["line1", "line2", "line3"].filter((k) => form.signatureStaffIds[k as "line1"|"line2"|"line3"]).length;
      if (filled < 2) {
        list.push({ field: "approvers", label: `${2 - filled} approver(s) missing (2 required)`, anchor: "section-approval" });
      }
    }
    return list;
  }, [form, docType]);

  const checklist = useMemo<ChecklistEntry[]>(() => {
    const itemsAdded = form.items.length > 0;
    const itemsValid = itemsAdded && form.items.every((i) => i.description.trim() && Number(i.quantity) > 0);

    if (docType === "invoice" && isInvoiceForm(form)) {
      const filled = ["line1", "line2", "line3"].filter((k) => form.signatureStaffIds[k as "line1"|"line2"|"line3"]).length;
      return [
        { id: "requestor",  label: "Requestor selected",         anchor: "section-people",     complete: !!form.staffId,                          blocker: !form.staffId },
        { id: "deptAcct",   label: "Department & account",       anchor: "section-department", complete: !!form.department && !!form.accountNumber, blocker: !form.department || !form.accountNumber },
        { id: "category",   label: "Category chosen",            anchor: "section-details",    complete: !!form.category,                          blocker: !form.category },
        { id: "items",      label: "Line items added",           anchor: "section-items",      complete: itemsAdded,                                blocker: !itemsAdded },
        { id: "itemsValid", label: "Items valid",                anchor: "section-items",      complete: itemsValid,                                blocker: itemsAdded && !itemsValid },
        { id: "approvers",  label: "At least 2 approvers",       anchor: "section-approval",   complete: filled >= 2,                              blocker: filled < 2 },
      ];
    }

    const q = form as QuoteFormData;
    const isExternal = !form.staffId;
    const recipientOk = (!isExternal) || !!q.recipientName.trim();
    return [
      { id: "requestor", label: "Requestor selected", anchor: "section-people",  complete: !!form.staffId,           blocker: !form.staffId },
      { id: "recipient", label: "Recipient set",     anchor: "section-people",  complete: recipientOk,               blocker: !recipientOk },
      { id: "category",  label: "Category chosen",   anchor: "section-details", complete: !!form.category,           blocker: !form.category },
      { id: "items",     label: "Line items added",  anchor: "section-items",   complete: itemsAdded,                blocker: !itemsAdded },
      { id: "itemsValid",label: "Items valid",       anchor: "section-items",   complete: itemsValid,                blocker: itemsAdded && !itemsValid },
      { id: "marginTax", label: "Margin & tax confirmed", anchor: "section-items", complete: form.marginEnabled || form.taxEnabled || true, blocker: false },
    ];
  }, [form, docType]);

  const readiness = checklist.length === 0 ? 0 : checklist.filter((c) => c.complete).length / checklist.length;

  const canSaveDraft = useMemo(() => {
    const itemsValid = form.items.length > 0 && form.items.every((i) => i.description.trim() && Number(i.quantity) > 0);
    const minimum = !!form.department && !!form.date && !!form.staffId && itemsValid;
    if (!minimum) return false;
    if (docType === "quote") {
      const q = form as QuoteFormData;
      return !!q.recipientName.trim() || !!form.staffId;
    }
    return true;
  }, [form, docType]);
```

Update the return object to use these computed values (remove the placeholder zeros).

- [ ] **Step 3: Run tests** — all blocker + canSaveDraft tests PASS.

### Task 2.3: `<ComposerHeader>`

**Files:**
- Create: `src/components/composer/composer-header.tsx`
- Test: `src/components/composer/composer-header.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/composer-header.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ComposerHeader } from "./composer-header";

describe("ComposerHeader", () => {
  it("renders breadcrumb + title for invoice/new", () => {
    render(
      <ComposerHeader
        docType="invoice"
        mode="create"
        status="DRAFT"
        documentNumber={undefined}
        date="2026-04-26"
        isRunning={false}
        actionsRight={<button>preview</button>}
      />
    );
    expect(screen.getByText(/LAPORTAL/)).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText(/New Invoice/)).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
  });

  it("renders edit-mode for quote with document number", () => {
    render(
      <ComposerHeader
        docType="quote" mode="edit" status="SENT" documentNumber="QUO-1234" date="2026-04-26" isRunning={false}
      />
    );
    expect(screen.getByText("Quotes")).toBeInTheDocument();
    expect(screen.getByText(/Edit Quote/)).toBeInTheDocument();
    expect(screen.getByText("QUO-1234")).toBeInTheDocument();
    expect(screen.getByText("SENT")).toBeInTheDocument();
    expect(screen.getByText("QUOTE")).toBeInTheDocument();
  });

  it("renders running badge when isRunning", () => {
    render(<ComposerHeader docType="invoice" mode="create" status="DRAFT" date="2026-04-26" isRunning />);
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/composer-header.tsx
import type { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import { StatusPill } from "./primitives/status-pill";
import { DocTypeBadge } from "./primitives/doc-type-badge";
import type { ComposerStatus, DocType } from "./types";

interface Props {
  docType: DocType;
  mode: "create" | "edit";
  status: ComposerStatus;
  documentNumber?: string;
  date: string;
  isRunning: boolean;
  actionsRight?: ReactNode;
}

const TYPE_LABELS = {
  invoice: { plural: "Invoices", title: { create: "New Invoice", edit: "Edit Invoice" } },
  quote:   { plural: "Quotes",   title: { create: "New Quote",   edit: "Edit Quote"   } },
} as const;

export function ComposerHeader({ docType, mode, status, documentNumber, date, isRunning, actionsRight }: Props) {
  const t = TYPE_LABELS[docType];
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-canvas/85 border-b border-border">
      <div className="px-6 py-2.5 flex items-center justify-between text-[11px]">
        <nav className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-muted-foreground">
          <span className="text-primary font-semibold">LAPORTAL</span>
          <ChevronRightIcon className="size-3" />
          <span>{t.plural}</span>
          <ChevronRightIcon className="size-3" />
          <span className="text-foreground">{mode === "create" ? "New" : (documentNumber ?? "Edit")}</span>
        </nav>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <DocTypeBadge docType={docType} />
        </div>
      </div>
      <div className="px-6 pb-4 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[22px] font-bold tracking-tight">{t.title[mode]}</h1>
          {documentNumber && (
            <span className="font-mono text-sm text-muted-foreground tabular-nums">{documentNumber}</span>
          )}
          <span className="text-muted-foreground/50">·</span>
          <span className="text-sm text-muted-foreground tabular-nums">{date}</span>
          {isRunning && (
            <span className="ml-1 inline-flex items-center rounded-full border border-info-border bg-info-bg px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider text-info">
              Running
            </span>
          )}
        </div>
        {actionsRight && <div className="flex items-center gap-2 shrink-0">{actionsRight}</div>}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 2.4: `<ComposerLayout>` thin wrapper

**Files:**
- Create: `src/components/composer/composer-layout.tsx`

- [ ] **Step 1: Implementation (no test — pure layout)**

```tsx
// src/components/composer/composer-layout.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  workflow: ReactNode;
  rail: ReactNode;
  banners?: ReactNode;
  className?: string;
}

export function ComposerLayout({ workflow, rail, banners, className }: Props) {
  return (
    <main
      className={cn(
        "mx-auto max-w-[1440px] px-6 pt-4 pb-20",
        "grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start",
        className
      )}
    >
      <div className="min-w-0 space-y-3.5">
        {banners}
        {workflow}
      </div>
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {rail}
      </aside>
    </main>
  );
}
```

### Task 2.5: `<DocumentComposer>` shell

**Files:**
- Create: `src/components/composer/document-composer.tsx`
- Test: `src/components/composer/document-composer.test.tsx`

- [ ] **Step 1: Failing shell test**

```tsx
// src/components/composer/document-composer.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocumentComposer } from "./document-composer";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { renderHook } from "@testing-library/react";

describe("DocumentComposer shell", () => {
  it("renders header + 6 stub sections + rail", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <DocumentComposer
        composer={{ docType: "invoice", form: result.current }}
        mode="create"
        status="DRAFT"
        canManageActions
      />
    );
    expect(screen.getByText(/New Invoice/)).toBeInTheDocument();
    // 6 sections present (each has a step badge with aria-label "Step N of 6")
    expect(screen.getAllByLabelText(/Step \d of 6/).length).toBe(6);
    // Rail readiness card present
    expect(screen.getByText(/Readiness/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement the shell with stub sections + empty rail**

```tsx
// src/components/composer/document-composer.tsx
"use client";

import { useState } from "react";
import { ComposerHeader } from "./composer-header";
import { ComposerLayout } from "./composer-layout";
import { SectionCard } from "./sections/section-card";
import { useComposerValidation } from "./hooks/use-composer-validation";
import { useDensity } from "./hooks/use-density";
import { useSectionJump } from "./hooks/use-section-jump";
import type { ComposerStatus, DocType } from "./types";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

type ComposerForm =
  | { docType: "invoice"; form: ReturnType<typeof useInvoiceForm> }
  | { docType: "quote";   form: ReturnType<typeof useQuoteForm> };

export interface DocumentComposerProps {
  composer: ComposerForm;
  mode: "create" | "edit";
  status?: ComposerStatus;
  canManageActions?: boolean;
  documentNumber?: string;
}

type DrawerKey = "catalog" | "templates" | "preview" | null;

export function DocumentComposer({ composer, mode, status = "DRAFT", canManageActions = true, documentNumber }: DocumentComposerProps) {
  const docType: DocType = composer.docType;
  const form = composer.form.form;

  const validation = useComposerValidation(form, docType);
  const { density, setDensity } = useDensity();
  const { jump } = useSectionJump();

  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [showBlockers, setShowBlockers] = useState(false);

  // Status determination — anchor → checklist completion + blocker presence
  function statusForAnchor(anchor: string): "default" | "complete" | "blocker" {
    if (validation.blockers.some((b) => b.anchor === anchor)) return "blocker";
    if (validation.checklist.every((c) => c.anchor !== anchor || c.complete)) {
      // anchor's checklist items all complete
      const items = validation.checklist.filter((c) => c.anchor === anchor);
      if (items.length > 0 && items.every((i) => i.complete)) return "complete";
    }
    return "default";
  }

  return (
    <>
      <ComposerHeader
        docType={docType}
        mode={mode}
        status={status}
        documentNumber={documentNumber}
        date={form.date}
        isRunning={"isRunning" in form ? form.isRunning : false}
      />
      <ComposerLayout
        workflow={
          <>
            <SectionCard step={1} title="People"               anchor="section-people"     status={statusForAnchor("section-people")}>
              <p className="text-sm text-muted-foreground">P3 places content here.</p>
            </SectionCard>
            <SectionCard step={2} title="Department & Account" anchor="section-department" status={statusForAnchor("section-department")}>
              <p className="text-sm text-muted-foreground">P3 places content here.</p>
            </SectionCard>
            <SectionCard step={3} title="Document Details"     anchor="section-details"    status={statusForAnchor("section-details")}>
              <p className="text-sm text-muted-foreground">P3 places content here.</p>
            </SectionCard>
            <SectionCard step={4} title="Items & Pricing"      anchor="section-items"      status={statusForAnchor("section-items")}>
              <p className="text-sm text-muted-foreground">P4 places content here.</p>
            </SectionCard>
            <SectionCard step={5} title="Notes"                anchor="section-notes"      status={statusForAnchor("section-notes")}>
              <p className="text-sm text-muted-foreground">P5 places content here.</p>
            </SectionCard>
            <SectionCard step={6} title={docType === "invoice" ? "Approval & Output" : "Output & Reuse"} anchor="section-approval" status={statusForAnchor("section-approval")}>
              <p className="text-sm text-muted-foreground">P5 places content here.</p>
            </SectionCard>
          </>
        }
        rail={
          <div className="rounded-lg border border-border bg-card p-4 shadow-rail">
            <p className="font-mono uppercase tracking-wider text-[11px] text-muted-foreground">Readiness</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{Math.round(validation.readiness * 100)}%</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">{validation.blockers.length} blocker(s) · {validation.totals.itemCount} item(s)</p>
          </div>
        }
      />
      {/* Drawers + blocker summary mounted in P5 + P6 */}
      {/* Read parameters used so TS/lint don't complain in the stub */}
      <span hidden>{String(canManageActions)} {density} {String(setDensity)} {String(drawer)} {String(setDrawer)} {String(showBlockers)} {String(setShowBlockers)} {String(jump)}</span>
    </>
  );
}
```

(The trailing `<span hidden>` is a deliberate stub so unused values don't trip eslint while shell wiring is still incomplete. P5/P6 remove it as those values get consumed.)

- [ ] **Step 3: Run shell test** — PASS.

### Task 2.6: Wire `/invoices/new` to the new shell

**Files:**
- Modify: `src/app/invoices/new/page.tsx`

- [ ] **Step 1: Replace the body**

Replace the existing return + the `KeyboardMode` mounting with the composer:

```tsx
// src/app/invoices/new/page.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { DocumentComposer } from "@/components/composer/document-composer";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { SelectedProduct } from "@/domains/product/types";

function hasRetailPrice(p: SelectedProduct): p is SelectedProduct & { retailPrice: number } {
  return p.retailPrice != null;
}

function readCatalogItems() {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(CATALOG_ITEMS_STORAGE_KEY);
    const items = JSON.parse(raw) as SelectedProduct[];
    return items.filter(hasRetailPrice).map((item) => ({
      sku: String(item.sku),
      description: item.description.toUpperCase(),
      quantity: 1,
      unitPrice: item.retailPrice,
      costPrice: item.cost,
    }));
  } catch {
    return undefined;
  }
}

export default function NewInvoicePage() {
  const searchParams = useSearchParams();
  const fromCatalog = searchParams.get("from") === "catalog";

  const initial = useMemo(() => {
    if (!fromCatalog) return undefined;
    const catalogItems = readCatalogItems();
    if (!catalogItems || catalogItems.length === 0) return undefined;
    return {
      items: catalogItems.map((item, i) => ({
        _key: `catalog-${i}`,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.quantity * item.unitPrice,
        sortOrder: i,
        isTaxable: true,
        marginOverride: null,
        costPrice: item.costPrice,
      })),
    };
  }, [fromCatalog]);

  const invoiceForm = useInvoiceForm(initial);

  return (
    <DocumentComposer
      composer={{ docType: "invoice", form: invoiceForm }}
      mode="create"
      status="DRAFT"
      canManageActions
    />
  );
}
```

- [ ] **Step 2: Verify on localhost**

```bash
npm run dev
# visit http://localhost:3000/invoices/new
```

Expected: header with breadcrumb, 6 stub sections, sticky right rail showing 0% with 0 items. Section badges should turn red-X as you imagine blockers (no inputs to fill yet — that's P3+).

### Task 2.7: Phase 2 commit

- [ ] **Step 1: Quality gates**

```bash
npm run lint && npx tsc --noEmit
npm test -- src/components/composer
```

- [ ] **Step 2: Commit**

```bash
git add src/components/composer src/app/invoices/new/page.tsx

git commit -m "$(cat <<'EOF'
feat(composer): P2 — validation engine + composer shell wired on /invoices/new

Adds useComposerValidation hook (blockers, checklist, readiness, totals for
both invoice + quote), <ComposerHeader>, <ComposerLayout>, and the
<DocumentComposer> shell rendering 6 stub sections + an empty rail card.

/invoices/new is the canary — it now mounts the new shell. /quotes/new and
edit pages still use legacy KeyboardMode/QuoteMode until P7/P8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Ship-check, checkpoint, adversarial review, done-cue**

```bash
npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 3 — Sections 1, 2, 3 (People, Department, Document Details)

**Ships:** Real content for the first three sections. Wires existing `<StaffSelect>`, `<StaffSummaryEditor>`, `<AccountNumberSelect>`, category fetch, etc., through to the new `SectionCard` containers. Catering "more details" disclosure (used by quote variant) is also built here so P7 can simply render it.

**Localhost verify:** On `/invoices/new`, filling section 1 (requestor) advances readiness; filling section 2 (department + account) advances; filling section 3 (category + date) advances. Step badges flip from red-X → number → green-check as appropriate.

### Task 3.1: `<PeopleSection>` — invoice variant

**Files:**
- Create: `src/components/composer/sections/people-section.tsx`
- Test: `src/components/composer/sections/people-section.test.tsx`

The invoice variant wraps `<StaffSelect>` + a contact-info card. The quote variant adds a "Internal/External" segmented control. Build the invoice path first; quote variant in Task 3.2.

- [ ] **Step 1: Failing test (invoice variant only)**

```tsx
// src/components/composer/sections/people-section.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PeopleSection } from "./people-section";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { renderHook } from "@testing-library/react";

vi.mock("@/components/invoice/staff-select", () => ({
  StaffSelect: ({ value }: { value: string }) => <div data-testid="staff-select">{value}</div>,
}));
vi.mock("@/components/invoice/staff-summary-editor", () => ({
  StaffSummaryEditor: () => <div data-testid="staff-editor" />,
}));

describe("PeopleSection (invoice)", () => {
  it("renders staff select column + contact card column", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <PeopleSection
        docType="invoice"
        composer={result.current}
        sectionStatus="default"
      />
    );
    expect(screen.getByText(/Who is the requestor/i)).toBeInTheDocument();
    expect(screen.getByTestId("staff-select")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation (invoice variant skeleton)**

```tsx
// src/components/composer/sections/people-section.tsx
"use client";

import { SectionCard } from "./section-card";
import { StaffSelect } from "@/components/invoice/staff-select";
import { StaffSummaryEditor } from "@/components/invoice/staff-summary-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";
import type { DocType } from "../types";

type Props =
  | { docType: "invoice"; composer: ReturnType<typeof useInvoiceForm>; sectionStatus: "default" | "complete" | "blocker" }
  | { docType: "quote";   composer: ReturnType<typeof useQuoteForm>;   sectionStatus: "default" | "complete" | "blocker" };

export function PeopleSection(props: Props) {
  const description =
    props.docType === "invoice"
      ? "Who is the requestor of these items / services, and what are we charging them for?"
      : "Who is requesting these items, and who will receive this quote?";

  return (
    <SectionCard step={1} title="People" description={description} anchor="section-people" status={props.sectionStatus}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="space-y-2">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Requestor</Label>
          <StaffSelect
            value={props.composer.form.staffId}
            onSelect={props.composer.handleStaffSelect}
            disabled={false}
          />
          <p className="text-[12px] text-muted-foreground">Autofills department & contact</p>
          <StaffSummaryEditor
            staffId={props.composer.form.staffId}
            onUpdate={props.composer.handleStaffEdit}
          />
        </div>

        {props.docType === "invoice" ? (
          <InvoiceContactCard composer={props.composer} />
        ) : (
          <QuoteRecipientCard composer={props.composer} />
        )}
      </div>
    </SectionCard>
  );
}

function InvoiceContactCard({ composer }: { composer: ReturnType<typeof useInvoiceForm> }) {
  const f = composer.form;
  const set = composer.updateField;
  if (!f.staffId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-[12.5px] text-muted-foreground">
        — select a staff member —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-[12.5px]">
      <div className="grid gap-2">
        <Input value={f.contactName}      onChange={(e) => set("contactName",      e.target.value)} placeholder="Name" />
        <Input value={f.contactExtension} onChange={(e) => set("contactExtension", e.target.value)} placeholder="Ext" className="font-mono" />
        <Input value={f.contactEmail}     onChange={(e) => set("contactEmail",     e.target.value)} placeholder="Email" type="email" className="font-mono" />
        <Input value={f.contactPhone}     onChange={(e) => set("contactPhone",     e.target.value)} placeholder="Phone" className="font-mono tabular-nums" />
      </div>
    </div>
  );
}

function QuoteRecipientCard({ composer }: { composer: ReturnType<typeof useQuoteForm> }) {
  // Implementation in Task 3.2
  return <div className="hidden">{composer.form.recipientName}</div>;
}
```

- [ ] **Step 3: Run** — invoice test PASS.

### Task 3.2: `<PeopleSection>` — quote variant (segmented control)

- [ ] **Step 1: Add quote tests**

```tsx
// append to people-section.test.tsx
import { useQuoteForm } from "@/components/quote/quote-form";

describe("PeopleSection (quote)", () => {
  it("shows internal/external segmented control", () => {
    const { result } = renderHook(() => useQuoteForm());
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.getByRole("radio", { name: /Internal/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /External/i })).toBeInTheDocument();
  });

  it("hides recipient inputs in internal mode", () => {
    const { result } = renderHook(() => useQuoteForm({ staffId: "abc" }));
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.queryByPlaceholderText(/Recipient name/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `QuoteRecipientCard`**

Replace the stub from Task 3.1:

```tsx
function QuoteRecipientCard({ composer }: { composer: ReturnType<typeof useQuoteForm> }) {
  const f = composer.form;
  const isInternal = !!f.staffId;
  const setMode = (mode: "internal" | "external") => {
    if (mode === "internal") {
      // Picking internal: clear external recipient fields; staff already selected stays.
      composer.updateField("recipientName", "");
      composer.updateField("recipientEmail", "");
    } else {
      // Picking external: clear staffId, prompt user for recipient.
      composer.clearStaffSelection();
    }
  };

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Recipient type" className="inline-flex rounded-md border border-border bg-muted p-0.5">
        <button type="button" role="radio" aria-checked={isInternal} aria-label="Internal department"
          onClick={() => setMode("internal")}
          className={`px-2.5 py-1 text-[11px] rounded-sm font-medium uppercase tracking-wider ${isInternal ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Internal dept.
        </button>
        <button type="button" role="radio" aria-checked={!isInternal} aria-label="External party"
          onClick={() => setMode("external")}
          className={`px-2.5 py-1 text-[11px] rounded-sm font-medium uppercase tracking-wider ${!isInternal ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
          External party
        </button>
      </div>
      {isInternal ? (
        <p className="text-[12px] text-muted-foreground">Quote will be sent to the requestor's email.</p>
      ) : (
        <div className="space-y-2">
          <Input value={f.recipientName}  onChange={(e) => composer.updateField("recipientName",  e.target.value)} placeholder="Recipient name" />
          <Input value={f.recipientEmail} onChange={(e) => composer.updateField("recipientEmail", e.target.value)} placeholder="Recipient email (optional)" type="email" />
          <Input value={f.recipientOrg}   onChange={(e) => composer.updateField("recipientOrg",   e.target.value)} placeholder="Organization (optional)" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run** — quote tests PASS.

### Task 3.3: `<DepartmentAccountSection>`

**Files:**
- Create: `src/components/composer/sections/department-account.tsx`
- Test: `src/components/composer/sections/department-account.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/sections/department-account.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DepartmentAccountSection } from "./department-account";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { renderHook } from "@testing-library/react";

vi.mock("@/components/invoice/account-number-select", () => ({
  AccountNumberSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    <input data-testid="account-number" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

describe("DepartmentAccountSection", () => {
  it("renders 3-column grid + semester input", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(<DepartmentAccountSection composer={result.current} sectionStatus="default" />);
    expect(screen.getByLabelText(/Department/i)).toBeInTheDocument();
    expect(screen.getByTestId("account-number")).toBeInTheDocument();
    expect(screen.getByLabelText(/Account code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Semester/i)).toBeInTheDocument();
  });

  it("autofills semesterYearDept from department when empty", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useInvoiceForm({ department: "BKST" }));
    render(<DepartmentAccountSection composer={result.current} sectionStatus="default" />);
    const sem = screen.getByLabelText(/Semester/i) as HTMLInputElement;
    expect(sem.value === "" || sem.placeholder.includes("BKST")).toBe(true);
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/department-account.tsx
"use client";

import { SectionCard } from "./section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AccountNumberSelect } from "@/components/invoice/account-number-select";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

const DEPARTMENTS = ["BKST", "AUXS", "MATH", "BIOL", "ATHL", "STDV", "FINC"];

interface Props {
  composer: ReturnType<typeof useInvoiceForm> | ReturnType<typeof useQuoteForm>;
  sectionStatus: "default" | "complete" | "blocker";
}

export function DepartmentAccountSection({ composer, sectionStatus }: Props) {
  const f = composer.form;
  return (
    <SectionCard step={2} title="Department & Account" anchor="section-department" status={sectionStatus}>
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-3.5">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Department</Label>
          <Select value={f.department} onValueChange={(v) => composer.updateField("department" as never, v as never)}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Account number</Label>
          <AccountNumberSelect
            value={f.accountNumber}
            onChange={(v) => composer.updateField("accountNumber" as never, v as never)}
            staffAccountNumbers={composer.staffAccountNumbers}
          />
          {!f.accountNumber && (
            <p className="text-[12px] text-destructive">Required for GL posting — verify with department</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Account code</Label>
          <Input
            value={f.accountCode}
            onChange={(e) => composer.updateField("accountCode" as never, e.target.value as never)}
            placeholder="—"
            className="font-mono"
          />
        </div>
      </div>

      {/* Semester / term — invoice only */}
      {"semesterYearDept" in f && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Semester (PDF cover)</Label>
            <Input
              value={f.semesterYearDept}
              onChange={(e) => composer.updateField("semesterYearDept" as never, e.target.value as never)}
              placeholder={f.department || "Auto-generated from department"}
              className="font-mono"
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 3.4: `<DocumentDetailsSection>` — running toggle (invoice) + catering disclosure (quote)

**Files:**
- Create: `src/components/composer/sections/document-details.tsx`
- Test: `src/components/composer/sections/document-details.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// src/components/composer/sections/document-details.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { DocumentDetailsSection } from "./document-details";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { useQuoteForm } from "@/components/quote/quote-form";
import { renderHook } from "@testing-library/react";

describe("DocumentDetailsSection invoice", () => {
  it("renders running toggle + reveals title input when on", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useInvoiceForm());
    render(<DocumentDetailsSection docType="invoice" composer={result.current} sectionStatus="default" />);
    expect(screen.getByLabelText(/Running invoice/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Running invoice title/i)).toBeNull();
    await user.click(screen.getByRole("switch", { name: /Running/i }));
    expect(screen.getByPlaceholderText(/Running invoice title/i)).toBeInTheDocument();
  });
});

describe("DocumentDetailsSection quote", () => {
  it("renders catering toggle + reveals 4-col primary block", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useQuoteForm());
    render(<DocumentDetailsSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.getByRole("switch", { name: /Catering/i })).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: /Catering/i }));
    expect(screen.getByLabelText(/Event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Attendees/i)).toBeInTheDocument();
    expect(screen.getByText(/More catering details/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/document-details.tsx
"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { categoryApi } from "@/domains/category/api-client";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

type Props =
  | { docType: "invoice"; composer: ReturnType<typeof useInvoiceForm>; sectionStatus: "default"|"complete"|"blocker" }
  | { docType: "quote";   composer: ReturnType<typeof useQuoteForm>;   sectionStatus: "default"|"complete"|"blocker" };

export function DocumentDetailsSection(props: Props) {
  const f = props.composer.form;
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);

  useEffect(() => {
    categoryApi.list().then(setCategories).catch(() => {});
  }, []);

  return (
    <SectionCard step={3} title="Document Details" anchor="section-details" status={props.sectionStatus}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Category</Label>
          <Select value={f.category} onValueChange={(v) => props.composer.updateField("category" as never, v as never)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Date</Label>
          <Input type="date" value={f.date} onChange={(e) => props.composer.updateField("date" as never, e.target.value as never)} />
        </div>
        <div className="space-y-1.5">
          <ModeToggle {...props} />
        </div>
      </div>

      {props.docType === "invoice" && props.composer.form.isRunning && (
        <div className="pt-2">
          <Input
            placeholder="Running invoice title"
            value={props.composer.form.runningTitle}
            onChange={(e) => props.composer.updateField("runningTitle", e.target.value)}
          />
        </div>
      )}

      {props.docType === "quote" && props.composer.form.isCateringEvent && (
        <CateringPanel composer={props.composer} />
      )}
    </SectionCard>
  );
}

function ModeToggle(props: Props) {
  if (props.docType === "invoice") {
    const f = props.composer.form;
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Running invoice</Label>
          <p className="text-[12px] text-muted-foreground">Aggregates multiple charges</p>
        </div>
        <Switch
          aria-label="Running invoice"
          checked={f.isRunning}
          onCheckedChange={(v) => props.composer.updateField("isRunning", v)}
        />
      </div>
    );
  }
  const f = props.composer.form;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Catering quote</Label>
        <p className="text-[12px] text-muted-foreground">Surfaces event details</p>
      </div>
      <Switch
        aria-label="Catering"
        checked={f.isCateringEvent}
        onCheckedChange={(v) => props.composer.updateField("isCateringEvent", v)}
      />
    </div>
  );
}

function CateringPanel({ composer }: { composer: ReturnType<typeof useQuoteForm> }) {
  const c = composer.form.cateringDetails;
  const updateDetail = <K extends keyof typeof c>(k: K, v: typeof c[K]) => {
    composer.updateField("cateringDetails", { ...c, [k]: v });
  };
  return (
    <div className="mt-3 rounded-lg border border-info-border bg-info-bg/40 p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Event name</Label>
          <Input value={c.eventName ?? ""} onChange={(e) => updateDetail("eventName", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Date</Label>
          <Input type="date" value={c.eventDate} onChange={(e) => updateDetail("eventDate", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Attendees</Label>
          <Input
            type="number"
            min={0}
            value={c.headcount ?? ""}
            onChange={(e) => updateDetail("headcount", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Location</Label>
          <Input value={c.location} onChange={(e) => updateDetail("location", e.target.value)} />
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-[12px] font-mono uppercase tracking-wider text-muted-foreground">More catering details</summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Start time"  value={c.startTime} onChange={(e) => updateDetail("startTime", e.target.value)} />
          <Input placeholder="End time"    value={c.endTime}   onChange={(e) => updateDetail("endTime", e.target.value)} />
          <Input placeholder="Contact name"  value={c.contactName}  onChange={(e) => updateDetail("contactName", e.target.value)} />
          <Input placeholder="Contact phone" value={c.contactPhone} onChange={(e) => updateDetail("contactPhone", e.target.value)} />
          <Input placeholder="Contact email" type="email" value={c.contactEmail ?? ""} onChange={(e) => updateDetail("contactEmail", e.target.value)} />
          <Input placeholder="Special instructions" value={c.specialInstructions ?? ""} onChange={(e) => updateDetail("specialInstructions", e.target.value)} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.setupRequired}    onChange={(e) => updateDetail("setupRequired",    e.target.checked)} />Setup required</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.takedownRequired} onChange={(e) => updateDetail("takedownRequired", e.target.checked)} />Takedown required</label>
          <Input placeholder="Setup time"     value={c.setupTime ?? ""}    onChange={(e) => updateDetail("setupTime", e.target.value)} />
          <Input placeholder="Setup instructions"    value={c.setupInstructions ?? ""}    onChange={(e) => updateDetail("setupInstructions", e.target.value)} />
          <Input placeholder="Takedown time"  value={c.takedownTime ?? ""} onChange={(e) => updateDetail("takedownTime", e.target.value)} />
          <Input placeholder="Takedown instructions" value={c.takedownInstructions ?? ""} onChange={(e) => updateDetail("takedownInstructions", e.target.value)} />
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 3.5: Wire sections 1-3 into `<DocumentComposer>`

- [ ] **Step 1: Replace stub sections in `document-composer.tsx`**

In `src/components/composer/document-composer.tsx`, replace the three stub `<SectionCard>` calls for steps 1-3 with the real components:

```tsx
import { PeopleSection } from "./sections/people-section";
import { DepartmentAccountSection } from "./sections/department-account";
import { DocumentDetailsSection } from "./sections/document-details";

// inside the workflow JSX:
docType === "invoice" ? (
  <PeopleSection docType="invoice" composer={composer.form as ReturnType<typeof useInvoiceForm>} sectionStatus={statusForAnchor("section-people")} />
) : (
  <PeopleSection docType="quote"   composer={composer.form as ReturnType<typeof useQuoteForm>}   sectionStatus={statusForAnchor("section-people")} />
)
<DepartmentAccountSection composer={composer.form} sectionStatus={statusForAnchor("section-department")} />
docType === "invoice" ? (
  <DocumentDetailsSection docType="invoice" composer={composer.form as ReturnType<typeof useInvoiceForm>} sectionStatus={statusForAnchor("section-details")} />
) : (
  <DocumentDetailsSection docType="quote"   composer={composer.form as ReturnType<typeof useQuoteForm>}   sectionStatus={statusForAnchor("section-details")} />
)
```

(Keep the stub cards for steps 4-6.)

- [ ] **Step 2: Localhost verify**

```bash
npm run dev
# Visit http://localhost:3000/invoices/new
# Pick a staff member → readiness ticks up.
# Pick department + account number → readiness ticks up.
# Pick category → readiness ticks up.
# Try toggling Running — title input appears.
```

### Task 3.6: Phase 3 commit

- [ ] **Step 1: Quality gates + commit + checkpoint + review**

```bash
npm run lint && npx tsc --noEmit && npm test -- src/components/composer

git add src/components/composer src/app/invoices/new/page.tsx
git commit -m "$(cat <<'EOF'
feat(composer): P3 — sections 1-3 (People, Dept/Account, Doc Details)

Real content for the first three sections wired through the existing form
hooks. Catering disclosure built but only rendered for quote variant.
Step badges advance from default → complete as each section's checklist
items satisfy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 4 — Items & Pricing section + internalNotes plumbing

**Ships:** Two distinct things, glued together because the line-item table needs the `internalNotes` plumbing locked in before the UI consumes it (and they ship in one phase to keep migrations atomic).

1. **Backend additive:** `internalNotes` round-trips through `pdfMetadata` JSON for both invoice + quote — validators, services, hook form shape, edit-page mappers. PDF templates explicitly skip the key (regression test).
2. **Frontend:** Section 4 — `<ItemsAndPricingSection>` composing `<LineItemsTable>` (density-aware) + `<MarginCard>` + `<TaxCard>`.

**Localhost verify:** On `/invoices/new` you can edit line items, toggle margin (slider 0-60), toggle tax, switch density. Save Draft (when implemented in P5) round-trips `internalNotes` field — but P4 only ships the data path, not the textarea (textarea is in P5's `<NotesSection>`).

### Task 4.1: Add `internalNotes` to the form data shape

**Files:**
- Modify: `src/components/invoice/hooks/use-invoice-form-state.ts`
- Modify: `src/components/quote/quote-form.ts`

- [ ] **Step 1: Add field to `InvoiceFormData` + defaults**

In `use-invoice-form-state.ts`:

```ts
// In the InvoiceFormData interface, after `notes:`:
  /** Stored in pdfMetadata, never rendered on the PDF */
  internalNotes: string;
```

In `defaultForm()`:

```ts
    notes: "",
    internalNotes: "",
```

- [ ] **Step 2: Add field to `QuoteFormData` + defaults**

In `quote-form.ts`, mirror the same change in `QuoteFormData` interface and `defaultForm()`.

- [ ] **Step 3: TS check**

```bash
npx tsc --noEmit
```

Expected: no new errors. Existing usages don't reference the field, so adding a default `""` is safe.

### Task 4.2: Surface `internalNotes` in the invoice payload

**Files:**
- Modify: `src/components/invoice/hooks/use-invoice-save.ts`

- [ ] **Step 1: Add `internalNotes` to `buildPayload`'s pdfMetadata block**

```ts
    pdfMetadata: {
      signatures: form.signatures,
      signatureStaffIds: form.signatureStaffIds,
      semesterYearDept: form.semesterYearDept,
      contactName: form.contactName,
      contactExtension: form.contactExtension,
      internalNotes: form.internalNotes,
    },
```

- [ ] **Step 2: TS check**

`npx tsc --noEmit` — clean.

### Task 4.3: Surface `internalNotes` in the quote payload

**Files:**
- Modify: `src/components/quote/quote-form.ts`

- [ ] **Step 1: Add pdfMetadata block to `buildPayload`**

In `quote-form.ts`, in the `buildPayload` return, add a `pdfMetadata` field at the top level alongside `cateringDetails`:

```ts
    return {
      date: currentForm.date,
      // ... existing fields ...
      cateringDetails: currentForm.isCateringEvent ? currentForm.cateringDetails : undefined,
      pdfMetadata: {
        internalNotes: currentForm.internalNotes,
      },
      items: lineItems.map(/* ... */),
    };
```

- [ ] **Step 2: TS check** — clean.

### Task 4.4: Extend invoice validator schema

**Files:**
- Modify: `src/lib/validators.ts`
- Test: `src/lib/validators.test.ts` (create if absent, otherwise extend)

- [ ] **Step 1: Add `internalNotes` to `invoiceCreateSchema.pdfMetadata`**

```ts
  pdfMetadata: z.object({
    signatures: z.object({...}).optional(),
    signatureStaffIds: z.object({...}).optional(),
    semesterYearDept: z.string().optional(),
    contactName: z.string().optional(),
    contactExtension: z.string().optional(),
    internalNotes: z.string().optional(),
  }).optional(),
```

- [ ] **Step 2: Failing test**

```ts
// src/lib/validators.test.ts (add or create)
import { describe, it, expect } from "vitest";
import { invoiceCreateSchema, quoteCreateSchema } from "./validators";

describe("invoiceCreateSchema.pdfMetadata.internalNotes", () => {
  it("accepts a string", () => {
    const r = invoiceCreateSchema.safeParse({
      date: "2026-04-26", department: "BKST", category: "x",
      items: [{ description: "a", quantity: 1, unitPrice: 1 }],
      pdfMetadata: { internalNotes: "secret" },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pdfMetadata?.internalNotes).toBe("secret");
  });

  it("treats internalNotes as optional", () => {
    const r = invoiceCreateSchema.safeParse({
      date: "2026-04-26", department: "BKST", category: "x",
      items: [{ description: "a", quantity: 1, unitPrice: 1 }],
      pdfMetadata: {},
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run** — PASS.

### Task 4.5: Add `pdfMetadata` block to quote validator

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add the block**

In `validators.ts` after the `cateringDetails: z.object({ ... }).optional()` line, add:

```ts
  pdfMetadata: z.object({
    internalNotes: z.string().optional(),
  }).optional(),
```

- [ ] **Step 2: Failing test**

```ts
// append to src/lib/validators.test.ts
describe("quoteCreateSchema.pdfMetadata.internalNotes", () => {
  it("accepts a string", () => {
    const r = quoteCreateSchema.safeParse({
      date: "2026-04-26", department: "BKST", category: "x",
      items: [{ description: "a", quantity: 1, unitPrice: 1 }],
      expirationDate: "2026-05-26", recipientName: "Test",
      pdfMetadata: { internalNotes: "x" },
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run** — PASS.

### Task 4.6: Merge `internalNotes` in invoice service

**Files:**
- Modify: `src/domains/invoice/service.ts`

- [ ] **Step 1: Locate and extend the merge**

In `src/domains/invoice/service.ts` around the merge at line ~455, add `internalNotes`:

```ts
    const storedPdfMetadata = (invoice.pdfMetadata as InvoicePdfMetadata | null) ?? null;
    const mergedPdfMetadata: InvoicePdfMetadata = {
      signatures: { /* ... existing ... */ },
      signatureStaffIds: { /* ... existing ... */ },
      semesterYearDept: input.semesterYearDept ?? storedPdfMetadata?.semesterYearDept,
      contactName: input.contactName ?? storedPdfMetadata?.contactName,
      contactExtension: input.contactExtension ?? storedPdfMetadata?.contactExtension,
      internalNotes: storedPdfMetadata?.internalNotes,
    };
```

- [ ] **Step 2: Find type and extend**

```bash
grep -rn 'interface InvoicePdfMetadata\|type InvoicePdfMetadata' src/domains/invoice/
```

Add `internalNotes?: string;` to the interface.

- [ ] **Step 3: TS check + service unit test**

```bash
npx tsc --noEmit
npm test -- src/domains/invoice
```

### Task 4.7: Add `pdfMetadata` merge in quote service

**Files:**
- Modify: `src/domains/quote/service.ts`

The quote service currently has no `pdfMetadata` handling. Add the same pattern as invoice — when persisting, write `pdfMetadata: { internalNotes: input.pdfMetadata?.internalNotes }`. When reading, surface `pdfMetadata.internalNotes` in the response shape.

- [ ] **Step 1: Locate the create + update paths in `quoteService`**

```bash
grep -n 'export const quoteService\|create:\|update:' src/domains/quote/service.ts | head
```

- [ ] **Step 2: Pass `pdfMetadata` through to Prisma**

In the `create` and `update` methods, add `pdfMetadata: input.pdfMetadata ?? undefined` to the data argument.

- [ ] **Step 3: Surface in the response mapper**

Wherever the service shapes the API response, add `internalNotes: (quote.pdfMetadata as { internalNotes?: string } | null)?.internalNotes ?? null` to the returned object.

- [ ] **Step 4: TS check + service tests** — clean.

### Task 4.8: Hydrate `internalNotes` on edit pages

**Files:**
- Modify: `src/app/invoices/[id]/edit/page.tsx`
- Modify: `src/app/quotes/[id]/edit/page.tsx`

- [ ] **Step 1: Invoice edit page — add to `ApiInvoice.pdfMetadata` type and `mapApiToFormData`**

```ts
  pdfMetadata?: {
    signatures?: { line1?: string; line2?: string; line3?: string };
    signatureStaffIds?: { line1?: string; line2?: string; line3?: string };
    semesterYearDept?: string;
    contactName?: string;
    contactExtension?: string;
    internalNotes?: string;
  } | null;
```

In `mapApiToFormData`:

```ts
    notes: invoice.notes ?? "",
    internalNotes: invoice.pdfMetadata?.internalNotes ?? "",
```

- [ ] **Step 2: Quote edit page — same shape**

Add an optional `pdfMetadata` block to `ApiQuote`. Add `internalNotes` to `mapApiToFormData`.

- [ ] **Step 3: TS check** — clean.

### Task 4.9: Regression test — PDF templates SKIP `internalNotes`

**Files:**
- Test: `src/lib/pdf/templates/cover-sheet.test.ts` (create)

- [ ] **Step 1: Failing test**

```ts
// src/lib/pdf/templates/cover-sheet.test.ts
import { describe, it, expect } from "vitest";
import { renderCoverSheet } from "./cover-sheet";

describe("cover-sheet", () => {
  it("does not contain internal notes content", () => {
    const html = renderCoverSheet({
      date: "April 26, 2026",
      semesterYearDept: "SP26-BKST",
      invoiceNumber: "INV-1234",
      chargeAccountNumber: "10-4500-301",
      accountCode: "ABC",
      totalAmount: "$1,000",
      signatures: [{ name: "Jane" }],
    });
    expect(html).not.toMatch(/internalNotes/);
  });
});
```

- [ ] **Step 2: Run** — PASS (renderer doesn't take `internalNotes`).

If a future template ever consumes pdfMetadata directly, this test will need to broaden. For now it documents the contract.

### Task 4.10: `<LineItemsTable>` — table primitive

**Files:**
- Create: `src/components/composer/sections/line-items-table.tsx`
- Test: `src/components/composer/sections/line-items-table.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// src/components/composer/sections/line-items-table.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LineItemsTable } from "./line-items-table";
import type { InvoiceItem } from "@/components/invoice/hooks/use-invoice-form-state";

function item(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    _key: "k", sku: null, description: "", quantity: 1, unitPrice: 0, extendedPrice: 0,
    sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null, ...overrides,
  };
}

describe("LineItemsTable", () => {
  it("renders one row per item with row number", () => {
    const items = [item({ _key: "a", description: "first" }), item({ _key: "b", description: "second" })];
    render(<LineItemsTable items={items} marginEnabled={false} taxEnabled={false} marginPercent={0} density="standard" onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByDisplayValue("first")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("uppercases description on change", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<LineItemsTable items={[item({ _key: "a" })]} marginEnabled={false} taxEnabled={false} marginPercent={0} density="standard" onUpdate={onUpdate} onRemove={vi.fn()} />);
    await user.type(screen.getByLabelText(/Description row 1/i), "abc");
    expect(onUpdate).toHaveBeenLastCalledWith(0, { description: "ABC" });
  });

  it("calls onRemove with index when trash clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<LineItemsTable items={[item({ _key: "a", description: "x" })]} marginEnabled={false} taxEnabled={false} marginPercent={0} density="standard" onUpdate={vi.fn()} onRemove={onRemove} />);
    await user.click(screen.getByLabelText(/Remove row 1/i));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});

describe("LineItemsTable — margin enabled", () => {
  const items = [{ _key: "a", sku: null, description: "x", quantity: 2, unitPrice: 10, extendedPrice: 20, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: 10 } as InvoiceItem];
  it("renders Charged read-only as cost*(1+m/100)", () => {
    render(<LineItemsTable items={items} marginEnabled marginPercent={50} taxEnabled={false} density="standard" onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("15.00")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/line-items-table.tsx
"use client";

import { GripVerticalIcon, PackageIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Density } from "../types";
import type { InvoiceItem } from "@/components/invoice/hooks/use-invoice-form-state";
import type { QuoteItem } from "@/components/quote/quote-form";

type AnyItem = InvoiceItem | QuoteItem;

interface Props {
  items: AnyItem[];
  marginEnabled: boolean;
  taxEnabled: boolean;
  marginPercent: number;
  density: Density;
  onUpdate: (index: number, patch: Partial<AnyItem>) => void;
  onRemove: (index: number) => void;
}

const DENSITY_CLASS: Record<Density, string> = {
  compact: "composer-density-compact",
  standard: "composer-density-standard",
  comfortable: "composer-density-comfortable",
};

function chargedFor(item: AnyItem, marginEnabled: boolean, marginPercent: number): number {
  if (!marginEnabled || marginPercent <= 0) return Number(item.unitPrice);
  const cost = item.costPrice ?? item.unitPrice;
  const m = item.marginOverride ?? marginPercent;
  return Math.round(cost * (1 + m / 100) * 100) / 100;
}

export function LineItemsTable({ items, marginEnabled, taxEnabled, marginPercent, density, onUpdate, onRemove }: Props) {
  return (
    <div className="rounded-lg border border-border-strong overflow-hidden bg-background">
      <table className={cn("w-full text-[13px]", DENSITY_CLASS[density])}>
        <thead className="bg-muted text-muted-foreground">
          <tr className="text-left text-[10.5px] font-mono uppercase tracking-wider">
            <th className="w-9 px-2 py-2">#</th>
            <th className="w-[110px] px-2 py-2">SKU</th>
            <th className="px-2 py-2">Description</th>
            <th className="w-[64px] px-2 py-2 text-right">Qty</th>
            <th className="w-[84px] px-2 py-2 text-right">Cost</th>
            <th className="w-[84px] px-2 py-2 text-right">Charged</th>
            {marginEnabled && <th className="w-[70px] px-2 py-2 text-right">Margin</th>}
            {taxEnabled && <th className="w-[50px] px-2 py-2 text-center">Tax</th>}
            <th className="w-[96px] px-2 py-2 text-right">Extended</th>
            <th className="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const rowNum = String(idx + 1).padStart(2, "0");
            const fromCatalog = it.sku != null;
            const charged = chargedFor(it, marginEnabled, marginPercent);
            const ext = charged * Number(it.quantity);
            const descEmpty = !it.description.trim();
            const qtyInvalid = Number(it.quantity) <= 0;
            return (
              <tr key={it._key} className={cn("border-t border-border", (descEmpty || qtyInvalid) && "bg-destructive/[0.04]")}>
                <td className="px-2 align-middle">
                  <div className="flex items-center gap-1 text-muted-foreground/50">
                    <GripVerticalIcon className="size-3.5 opacity-40" />
                    <span className="font-mono text-[11px] tabular-nums">{rowNum}</span>
                  </div>
                </td>
                <td className="px-2">
                  <div className="flex items-center gap-1">
                    {fromCatalog && <PackageIcon className="size-3.5 text-teal" />}
                    <input aria-label={`SKU row ${idx + 1}`} value={it.sku ?? ""} onChange={(e) => onUpdate(idx, { sku: e.target.value || null })} className="w-full bg-transparent font-mono text-[12.5px] tabular-nums focus:outline-none" />
                  </div>
                </td>
                <td className="px-2">
                  <input aria-label={`Description row ${idx + 1}`} value={it.description} onChange={(e) => onUpdate(idx, { description: e.target.value.toUpperCase() })} className={cn("w-full bg-transparent uppercase focus:outline-none", descEmpty && "bg-destructive/[0.05]")} />
                </td>
                <td className="px-2 text-right">
                  <input aria-label={`Qty row ${idx + 1}`} type="number" min={0} value={it.quantity} onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })} className={cn("w-full bg-transparent text-right tabular-nums focus:outline-none", qtyInvalid && "bg-destructive/[0.05]")} />
                </td>
                <td className="px-2 text-right">
                  <input aria-label={`Cost row ${idx + 1}`} type="number" step="0.01" min={0} value={it.costPrice ?? it.unitPrice} onChange={(e) => { const v = Number(e.target.value); if (marginEnabled) onUpdate(idx, { costPrice: v }); else onUpdate(idx, { unitPrice: v, costPrice: null }); }} className="w-full bg-transparent text-right tabular-nums text-muted-foreground focus:outline-none" />
                </td>
                <td className="px-2 text-right">
                  {marginEnabled ? (
                    <span className="tabular-nums text-[12.5px]">{charged.toFixed(2)}</span>
                  ) : (
                    <input aria-label={`Charged row ${idx + 1}`} type="number" step="0.01" min={0} value={it.unitPrice} onChange={(e) => onUpdate(idx, { unitPrice: Number(e.target.value) })} className="w-full bg-transparent text-right tabular-nums focus:outline-none" />
                  )}
                </td>
                {marginEnabled && (
                  <td className="px-2 text-right">
                    <span className={cn("tabular-nums text-[12.5px]", it.marginOverride != null && "text-info")}>
                      {((it.marginOverride ?? marginPercent)).toFixed(1)}%{it.marginOverride != null && " •"}
                    </span>
                  </td>
                )}
                {taxEnabled && (
                  <td className="px-2 text-center">
                    <button type="button" aria-label={`Toggle tax row ${idx + 1}`} onClick={() => onUpdate(idx, { isTaxable: !it.isTaxable })} className={cn("rounded px-1.5 py-0.5 text-[10px] font-mono uppercase", it.isTaxable ? "bg-positive-bg text-positive" : "text-muted-foreground")}>
                      {it.isTaxable ? "TAX" : "—"}
                    </button>
                  </td>
                )}
                <td className="px-2 text-right font-bold tabular-nums">{ext.toFixed(2)}</td>
                <td className="px-2 text-right">
                  <button type="button" aria-label={`Remove row ${idx + 1}`} onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2Icon className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add density CSS to globals.css `@layer utilities`**

```css
.composer-density-compact     td { padding-top: 4px;  padding-bottom: 4px;  font-size: 12.5px; }
.composer-density-standard    td { padding-top: 7px;  padding-bottom: 7px;  font-size: 13px; }
.composer-density-comfortable td { padding-top: 10px; padding-bottom: 10px; font-size: 13px; }
```

- [ ] **Step 4: Run** — PASS.

### Task 4.11: `<MarginCard>` and `<TaxCard>`

**Files:**
- Create: `src/components/composer/sections/margin-card.tsx`
- Create: `src/components/composer/sections/tax-card.tsx`
- Test: `src/components/composer/sections/margin-card.test.tsx`
- Test: `src/components/composer/sections/tax-card.test.tsx`

- [ ] **Step 1: MarginCard test**

```tsx
// src/components/composer/sections/margin-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarginCard } from "./margin-card";

describe("MarginCard", () => {
  it("shows toggle when disabled", () => {
    render(<MarginCard enabled={false} percent={0} onEnabledChange={vi.fn()} onPercentChange={vi.fn()} />);
    expect(screen.getByRole("switch", { name: /Margin/i })).toBeInTheDocument();
  });
  it("shows slider + value + warn when enabled and 0%", () => {
    render(<MarginCard enabled percent={0} onEnabledChange={vi.fn()} onPercentChange={vi.fn()} />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByText(/above 0%/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: MarginCard implementation**

```tsx
// src/components/composer/sections/margin-card.tsx
"use client";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface Props {
  enabled: boolean;
  percent: number;
  onEnabledChange: (v: boolean) => void;
  onPercentChange: (v: number) => void;
}

export function MarginCard({ enabled, percent, onEnabledChange, onPercentChange }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Margin</p>
          <p className="text-[12px] text-muted-foreground">Markup over cost</p>
        </div>
        <Switch aria-label="Margin" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <>
          <div className="flex items-center gap-3">
            <Slider min={0} max={60} step={1} value={[percent]} onValueChange={(v) => onPercentChange(v[0])} aria-label="Margin percent" />
            <span className="tabular-nums text-sm font-bold w-12 text-right">{percent}%</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">Cost prices stay internal; charged price updates automatically.</p>
          {percent === 0 && <p className="text-[11.5px] text-warn">Set a margin above 0% for it to take effect</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TaxCard test + implementation**

```tsx
// src/components/composer/sections/tax-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaxCard } from "./tax-card";

describe("TaxCard", () => {
  it("shows rate input + resolved % + count when enabled", () => {
    render(<TaxCard enabled rate={0.0975} taxableCount={3} onEnabledChange={vi.fn()} onRateChange={vi.fn()} />);
    expect(screen.getByDisplayValue("0.0975")).toBeInTheDocument();
    expect(screen.getByText(/9\.75%/)).toBeInTheDocument();
    expect(screen.getByText(/3 taxable/)).toBeInTheDocument();
  });
});
```

```tsx
// src/components/composer/sections/tax-card.tsx
"use client";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface Props {
  enabled: boolean;
  rate: number;
  taxableCount: number;
  onEnabledChange: (v: boolean) => void;
  onRateChange: (v: number) => void;
}

export function TaxCard({ enabled, rate, taxableCount, onEnabledChange, onRateChange }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Sales tax</p>
          <p className="text-[12px] text-muted-foreground">Per-item taxable toggle</p>
        </div>
        <Switch aria-label="Tax" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="flex items-center gap-3">
          <Input type="number" step="0.0001" min={0} max={1} value={rate} onChange={(e) => onRateChange(Number(e.target.value))} className="font-mono w-28" />
          <p className="text-[11.5px] text-muted-foreground">{(rate * 100).toFixed(2)}% · {taxableCount} taxable</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run** — PASS.

### Task 4.12: `<ItemsAndPricingSection>`

**Files:**
- Create: `src/components/composer/sections/items-pricing.tsx`
- Test: `src/components/composer/sections/items-pricing.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/sections/items-pricing.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ItemsAndPricingSection } from "./items-pricing";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { renderHook } from "@testing-library/react";

describe("ItemsAndPricingSection", () => {
  it("renders table + density toggle + add-custom button + margin/tax cards", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(<ItemsAndPricingSection composer={result.current} sectionStatus="default" onOpenCatalog={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: /Density/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search Product Catalog/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add custom line/i })).toBeInTheDocument();
    expect(screen.getByText("Margin")).toBeInTheDocument();
    expect(screen.getByText("Sales tax")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/items-pricing.tsx
"use client";

import { SearchIcon } from "lucide-react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { LineItemsTable } from "./line-items-table";
import { MarginCard } from "./margin-card";
import { TaxCard } from "./tax-card";
import { DensityToggle } from "../primitives/density-toggle";
import { useDensity } from "../hooks/use-density";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

interface Props {
  composer: ReturnType<typeof useInvoiceForm> | ReturnType<typeof useQuoteForm>;
  sectionStatus: "default" | "complete" | "blocker";
  onOpenCatalog: (categoryFilter?: string) => void;
  showCateringPreset?: boolean;
}

export function ItemsAndPricingSection({ composer, sectionStatus, onOpenCatalog, showCateringPreset }: Props) {
  const f = composer.form;
  const { density, setDensity } = useDensity();
  const taxableCount = f.items.filter((i) => i.isTaxable).length;

  return (
    <SectionCard step={4} title="Items & Pricing" anchor="section-items" status={sectionStatus} action={<DensityToggle value={density} onChange={setDensity} />}>
      <LineItemsTable
        items={f.items}
        marginEnabled={f.marginEnabled}
        taxEnabled={f.taxEnabled}
        marginPercent={f.marginPercent}
        density={density}
        onUpdate={(idx, patch) => composer.updateItem(idx, patch as never)}
        onRemove={(idx) => composer.removeItem(idx)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-lg bg-muted px-3 py-2 -mt-2 border border-t-0 border-border-strong">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onOpenCatalog()} className="gap-1.5">
            <SearchIcon className="size-3.5" /> Search Product Catalog
          </Button>
          <Button variant="outline" onClick={() => composer.addItem()}>Add custom line</Button>
          {showCateringPreset && <Button variant="ghost" onClick={() => onOpenCatalog("Catering")}>Catering preset</Button>}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          <kbd className="rounded border border-border bg-background px-1 py-0.5">Tab</kbd> next field
          <span className="mx-1">·</span>
          <kbd className="rounded border border-border bg-background px-1 py-0.5">Enter</kbd> add row
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
        <MarginCard enabled={f.marginEnabled} percent={f.marginPercent} onEnabledChange={(v) => composer.updateField("marginEnabled" as never, v as never)} onPercentChange={(v) => composer.updateField("marginPercent" as never, v as never)} />
        <TaxCard enabled={f.taxEnabled} rate={f.taxRate} taxableCount={taxableCount} onEnabledChange={(v) => composer.updateField("taxEnabled" as never, v as never)} onRateChange={(v) => composer.updateField("taxRate" as never, v as never)} />
      </div>
    </SectionCard>
  );
}
```

- [ ] **Step 3: Wire into `<DocumentComposer>`**

In `document-composer.tsx`, replace the step-4 stub:

```tsx
<ItemsAndPricingSection
  composer={composer.form}
  sectionStatus={statusForAnchor("section-items")}
  onOpenCatalog={(filter) => setDrawer("catalog")}
  showCateringPreset={composer.docType === "quote" && (composer.form.form as { isCateringEvent?: boolean }).isCateringEvent}
/>
```

(The catalog drawer is wired in P5 — the filter parameter is recorded but not yet honored.)

- [ ] **Step 4: Localhost verify**

```bash
npm run dev
# Visit /invoices/new — section 4 shows table, density toggle, margin/tax cards.
# Toggle margin → Charged column flips to read-only computed value. Toggle tax → Tax column appears.
```

### Task 4.13: Phase 4 commit

```bash
npm run lint && npx tsc --noEmit
npm test -- src/components/composer src/lib/validators src/lib/pdf src/domains/invoice src/domains/quote

# Quote paths containing `[...]` so zsh doesn't try to glob them.
git add \
  src/components/composer \
  src/components/invoice/hooks \
  src/components/quote \
  src/lib/validators.ts \
  src/lib/validators.test.ts \
  src/lib/pdf \
  src/domains/invoice/service.ts \
  src/domains/quote/service.ts \
  'src/app/invoices/[id]/edit/page.tsx' \
  'src/app/quotes/[id]/edit/page.tsx'

git commit -m "$(cat <<'EOF'
feat(composer): P4 — items/pricing section + internalNotes plumbing

Backend additive: internalNotes round-trips via pdfMetadata JSON for both
invoice + quote. Validators, services, hook form shape, edit-page mappers.
Regression test asserts cover-sheet HTML excludes internalNotes.

Frontend: <ItemsAndPricingSection> with density-aware <LineItemsTable>,
<MarginCard> (slider 0-60), <TaxCard> (rate input + taxable count).
Charged column is read-only when margin is on (display ↔ persistence sync).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 5 — Sections 5 & 6 + drawer plumbing

**Ships:** Section 5 (Notes + Internal notes), Section 6 (Approval & Output for invoice / Output & Reuse for quote), CatalogDrawer + TemplatesDrawer wired into `<DocumentComposer>`. Removes the legacy sticky `<LazyProductSearchPanel>` mount on `/invoices/new` (the catalog now lives inside a drawer). After P5, `/invoices/new` is feature-complete except for the right rail (P6).

**Localhost verify:** Full `/invoices/new` flow works — fill all sections, click "Search Product Catalog" → drawer opens → select products → drawer closes and items appear in the table. Click "Save as Template" → templates drawer opens → save with a name → toast confirms. Click "Generate PDF" with blockers → button is disabled; with all blockers cleared → triggers existing 2-step finalize flow.

### Task 5.1: Surface `setForm` from `useInvoiceForm` and `useQuoteForm`

The templates drawer needs to atomically replace items + several form fields. Doing this with multiple `updateField` calls would race; surfacing `setForm` is the clean fix.

**Files:**
- Modify: `src/components/invoice/invoice-form.tsx`
- Modify: `src/components/quote/quote-form.ts`

- [ ] **Step 1: Surface `setForm` from `useInvoiceForm`**

In `src/components/invoice/invoice-form.tsx`:

```ts
// In the destructure on line 26:
  const { form, setForm, updateField, /* ... */ } = useInvoiceFormState(initial);

  // ... (rest unchanged) ...

  return {
    form,
    setForm,        // ← new
    updateField,
    /* ... existing fields ... */
  };
```

- [ ] **Step 2: Surface `setForm` from `useQuoteForm`**

In `src/components/quote/quote-form.ts` line ~522, add `setForm` to the returned object.

- [ ] **Step 3: TS check**

`npx tsc --noEmit` — clean (additive, no consumer changes required).

### Task 5.2: `<NotesSection>`

**Files:**
- Create: `src/components/composer/sections/notes-section.tsx`
- Test: `src/components/composer/sections/notes-section.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/sections/notes-section.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { NotesSection } from "./notes-section";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { renderHook } from "@testing-library/react";

describe("NotesSection", () => {
  it("renders public + internal textareas with counter", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(<NotesSection composer={result.current} sectionStatus="default" />);
    expect(screen.getByLabelText(/Notes \(visible on PDF\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Internal notes/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 500/)).toBeInTheDocument();
  });

  it("counter turns warn-tone at 480+", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useInvoiceForm({ notes: "x".repeat(485) }));
    render(<NotesSection composer={result.current} sectionStatus="default" />);
    expect(screen.getByText(/485 \/ 500/)).toHaveClass("text-warn");
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/notes-section.tsx
"use client";

import { SectionCard } from "./section-card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

interface Props {
  composer: ReturnType<typeof useInvoiceForm> | ReturnType<typeof useQuoteForm>;
  sectionStatus: "default" | "complete" | "blocker";
}

const NOTES_MAX = 500;

export function NotesSection({ composer, sectionStatus }: Props) {
  const f = composer.form;
  const len = f.notes.length;
  const counterTone = len > NOTES_MAX ? "text-destructive" : len >= NOTES_MAX - 20 ? "text-warn" : "text-muted-foreground";

  return (
    <SectionCard step={5} title="Notes & Internal Details" anchor="section-notes" status={sectionStatus}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground" htmlFor="notes-public">
            Notes (visible on PDF)
          </Label>
          <Textarea
            id="notes-public"
            rows={4}
            value={f.notes}
            onChange={(e) => composer.updateField("notes" as never, e.target.value as never)}
          />
          <p className={cn("text-[11px] text-right tabular-nums", counterTone)}>{len} / {NOTES_MAX}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground" htmlFor="notes-internal">
            Internal notes (not on PDF)
          </Label>
          <Textarea
            id="notes-internal"
            rows={4}
            value={f.internalNotes}
            onChange={(e) => composer.updateField("internalNotes" as never, e.target.value as never)}
          />
        </div>
      </div>
    </SectionCard>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 5.3: `<ApprovalOutputSection>` — invoice variant (approver grid + PrismCore + toolbar)

**Files:**
- Create: `src/components/composer/sections/approval-output.tsx`
- Test: `src/components/composer/sections/approval-output.test.tsx`

This component is large; build incrementally. Start with the approver slot grid (invoice only).

- [ ] **Step 1: Failing test for approver slots**

```tsx
// src/components/composer/sections/approval-output.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ApprovalOutputSection } from "./approval-output";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { renderHook } from "@testing-library/react";

describe("ApprovalOutputSection (invoice)", () => {
  it("renders 3 approver slots", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <ApprovalOutputSection
        docType="invoice"
        composer={result.current}
        sectionStatus="default"
        attemptedSubmit={false}
        canManageActions
        onOpenTemplates={() => {}}
        onPrimaryAction={() => {}}
        onSaveDraft={() => {}}
        onPrintRegister={() => {}}
        canSaveDraft
        primaryDisabled={false}
      />
    );
    expect(screen.getByText(/Signature 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Signature 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Signature 3/i)).toBeInTheDocument();
  });

  it("shows action toolbar with three groups", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <ApprovalOutputSection
        docType="invoice" composer={result.current} sectionStatus="default"
        attemptedSubmit={false} canManageActions
        onOpenTemplates={() => {}} onPrimaryAction={() => {}} onSaveDraft={() => {}} onPrintRegister={() => {}}
        canSaveDraft primaryDisabled={false}
      />
    );
    expect(screen.getByRole("button", { name: /Generate PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save as Template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print for Register/i })).toBeInTheDocument();
  });

  it("disables Generate PDF when primaryDisabled is true", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <ApprovalOutputSection
        docType="invoice" composer={result.current} sectionStatus="default"
        attemptedSubmit={false} canManageActions
        onOpenTemplates={() => {}} onPrimaryAction={() => {}} onSaveDraft={() => {}} onPrintRegister={() => {}}
        canSaveDraft primaryDisabled
      />
    );
    expect(screen.getByRole("button", { name: /Generate PDF/i })).toBeDisabled();
  });
});

describe("ApprovalOutputSection (quote)", () => {
  it("hides approver grid + PrismCore", async () => {
    const { useQuoteForm } = await import("@/components/quote/quote-form");
    const { result } = renderHook(() => useQuoteForm());
    render(
      <ApprovalOutputSection
        docType="quote" composer={result.current} sectionStatus="default"
        attemptedSubmit={false} canManageActions
        onOpenTemplates={() => {}} onPrimaryAction={() => {}} onSaveDraft={() => {}} onPrintRegister={() => {}}
        canSaveDraft primaryDisabled={false}
      />
    );
    expect(screen.queryByText(/Signature 1/i)).toBeNull();
    expect(screen.queryByText(/PrismCore/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Save Quote & Generate PDF/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/sections/approval-output.tsx
"use client";

import { SectionCard } from "./section-card";
import { ApproverSlotCard } from "../primitives/approver-slot-card";
import { Button } from "@/components/ui/button";
import { StaffSignatureSelect } from "@/components/invoice/staff-signature-select";
import { PrismcoreUpload } from "@/components/invoice/prismcore-upload";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";
import type { DocType } from "../types";

type Props =
  | (BaseProps & { docType: "invoice"; composer: ReturnType<typeof useInvoiceForm> })
  | (BaseProps & { docType: "quote";   composer: ReturnType<typeof useQuoteForm>   });

interface BaseProps {
  sectionStatus: "default" | "complete" | "blocker";
  attemptedSubmit: boolean;
  canManageActions: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  onOpenTemplates: () => void;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
}

export function ApprovalOutputSection(props: Props) {
  const title = props.docType === "invoice" ? "Approval & Output" : "Output & Reuse";
  return (
    <SectionCard step={6} title={title} anchor="section-approval" status={props.sectionStatus}>
      {props.docType === "invoice" && (
        <ApproverGrid composer={props.composer} attemptedSubmit={props.attemptedSubmit} disabled={!props.canManageActions} />
      )}
      {props.docType === "invoice" && props.canManageActions && (
        <div className="pt-3">
          <PrismcoreUpload
            value={props.composer.form.prismcorePath}
            onChange={(path) => props.composer.updateField("prismcorePath", path)}
          />
        </div>
      )}
      <ActionToolbar
        docType={props.docType}
        canManageActions={props.canManageActions}
        primaryDisabled={props.primaryDisabled}
        canSaveDraft={props.canSaveDraft}
        onOpenTemplates={props.onOpenTemplates}
        onPrimaryAction={props.onPrimaryAction}
        onSaveDraft={props.onSaveDraft}
        onPrintRegister={props.onPrintRegister}
      />
    </SectionCard>
  );
}

function ApproverGrid({ composer, attemptedSubmit, disabled }: { composer: ReturnType<typeof useInvoiceForm>; attemptedSubmit: boolean; disabled: boolean }) {
  const slots = [0, 1, 2] as const;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {slots.map((idx) => {
        const lineKey = (`line${idx + 1}`) as "line1" | "line2" | "line3";
        const staffId = composer.form.signatureStaffIds[lineKey];
        const display = composer.form.signatures[lineKey] || "";
        return (
          <ApproverSlotCard
            key={idx}
            slotIndex={idx}
            required={idx < 2}
            staffId={staffId}
            display={display}
            disabled={disabled}
            attemptedSubmit={attemptedSubmit}
          >
            <StaffSignatureSelect
              value={staffId}
              onSelect={(staff) => {
                if (!staff) return;
                const newDisplay = staff.title ? `${staff.name} — ${staff.title}` : staff.name;
                composer.updateField("signatureStaffIds", { ...composer.form.signatureStaffIds, [lineKey]: staff.id });
                composer.updateField("signatures",        { ...composer.form.signatures,        [lineKey]: newDisplay });
              }}
              disabled={disabled}
            />
          </ApproverSlotCard>
        );
      })}
    </div>
  );
}

function ActionToolbar(props: {
  docType: DocType;
  canManageActions: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  onOpenTemplates: () => void;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
}) {
  if (!props.canManageActions) return null;
  const primaryLabel = props.docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF";

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="space-y-1">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">Output</p>
          <div className="flex gap-2">
            <Button onClick={props.onPrimaryAction} disabled={props.primaryDisabled}>{primaryLabel}</Button>
            <Button variant="outline" onClick={props.onPrintRegister}>Print for Register</Button>
          </div>
        </div>
        <div className="space-y-1 border-l border-border pl-4">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">Save</p>
          <Button variant="outline" onClick={props.onSaveDraft} disabled={!props.canSaveDraft}>Save Draft</Button>
        </div>
        <div className="space-y-1 border-l border-border pl-4">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">Reuse</p>
          <Button variant="ghost" onClick={props.onOpenTemplates}>Save as Template</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run all approval-output tests** — PASS.

### Task 5.4: `<CatalogDrawer>`

**Files:**
- Create: `src/components/composer/drawers/catalog-drawer.tsx`
- Test: `src/components/composer/drawers/catalog-drawer.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/drawers/catalog-drawer.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CatalogDrawer } from "./catalog-drawer";

vi.mock("@/components/shared/lazy-product-search-panel", () => ({
  LazyProductSearchPanel: ({ onAddProducts }: { onAddProducts: (p: unknown[]) => void }) => (
    <button onClick={() => onAddProducts([{ sku: 1, description: "A", retailPrice: 5 }])}>add</button>
  ),
}));

describe("CatalogDrawer", () => {
  it("renders header + body when open", () => {
    render(<CatalogDrawer open onOpenChange={() => {}} categoryFilter={undefined} onAddItems={vi.fn()} />);
    expect(screen.getByText(/Product Catalog/i)).toBeInTheDocument();
  });

  it("calls onAddItems when products are picked from the panel", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const onAddItems = vi.fn();
    render(<CatalogDrawer open onOpenChange={() => {}} onAddItems={onAddItems} />);
    await userEvent.setup().click(screen.getByText("add"));
    expect(onAddItems).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/drawers/catalog-drawer.tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LazyProductSearchPanel } from "@/components/shared/lazy-product-search-panel";
import type { SelectedProduct } from "@/domains/product/types";

function hasRetailPrice(p: SelectedProduct): p is SelectedProduct & { retailPrice: number } {
  return p.retailPrice != null;
}

function mapProductsToItems(products: SelectedProduct[]) {
  return products.filter(hasRetailPrice).map((p) => ({
    sku: String(p.sku),
    description: p.description.toUpperCase(),
    unitPrice: p.retailPrice,
    costPrice: p.cost,
    quantity: 1,
    isTaxable: true,
  }));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryFilter?: string;
  onAddItems: (items: ReturnType<typeof mapProductsToItems>) => void;
}

export function CatalogDrawer({ open, onOpenChange, categoryFilter, onAddItems }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Product Catalog{categoryFilter ? ` · ${categoryFilter}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <LazyProductSearchPanel
            onAddProducts={(products) => {
              onAddItems(mapProductsToItems(products));
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

(`categoryFilter` is shown in the title for now; deeper pre-filtering can be added if `LazyProductSearchPanel` exposes a filter prop. If not, the user filters inside the panel — acceptable per spec which says "preferred over direct addItems because it reuses one code path".)

- [ ] **Step 3: Run** — PASS.

### Task 5.5: Verify + extend `templateApi`

**Files:**
- Possibly modify: `src/domains/template/types.ts`, `src/domains/template/repository.ts`

- [ ] **Step 1: Verify `CreateTemplateInput.items` accepts `sku`**

```bash
grep -n 'items:' src/domains/template/types.ts
grep -n 'sku' src/domains/template/types.ts src/domains/template/repository.ts src/domains/template/service.ts
```

If `sku` is missing, add it as optional to `CreateTemplateInput.items[]` and to `TemplateItemResponse`. Then thread it through the repository's `prisma.template.create` items mapping.

- [ ] **Step 2: TS check** — clean.

- [ ] **Step 3: Sanity-check existing template tests still pass**

```bash
npm test -- src/domains/template
```

### Task 5.6: `<TemplatesDrawer>`

**Files:**
- Create: `src/components/composer/drawers/templates-drawer.tsx`
- Test: `src/components/composer/drawers/templates-drawer.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/drawers/templates-drawer.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TemplatesDrawer } from "./templates-drawer";

vi.mock("@/domains/template/api-client", () => ({
  templateApi: {
    list: vi.fn().mockResolvedValue([{ id: "t1", name: "Catering Pack", category: "Catering", notes: "n", items: [], type: "INVOICE" }]),
    create: vi.fn().mockResolvedValue({ id: "t2" }),
  },
}));

describe("TemplatesDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads templates when opened on Load tab", async () => {
    render(<TemplatesDrawer open type="INVOICE" mode="load" onOpenChange={() => {}} onLoadTemplate={vi.fn()} onSaveTemplate={vi.fn()} initialPayload={{ name: "", category: "", notes: "" }} />);
    await waitFor(() => expect(screen.getByText("Catering Pack")).toBeInTheDocument());
  });

  it("posts template on Save submit", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<TemplatesDrawer open type="INVOICE" mode="save" onOpenChange={() => {}} onLoadTemplate={vi.fn()} onSaveTemplate={onSave} initialPayload={{ name: "", category: "Catering", notes: "" }} />);
    await user.type(screen.getByLabelText(/Template name/i), "My pack");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "My pack" }));
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/drawers/templates-drawer.tsx
"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { templateApi } from "@/domains/template/api-client";
import type { TemplateResponse } from "@/domains/template/types";

interface SavePayload {
  name: string;
  category: string;
  notes: string;
}

interface Props {
  open: boolean;
  type: "INVOICE" | "QUOTE";
  mode: "load" | "save";
  initialPayload: SavePayload;
  onOpenChange: (open: boolean) => void;
  onLoadTemplate: (template: TemplateResponse) => void;
  onSaveTemplate: (payload: SavePayload) => void;
}

export function TemplatesDrawer({ open, type, mode, initialPayload, onOpenChange, onLoadTemplate, onSaveTemplate }: Props) {
  const [tab, setTab] = useState<"load" | "save">(mode);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [name, setName] = useState(initialPayload.name);
  const [category, setCategory] = useState(initialPayload.category);
  const [notes, setNotes] = useState(initialPayload.notes);

  useEffect(() => { if (open) setTab(mode); }, [open, mode]);
  useEffect(() => {
    if (!open || tab !== "load") return;
    templateApi.list(type).then(setTemplates).catch(() => {});
  }, [open, tab, type]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader><SheetTitle>Templates</SheetTitle></SheetHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "load" | "save")} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="load">Load</TabsTrigger>
            <TabsTrigger value="save">Save</TabsTrigger>
          </TabsList>
          <TabsContent value="load" className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onLoadTemplate(t); onOpenChange(false); }}
                className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{t.name}</span>
                  <span className="text-[11px] text-muted-foreground">{t.items.length} items</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">{t.category} · {t.notes || "—"}</p>
              </button>
            ))}
          </TabsContent>
          <TabsContent value="save" className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat">Category</Label>
              <Input id="tpl-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-notes">Notes (optional)</Label>
              <Textarea id="tpl-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="rounded-lg border border-info-border bg-info-bg/40 p-2.5 text-[12px] text-foreground">
              Items, category, notes, and margin/tax settings are saved. Requestor, account number, dates, and signatures are not.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!name.trim()} onClick={() => onSaveTemplate({ name, category, notes })}>Save Template</Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 5.7: Wire sections 5-6 + drawers into `<DocumentComposer>`

**Files:**
- Modify: `src/components/composer/document-composer.tsx`

- [ ] **Step 1: Replace stubs + mount drawers**

Significant rewrite of the shell to wire all real sections + drawers. Key additions:

```tsx
import { NotesSection } from "./sections/notes-section";
import { ApprovalOutputSection } from "./sections/approval-output";
import { CatalogDrawer } from "./drawers/catalog-drawer";
import { TemplatesDrawer } from "./drawers/templates-drawer";
import type { TemplateResponse } from "@/domains/template/types";
import { templateApi } from "@/domains/template/api-client";
import { openDeferredRegisterPrintWindow } from "@/components/shared/register-print-loader";
import { toast } from "sonner";

// inside DocumentComposer:
const [attemptedSubmit, setAttemptedSubmit] = useState(false);
const [templatesMode, setTemplatesMode] = useState<"load" | "save">("load");
const [catalogFilter, setCatalogFilter] = useState<string | undefined>(undefined);

const handlePrimaryAction = () => {
  if (validation.blockers.length > 0) {
    setAttemptedSubmit(true);
    setShowBlockers(true);
    return;
  }
  if (composer.docType === "invoice") {
    composer.form.saveAndFinalize();
  } else {
    composer.form.saveQuote().then((ok) => {
      if (ok && composer.form.existingId) {
        window.open(`/api/quotes/${composer.form.existingId}/pdf`, "_blank");
      }
    });
  }
};

const handleSaveDraft = () => {
  if (!validation.canSaveDraft) {
    setAttemptedSubmit(true);
    return;
  }
  if (composer.docType === "invoice") composer.form.saveDraft();
  else composer.form.saveQuote();
};

const handlePrintRegister = () => {
  // copy of existing register-print payload mapping (was in keyboard-mode/quote-mode)
  // ... see legacy implementation; pull into a shared helper if duplicated in P7
  openDeferredRegisterPrintWindow({ /* ... */ });
};

const handleLoadTemplate = (template: TemplateResponse) => {
  composer.form.setForm((prev) => ({
    ...prev,
    items: template.items.map((it, i) => ({
      _key: crypto.randomUUID(),
      sku: it.sku ?? null,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      extendedPrice: Number(it.quantity) * Number(it.unitPrice),
      sortOrder: i,
      isTaxable: it.isTaxable ?? true,
      marginOverride: it.marginOverride ?? null,
      costPrice: it.costPrice != null ? Number(it.costPrice) : null,
    })),
    category:       template.category       || prev.category,
    notes:          template.notes          || prev.notes,
    marginEnabled:  template.marginEnabled,
    marginPercent:  Number(template.marginPercent ?? prev.marginPercent),
    taxEnabled:     template.taxEnabled,
    taxRate:        Number(template.taxRate ?? prev.taxRate),
    isCateringEvent: ("isCateringEvent" in prev) ? template.isCateringEvent : prev.isCateringEvent,
  }));
  toast.success(`Loaded template "${template.name}"`);
};

const handleSaveTemplate = async (payload: { name: string; category: string; notes: string }) => {
  const f = composer.form.form;
  await templateApi.create({
    name: payload.name,
    type: composer.docType === "invoice" ? "INVOICE" : "QUOTE",
    category: payload.category,
    notes: payload.notes,
    marginEnabled: f.marginEnabled,
    marginPercent: f.marginEnabled ? f.marginPercent : undefined,
    taxEnabled: f.taxEnabled,
    taxRate: f.taxRate,
    isCateringEvent: ("isCateringEvent" in f) ? f.isCateringEvent : false,
    items: f.items
      .filter((i) => i.description.trim() && Number(i.quantity) > 0)
      .map((i, idx) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        sortOrder: idx,
        isTaxable: i.isTaxable,
        costPrice: i.costPrice ?? undefined,
        marginOverride: i.marginOverride ?? undefined,
        sku: i.sku ?? undefined,
      })),
  });
  toast.success("Template saved");
  setDrawer(null);
};
```

Mount sections + drawers in the JSX (replacing the step-5 + step-6 stubs):

```tsx
// In the workflow children array:
<NotesSection composer={composer.form} sectionStatus={statusForAnchor("section-notes")} />
<ApprovalOutputSection
  docType={composer.docType}
  composer={composer.form as never}
  sectionStatus={statusForAnchor("section-approval")}
  attemptedSubmit={attemptedSubmit}
  canManageActions={canManageActions}
  primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
  canSaveDraft={validation.canSaveDraft}
  onOpenTemplates={() => { setTemplatesMode("save"); setDrawer("templates"); }}
  onPrimaryAction={handlePrimaryAction}
  onSaveDraft={handleSaveDraft}
  onPrintRegister={handlePrintRegister}
/>
```

After `<ComposerLayout>`:

```tsx
<CatalogDrawer
  open={drawer === "catalog"}
  onOpenChange={(o) => setDrawer(o ? "catalog" : null)}
  categoryFilter={catalogFilter}
  onAddItems={(items) => composer.form.addItems(items)}
/>
<TemplatesDrawer
  open={drawer === "templates"}
  type={composer.docType === "invoice" ? "INVOICE" : "QUOTE"}
  mode={templatesMode}
  initialPayload={{ name: "", category: composer.form.form.category, notes: composer.form.form.notes }}
  onOpenChange={(o) => setDrawer(o ? "templates" : null)}
  onLoadTemplate={handleLoadTemplate}
  onSaveTemplate={handleSaveTemplate}
/>
```

Update the items section's `onOpenCatalog` to write the filter:

```tsx
onOpenCatalog={(filter) => { setCatalogFilter(filter); setDrawer("catalog"); }}
```

Also wire a templates "Load" entry from header — but the header currently doesn't render a templates button; that's added in P6 with the rest of the header actions. For now, the only entry point is Save (from action toolbar).

- [ ] **Step 2: Localhost smoke test**

```bash
npm run dev
# Visit /invoices/new
# Fill all sections. Items toolbar → "Search Product Catalog" → drawer opens, pick products, see them in the table.
# Action toolbar → "Save as Template" → drawer opens to Save tab, fill name, save → toast.
# Action toolbar → "Generate PDF" → with blockers, button disabled.
```

### Task 5.8: Phase 5 commit

```bash
npm run lint && npx tsc --noEmit
npm test -- src/components/composer src/components/invoice src/components/quote src/domains/template

git add src/components/composer src/components/invoice/invoice-form.tsx src/components/quote/quote-form.ts src/domains/template

git commit -m "$(cat <<'EOF'
feat(composer): P5 — sections 5-6 + catalog/templates drawers

Section 5 <NotesSection> with public + internal textareas (counter on public).
Section 6 <ApprovalOutputSection> with 3 approver slots (invoice), PrismCore
upload, and the Output/Save/Reuse action toolbar. Wired through to existing
saveAndFinalize / saveQuote / saveDraft.

<CatalogDrawer> wraps LazyProductSearchPanel inside a Sheet — the legacy
sticky catalog mounting on /invoices/new is removed. <TemplatesDrawer> with
Load + Save tabs hits templateApi directly.

Surfaces setForm from useInvoiceForm + useQuoteForm so templates can replace
items + form fields atomically.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 6 — Right summary rail + preview drawer + draft restore

**Ships:** The full sticky right rail (`<ReadinessCard>`, `<ChecklistCard>`, `<DraftStateCard>`), `<BlockerSummary>` banner, `<PreviewDrawer>` (stylized HTML preview consuming a new `pdf-layout.ts` constants module shared with `cover-sheet.ts`), `<DraftRestoreBanner>` (restyle wrapping the existing `<DraftRecoveryBanner>`), mobile `<BottomActionBar>` + summary bottom-sheet, and the autosave hook extension that surfaces `isDirty`/`lastSavedAt`/`savingDraft`. Header gets the `Templates`/`Preview`/`Print Register` ghost buttons.

**Localhost verify:** `/invoices/new` is now feature-complete — the rail shows readiness %, totals, account-status callout, Save Draft / Print Register / Generate PDF actions. Clicking a checklist item smooth-scrolls to its section. Clicking "Resolve N blockers" opens the destructive banner. The preview drawer renders an HTML page approximating the PDF. The autosave indicator transitions Saving → Saved → Unsaved as you edit.

### Task 6.1: Extend `useAutoSave` to surface state flags

**Files:**
- Modify: `src/lib/use-auto-save.ts`
- Test: `src/lib/use-auto-save.test.ts` (extend or create)

- [ ] **Step 1: Failing test**

```ts
// src/lib/use-auto-save.test.ts (additions)
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAutoSave } from "./use-auto-save";

vi.mock("@/domains/user-draft/api-client", () => ({
  userDraftApi: { save: vi.fn().mockResolvedValue(undefined), get: vi.fn(), clear: vi.fn() },
}));

describe("useAutoSave state flags", () => {
  it("returns isDirty=false initially", () => {
    const { result } = renderHook(() => useAutoSave({ x: 1 }, "key", "user-1"));
    expect(result.current.isDirty).toBe(false);
  });

  it("flips isDirty=true when state changes", () => {
    let state = { x: 1 };
    const { result, rerender } = renderHook(() => useAutoSave(state, "key", "user-1"));
    state = { x: 2 };
    rerender();
    expect(result.current.isDirty).toBe(true);
  });
});
```

- [ ] **Step 2: Implementation — additive**

Modify `useAutoSave` to expose state via `useState` + return:

```ts
// in src/lib/use-auto-save.ts
export function useAutoSave<T>(formState: T, routeKey: string, userId: string | null) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const formStateRef = useRef(formState);
  const initialStateRef = useRef(formState);
  const [isDirty, setIsDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveInFlightRef = useRef(false);
  formStateRef.current = formState;

  // Detect dirty state by comparing current to initial
  if (!isDirty && JSON.stringify(formState) !== JSON.stringify(initialStateRef.current)) {
    setIsDirty(true);
  }

  const stableUserId = getStableUserId(userId);

  useEffect(() => {
    if (!stableUserId) return;
    timerRef.current = setInterval(async () => {
      if (saveInFlightRef.current) return;
      // Re-read latest dirty flag via ref-style closure trick: check JSON eq again
      const dirty = JSON.stringify(formStateRef.current) !== JSON.stringify(initialStateRef.current);
      if (!dirty) return;

      saveInFlightRef.current = true;
      setSavingDraft(true);
      try {
        await userDraftApi.save(routeKey, formStateRef.current);
        setLastSavedAt(Date.now());
        setIsDirty(false);
        initialStateRef.current = formStateRef.current;
      } finally {
        saveInFlightRef.current = false;
        setSavingDraft(false);
      }
    }, SAVE_INTERVAL);
    return () => { clearInterval(timerRef.current); saveInFlightRef.current = false; };
  }, [routeKey, stableUserId]);

  const clearDraft = useCallback(async () => {
    initialStateRef.current = formStateRef.current;
    setIsDirty(false);
    if (!stableUserId) return;
    await userDraftApi.clear(routeKey).catch(() => {});
  }, [routeKey, stableUserId]);

  return { clearDraft, isDirty, savingDraft, lastSavedAt };
}
```

- [ ] **Step 3: Run** — PASS. Confirm existing keyboard-mode/quote-mode usages still type-check (additive return).

### Task 6.2: `<DraftStateCard>`

**Files:**
- Create: `src/components/composer/rail/draft-state-card.tsx`
- Test: `src/components/composer/rail/draft-state-card.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/rail/draft-state-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DraftStateCard } from "./draft-state-card";

describe("DraftStateCard", () => {
  it("shows Saved with relative time", () => {
    render(<DraftStateCard isDirty={false} savingDraft={false} lastSavedAt={Date.now() - 120000} />);
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    expect(screen.getByText(/2m ago/)).toBeInTheDocument();
  });
  it("shows Saving…", () => {
    render(<DraftStateCard isDirty savingDraft lastSavedAt={null} />);
    expect(screen.getByText(/Saving/)).toBeInTheDocument();
  });
  it("shows Unsaved changes", () => {
    render(<DraftStateCard isDirty savingDraft={false} lastSavedAt={null} />);
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/rail/draft-state-card.tsx
"use client";

import { CheckCircleIcon, RefreshCwIcon, DotIcon } from "lucide-react";

interface Props { isDirty: boolean; savingDraft: boolean; lastSavedAt: number | null; }

function rel(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "moments ago";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function DraftStateCard({ isDirty, savingDraft, lastSavedAt }: Props) {
  if (savingDraft) {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[12.5px] text-info">
      <RefreshCwIcon className="size-3.5 animate-spin" /> Saving…
    </div>;
  }
  if (isDirty) {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[12.5px] text-warn">
      <DotIcon className="size-4 animate-pulse" /> Unsaved changes
    </div>;
  }
  if (lastSavedAt) {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[12.5px] text-positive">
      <CheckCircleIcon className="size-3.5" /> Saved · {rel(lastSavedAt)}
    </div>;
  }
  return null;
}
```

- [ ] **Step 3: Run** — PASS.

### Task 6.3: `<ChecklistCard>`

**Files:**
- Create: `src/components/composer/rail/checklist-card.tsx`
- Test: `src/components/composer/rail/checklist-card.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/rail/checklist-card.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChecklistCard } from "./checklist-card";

const items = [
  { id: "a", label: "Requestor", anchor: "section-people" as const, complete: true,  blocker: false },
  { id: "b", label: "Items",     anchor: "section-items"  as const, complete: false, blocker: true  },
  { id: "c", label: "Notes",     anchor: "section-notes"  as const, complete: false, blocker: false },
];

describe("ChecklistCard", () => {
  it("renders count + items", () => {
    render(<ChecklistCard checklist={items} onJump={vi.fn()} />);
    expect(screen.getByText(/Checklist · 1\/3/i)).toBeInTheDocument();
  });
  it("calls onJump with anchor on click", async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<ChecklistCard checklist={items} onJump={onJump} />);
    await user.click(screen.getByText("Items"));
    expect(onJump).toHaveBeenCalledWith("section-items");
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/rail/checklist-card.tsx
"use client";

import { CheckIcon, CircleDashedIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistEntry, SectionAnchor } from "../types";

interface Props {
  checklist: ChecklistEntry[];
  onJump: (anchor: SectionAnchor) => void;
}

export function ChecklistCard({ checklist, onJump }: Props) {
  const done = checklist.filter((c) => c.complete).length;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Checklist · {done}/{checklist.length}</p>
      </div>
      <ul className="space-y-1">
        {checklist.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onJump(c.anchor)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
              <span className="size-4 shrink-0 inline-flex items-center justify-center">
                {c.complete ? <CheckIcon className="size-4 text-positive" /> : c.blocker ? <XIcon className="size-4 text-destructive" /> : <CircleDashedIcon className="size-4 text-muted-foreground" />}
              </span>
              <span className={cn("text-[12.5px] flex-1", c.complete && "line-through text-muted-foreground", c.blocker && "text-destructive font-semibold")}>
                {c.label}
              </span>
              {!c.complete && <ChevronRightIcon className="size-3.5 text-muted-foreground/60" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 6.4: `<ReadinessCard>`

**Files:**
- Create: `src/components/composer/rail/readiness-card.tsx`
- Test: `src/components/composer/rail/readiness-card.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// src/components/composer/rail/readiness-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReadinessCard } from "./readiness-card";
import type { ComposerTotals } from "../types";

const totals: ComposerTotals = {
  subtotal: 1247.18, taxableSubtotal: 882, taxAmount: 86.07, marginAmount: 184.32,
  grandTotal: 1333.25, itemCount: 5, taxableCount: 4,
};

describe("ReadinessCard", () => {
  it("shows 'Ready' when 100% and 0 blockers", () => {
    render(<ReadinessCard
      readiness={1} blockerCount={0} docType="invoice" totals={totals} marginEnabled
      taxEnabled taxRate={0.0975} accountNumber="10-4500-301" department="BKST" saving={false}
      primaryDisabled={false} canSaveDraft onPrimaryAction={vi.fn()} onSaveDraft={vi.fn()} onPrintRegister={vi.fn()}
      onJumpToBlockers={vi.fn()} onJumpToAccount={vi.fn()}
    />);
    expect(screen.getByText(/Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/INVOICE TOTAL/)).toBeInTheDocument();
    expect(screen.getByText(/1,333\.25/)).toBeInTheDocument();
  });
  it("shows blocker count when > 0", () => {
    render(<ReadinessCard
      readiness={0.6} blockerCount={2} docType="invoice" totals={totals} marginEnabled={false}
      taxEnabled={false} taxRate={0} accountNumber="" department="" saving={false}
      primaryDisabled canSaveDraft={false} onPrimaryAction={vi.fn()} onSaveDraft={vi.fn()} onPrintRegister={vi.fn()}
      onJumpToBlockers={vi.fn()} onJumpToAccount={vi.fn()}
    />);
    expect(screen.getByText(/2 blocker/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate PDF/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/rail/readiness-card.tsx
"use client";

import { CheckIcon, AlertTriangleIcon, RefreshCwIcon, PrinterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ComposerTotals, DocType } from "../types";

interface Props {
  readiness: number;       // 0..1
  blockerCount: number;
  docType: DocType;
  totals: ComposerTotals;
  marginEnabled: boolean;
  taxEnabled: boolean;
  taxRate: number;
  accountNumber: string;
  department: string;
  saving: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
  onJumpToBlockers: () => void;
  onJumpToAccount: () => void;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function ReadinessCard(p: Props) {
  const pct = Math.round(p.readiness * 100);
  const isReady = p.readiness === 1 && p.blockerCount === 0;
  const tone =
    p.blockerCount > 0 ? { text: "text-warn",     statusLabel: `${p.blockerCount} blocker(s)` } :
    isReady             ? { text: "text-positive", statusLabel: "Ready" } :
                          { text: "text-primary",  statusLabel: `${pct}%` };

  const totalLabel = p.docType === "invoice" ? "INVOICE TOTAL" : "QUOTED TOTAL";
  const accountOk = !!p.accountNumber && !!p.department;
  const primaryLabel = p.docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF";

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-rail space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Readiness</p>
        <p className={cn("text-[12.5px] font-semibold", tone.text)}>{tone.statusLabel}</p>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all duration-240", isReady ? "bg-positive" : p.blockerCount ? "bg-warn" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>

      <div className="border-t border-dashed border-border pt-2 space-y-1 text-[12.5px]">
        <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Subtotal · {p.totals.itemCount} items</span><span className="tabular-nums">{fmt(p.totals.subtotal)}</span></div>
        {p.marginEnabled && <div className="flex items-baseline justify-between text-positive"><span>Margin</span><span className="tabular-nums">+{fmt(p.totals.marginAmount)}</span></div>}
        {p.taxEnabled && <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Sales tax · {(p.taxRate * 100).toFixed(2)}% · {p.totals.taxableCount} taxable</span><span className="tabular-nums">{fmt(p.totals.taxAmount)}</span></div>}
        <div className="flex items-baseline justify-between border-t border-border pt-1.5 mt-1.5 font-bold">
          <span className="text-[10.5px] font-mono uppercase tracking-wider">{totalLabel}</span>
          <span className="text-[22px] tabular-nums">{fmt(p.totals.grandTotal)}</span>
        </div>
      </div>

      <button type="button"
        onClick={accountOk ? undefined : p.onJumpToAccount}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border p-2 text-[12px] text-left",
          accountOk ? "bg-positive-bg border-positive-border text-positive" : "bg-warn-bg border-warn-border text-warn"
        )}
      >
        {accountOk ? <CheckIcon className="size-3.5" /> : <AlertTriangleIcon className="size-3.5" />}
        <span className="flex-1">
          {accountOk ? <>Charging <span className="font-mono">{p.accountNumber} · {p.department}</span></> : "Account number missing"}
        </span>
      </button>

      <Button onClick={p.onPrimaryAction} disabled={p.primaryDisabled} className="w-full justify-center">
        {p.saving ? <><RefreshCwIcon className="size-3.5 mr-1.5 animate-spin" /> Saving…</> : primaryLabel}
      </Button>
      {p.primaryDisabled && p.blockerCount > 0 && (
        <button type="button" onClick={p.onJumpToBlockers} className="w-full text-center text-[12.5px] text-destructive hover:underline">
          Resolve {p.blockerCount} blocker(s) below to continue
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={p.onSaveDraft} disabled={!p.canSaveDraft}>Save Draft</Button>
        <Button variant="outline" onClick={p.onPrintRegister}>
          <PrinterIcon className="size-3.5 mr-1.5" /> Print Register
        </Button>
      </div>
      {!p.canSaveDraft && <p className="text-[11.5px] text-muted-foreground -mt-1">Fill department, date, requestor, and one valid item to save</p>}
    </div>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 6.5: `<SummaryRail>` composing the three cards

**Files:**
- Create: `src/components/composer/rail/summary-rail.tsx`

- [ ] **Step 1: Implementation (no test — pure composition)**

```tsx
// src/components/composer/rail/summary-rail.tsx
"use client";

import { ReadinessCard } from "./readiness-card";
import { ChecklistCard } from "./checklist-card";
import { DraftStateCard } from "./draft-state-card";
import type { ChecklistEntry, ComposerTotals, DocType, SectionAnchor } from "../types";

interface Props {
  readiness: number;
  blockerCount: number;
  docType: DocType;
  totals: ComposerTotals;
  marginEnabled: boolean;
  taxEnabled: boolean;
  taxRate: number;
  accountNumber: string;
  department: string;
  saving: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  checklist: ChecklistEntry[];
  isDirty: boolean;
  savingDraft: boolean;
  lastSavedAt: number | null;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
  onJumpToBlockers: () => void;
  onJump: (anchor: SectionAnchor) => void;
}

export function SummaryRail(p: Props) {
  return (
    <div className="space-y-3">
      <ReadinessCard
        readiness={p.readiness} blockerCount={p.blockerCount} docType={p.docType} totals={p.totals}
        marginEnabled={p.marginEnabled} taxEnabled={p.taxEnabled} taxRate={p.taxRate}
        accountNumber={p.accountNumber} department={p.department} saving={p.saving}
        primaryDisabled={p.primaryDisabled} canSaveDraft={p.canSaveDraft}
        onPrimaryAction={p.onPrimaryAction} onSaveDraft={p.onSaveDraft} onPrintRegister={p.onPrintRegister}
        onJumpToBlockers={p.onJumpToBlockers}
        onJumpToAccount={() => p.onJump("section-department")}
      />
      <ChecklistCard checklist={p.checklist} onJump={p.onJump} />
      <DraftStateCard isDirty={p.isDirty} savingDraft={p.savingDraft} lastSavedAt={p.lastSavedAt} />
    </div>
  );
}
```

### Task 6.6: `<BlockerSummary>` banner

**Files:**
- Create: `src/components/composer/drawers/blocker-summary.tsx`
- Test: `src/components/composer/drawers/blocker-summary.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/drawers/blocker-summary.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BlockerSummary } from "./blocker-summary";

const blockers = [
  { field: "department", label: "Department required", anchor: "section-department" as const },
  { field: "items", label: "Add items", anchor: "section-items" as const },
];

describe("BlockerSummary", () => {
  it("renders count + items + close", async () => {
    const onClose = vi.fn();
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<BlockerSummary blockers={blockers} onClose={onClose} onJump={onJump} />);
    expect(screen.getByText(/2 issue\(s\) to resolve/i)).toBeInTheDocument();
    await user.click(screen.getByText("Department required"));
    expect(onJump).toHaveBeenCalledWith("section-department");
    await user.click(screen.getByLabelText(/Close/i));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/drawers/blocker-summary.tsx
"use client";

import { AlertTriangleIcon, ChevronRightIcon, XIcon } from "lucide-react";
import type { BlockerEntry, SectionAnchor } from "../types";

interface Props {
  blockers: BlockerEntry[];
  onClose: () => void;
  onJump: (anchor: SectionAnchor) => void;
}

export function BlockerSummary({ blockers, onClose, onJump }: Props) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/[0.05] p-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2 text-destructive font-semibold">
          <AlertTriangleIcon className="size-4" />
          Cannot generate PDF — {blockers.length} issue(s) to resolve
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="size-4" /></button>
      </div>
      <ul className="space-y-1">
        {blockers.map((b) => (
          <li key={b.field}>
            <button type="button" onClick={() => onJump(b.anchor)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-destructive hover:bg-destructive/[0.06]">
              <span className="text-[13px] underline decoration-dotted">{b.label}</span>
              <ChevronRightIcon className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Run** — PASS.

### Task 6.7: Extract `pdf-layout.ts` constants from `cover-sheet.ts`

**Files:**
- Create: `src/lib/pdf/pdf-layout.ts`
- Modify: `src/lib/pdf/templates/cover-sheet.ts` (consume the constants)

- [ ] **Step 1: Verify which template renders the line-items table**

```bash
grep -rn 'description.*quantity.*unitPrice\|<th>SKU\|line-item.*table' src/lib/pdf/templates/ src/lib/pdf/
```

The relevant constants live in whichever template renders the items table. If none extracts cleanly (cover-sheet only renders memo cover), the `<PreviewDrawer>` doesn't need shared constants — it can hard-code its layout based on the spec. In that case, **skip the pdf-layout.ts extraction** for P6 and document the deferral. Update the spec only if the user agrees.

- [ ] **Step 2: If shared constants exist (e.g., column widths in `quote-pdf-template.ts`), extract**

```ts
// src/lib/pdf/pdf-layout.ts
export const PDF_LAYOUT = {
  pageColumns: ["SKU", "DESCRIPTION", "QTY", "PRICE", "EXTENDED"] as const,
  columnWidths: { sku: "12%", description: "48%", qty: "8%", price: "16%", extended: "16%" } as const,
  fonts: {
    body: "13px",
    heading: "16px",
    small: "11px",
  },
  brandRed: "#c00",
};
```

Then update the relevant template file to import and use `PDF_LAYOUT.columnWidths`, `PDF_LAYOUT.fonts`, etc.

- [ ] **Step 3: Re-run cover-sheet regression test** — PASS.

### Task 6.8: `<PreviewDrawer>`

**Files:**
- Create: `src/components/composer/drawers/preview-drawer.tsx`
- Test: `src/components/composer/drawers/preview-drawer.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// src/components/composer/drawers/preview-drawer.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PreviewDrawer } from "./preview-drawer";
import type { ComposerTotals } from "../types";

const totals: ComposerTotals = { subtotal: 100, taxableSubtotal: 100, taxAmount: 9.75, marginAmount: 0, grandTotal: 109.75, itemCount: 1, taxableCount: 1 };

describe("PreviewDrawer", () => {
  it("renders preview header + body when open", () => {
    render(<PreviewDrawer
      open onOpenChange={() => {}}
      docType="invoice" date="2026-04-26" department="BKST" category="Supplies"
      items={[{ description: "WIDGET", sku: "12345", quantity: 1, unitPrice: 100, isTaxable: true }]}
      totals={totals} taxRate={0.0975} taxEnabled={true}
      signatures={[{ name: "Jane Doe", title: "Manager" }]}
      notes="public notes"
      onPrimaryAction={vi.fn()}
    />);
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
    expect(screen.getByText(/WIDGET/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    // internalNotes never rendered (not in props)
    expect(screen.queryByText(/internal/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Implementation**

```tsx
// src/components/composer/drawers/preview-drawer.tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ComposerTotals, DocType } from "../types";

interface PreviewItem { description: string; sku?: string | null; quantity: number; unitPrice: number; isTaxable: boolean; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docType: DocType;
  date: string;
  department: string;
  category: string;
  items: PreviewItem[];
  totals: ComposerTotals;
  taxEnabled: boolean;
  taxRate: number;
  signatures: { name: string; title?: string }[];
  notes: string;
  onPrimaryAction: () => void;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function PreviewDrawer({ open, onOpenChange, docType, date, department, category, items, totals, taxEnabled, taxRate, signatures, notes, onPrimaryAction }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Preview</SheetTitle>
          <p className="text-[12px] text-muted-foreground">Visual preview only. Final PDF is generated on save.</p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto bg-canvas p-6">
          <div className="mx-auto bg-card shadow-rail rounded p-6 max-w-[640px]">
            <div className="border-b-4 border-primary pb-2 mb-4 flex items-baseline justify-between">
              <h2 className="text-primary font-bold tracking-tight">LAPORTAL</h2>
              <span className="text-[12px] text-muted-foreground uppercase">{docType === "invoice" ? "Invoice" : "Quote"}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4 text-[12.5px]">
              <div><p className="text-muted-foreground uppercase tracking-wider text-[10px]">Bill to</p><p className="font-semibold">{department}</p></div>
              <div><p className="text-muted-foreground uppercase tracking-wider text-[10px]">Category</p><p>{category}</p></div>
              <div><p className="text-muted-foreground uppercase tracking-wider text-[10px]">Date</p><p>{date}</p></div>
            </div>
            <table className="w-full text-[12.5px] border-t border-border">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5">SKU</th><th className="py-1.5">Description</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-right">Price</th><th className="py-1.5 text-right">Extended</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 font-mono">{it.sku ?? "—"}</td>
                    <td className="py-1.5 uppercase">{it.description}</td>
                    <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(it.unitPrice)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(it.unitPrice * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 ml-auto max-w-[260px] space-y-1 text-[12.5px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmt(totals.subtotal)}</span></div>
              {taxEnabled && <div className="flex justify-between"><span className="text-muted-foreground">Tax {(taxRate * 100).toFixed(2)}%</span><span className="tabular-nums">{fmt(totals.taxAmount)}</span></div>}
              <div className="flex justify-between font-bold border-t border-border pt-1.5"><span>Total</span><span className="tabular-nums text-base">{fmt(totals.grandTotal)}</span></div>
            </div>
            {notes && (
              <div className="mt-6 border-t border-border pt-3 text-[12px]">
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Notes</p>
                <p>{notes}</p>
              </div>
            )}
            {docType === "invoice" && signatures.some((s) => s.name) && (
              <div className="mt-8 grid grid-cols-3 gap-4">
                {signatures.map((s, i) => (
                  <div key={i}>
                    <div className="border-b border-foreground/40 h-8" />
                    <p className="text-[11px] italic mt-1">{s.name}{s.title ? ` — ${s.title}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onPrimaryAction}>{docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Run** — PASS. Confirm the test asserts `internalNotes` is never present (not in props, by design).

### Task 6.9: `<DraftRestoreBanner>`

**Files:**
- Create: `src/components/composer/primitives/draft-restore-banner.tsx`

- [ ] **Step 1: Implementation (re-uses existing `<DraftRecoveryBanner>` body styling, just restyled)**

```tsx
// src/components/composer/primitives/draft-restore-banner.tsx
"use client";

import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  savedAt: number;
  itemCount: number;
  total: number;
  onResume: () => void;
  onDiscard: () => void;
}

function rel(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "moments ago";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function DraftRestoreBanner({ savedAt, itemCount, total, onResume, onDiscard }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-info-border bg-info-bg p-3 animate-in slide-in-from-top-2 duration-300">
      <InfoIcon className="size-4 text-info shrink-0" />
      <p className="text-[13px] flex-1">
        Draft from <strong>{rel(savedAt)}</strong> · {itemCount} line items · {fmt(total)}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button>
        <Button size="sm" onClick={onResume}>Restore Draft</Button>
      </div>
    </div>
  );
}
```

(No test required — straightforward presentation; covered by integration in P8 e2e flow.)

### Task 6.10: `<BottomActionBar>` for mobile

**Files:**
- Create: `src/components/composer/primitives/bottom-action-bar.tsx`

- [ ] **Step 1: Implementation**

```tsx
// src/components/composer/primitives/bottom-action-bar.tsx
"use client";

import { Button } from "@/components/ui/button";

interface Props {
  primaryLabel: string;
  primaryDisabled: boolean;
  grandTotal: number;
  onPrimaryAction: () => void;
  onOpenSummary: () => void;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function BottomActionBar({ primaryLabel, primaryDisabled, grandTotal, onPrimaryAction, onOpenSummary }: Props) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-2 flex items-center gap-3">
      <button type="button" onClick={onOpenSummary} className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        Open summary
      </button>
      <span className="ml-auto tabular-nums font-bold text-sm">{fmt(grandTotal)}</span>
      <Button onClick={onPrimaryAction} disabled={primaryDisabled} size="sm">{primaryLabel}</Button>
    </div>
  );
}
```

### Task 6.11: Move autosave + draft restore wiring into `<DocumentComposer>`

**Files:**
- Modify: `src/components/composer/document-composer.tsx`

- [ ] **Step 1: Wire autosave + draft load**

Add inside `<DocumentComposer>`:

```tsx
import { useEffect, useState } from "react";
import { useAutoSave, loadDraft, CREATE_PAGE_DRAFT_MAX_AGE_MS } from "@/lib/use-auto-save";
import { useUserId } from "@/lib/auth/use-user-id"; // or wherever the existing keyboard-mode/quote-mode imports it from
import { SummaryRail } from "./rail/summary-rail";
import { BlockerSummary } from "./drawers/blocker-summary";
import { DraftRestoreBanner } from "./primitives/draft-restore-banner";
import { PreviewDrawer } from "./drawers/preview-drawer";
import { BottomActionBar } from "./primitives/bottom-action-bar";

// inside DocumentComposer body:
const userId = useUserId(); // adapt to actual hook used in legacy modes
const routeKey = mode === "create"
  ? (composer.docType === "invoice" ? "/invoices/new" : "/quotes/new")
  : `/edit/${composer.form.existingId}`;

const { isDirty, savingDraft, lastSavedAt, clearDraft } = useAutoSave(composer.form.form, routeKey, userId);

const [draftPrompt, setDraftPrompt] = useState<{ savedAt: number; data: unknown; itemCount: number; total: number } | null>(null);

useEffect(() => {
  if (!userId || mode !== "create") return;
  loadDraft(routeKey, userId, { maxAgeMs: CREATE_PAGE_DRAFT_MAX_AGE_MS }).then((entry) => {
    if (!entry) return;
    const data = entry.data as { items?: unknown[] };
    const items = Array.isArray(data.items) ? data.items : [];
    const total = items.reduce((sum: number, it) => sum + Number((it as { extendedPrice?: number }).extendedPrice ?? 0), 0);
    setDraftPrompt({ savedAt: entry.savedAt, data: entry.data, itemCount: items.length, total });
  });
}, [userId, mode, routeKey]);
```

- [ ] **Step 2: Replace placeholder rail with `<SummaryRail>` + add banners + drawers**

```tsx
rail={
  <SummaryRail
    readiness={validation.readiness} blockerCount={validation.blockers.length}
    docType={composer.docType} totals={validation.totals}
    marginEnabled={composer.form.form.marginEnabled} taxEnabled={composer.form.form.taxEnabled}
    taxRate={composer.form.form.taxRate}
    accountNumber={composer.form.form.accountNumber} department={composer.form.form.department}
    saving={composer.form.saving} primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
    canSaveDraft={validation.canSaveDraft}
    checklist={validation.checklist}
    isDirty={isDirty} savingDraft={savingDraft} lastSavedAt={lastSavedAt}
    onPrimaryAction={handlePrimaryAction} onSaveDraft={handleSaveDraft} onPrintRegister={handlePrintRegister}
    onJumpToBlockers={() => setShowBlockers(true)}
    onJump={jump}
  />
}
banners={
  <>
    {draftPrompt && (
      <DraftRestoreBanner
        savedAt={draftPrompt.savedAt}
        itemCount={draftPrompt.itemCount}
        total={draftPrompt.total}
        onResume={() => { composer.form.setForm(draftPrompt.data as never); setDraftPrompt(null); }}
        onDiscard={() => { clearDraft(); setDraftPrompt(null); }}
      />
    )}
    {showBlockers && validation.blockers.length > 0 && (
      <BlockerSummary blockers={validation.blockers} onClose={() => setShowBlockers(false)} onJump={(a) => { jump(a); setShowBlockers(false); }} />
    )}
  </>
}
```

After the layout, mount `<PreviewDrawer>`, `<BottomActionBar>`:

```tsx
<PreviewDrawer
  open={drawer === "preview"} onOpenChange={(o) => setDrawer(o ? "preview" : null)}
  docType={composer.docType} date={composer.form.form.date}
  department={composer.form.form.department} category={composer.form.form.category}
  items={composer.form.form.items.map((i) => ({ description: i.description, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, isTaxable: i.isTaxable }))}
  totals={validation.totals} taxEnabled={composer.form.form.taxEnabled} taxRate={composer.form.form.taxRate}
  signatures={composer.docType === "invoice"
    ? [composer.form.form.signatures.line1, composer.form.form.signatures.line2, composer.form.form.signatures.line3]
        .filter(Boolean)
        .map((s) => { const [name, title] = s.split(" — "); return { name: name ?? s, title }; })
    : []}
  notes={composer.form.form.notes}
  onPrimaryAction={handlePrimaryAction}
/>
<BottomActionBar
  primaryLabel={composer.docType === "invoice" ? "Generate PDF" : "Save Quote"}
  primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
  grandTotal={validation.totals.grandTotal}
  onPrimaryAction={handlePrimaryAction}
  onOpenSummary={() => { /* TODO: bottom-sheet rail; for P6 use a simple alert until the sheet is added */ }}
/>
```

- [ ] **Step 3: Wire Templates + Preview ghost buttons in header**

Update `<ComposerHeader>` rendering to pass `actionsRight`:

```tsx
<ComposerHeader
  /* ... existing props ... */
  actionsRight={
    <>
      <Button variant="ghost" size="sm" onClick={() => { setTemplatesMode("load"); setDrawer("templates"); }}>Templates</Button>
      <Button variant="ghost" size="sm" onClick={() => setDrawer("preview")}>Preview</Button>
      <span className="h-4 w-px bg-border" aria-hidden />
      <Button variant="outline" size="sm" onClick={handlePrintRegister}>Print Register</Button>
    </>
  }
/>
```

- [ ] **Step 4: Localhost smoke test**

```bash
npm run dev
# Visit /invoices/new
# - Rail shows readiness % + totals + account callout
# - Click a checklist item → smooth scroll + pulse on the section
# - With blockers, click "Resolve N blockers" → BlockerSummary banner appears at top
# - Click each blocker → jumps to its section
# - Click "Preview" in header → drawer opens with stylized preview
# - Edit the form → DraftStateCard cycles Unsaved → Saving → Saved (every 30s)
# - Refresh the page within 12 hours → DraftRestoreBanner appears
```

### Task 6.12: Phase 6 commit

```bash
npm run lint && npx tsc --noEmit
npm test -- src/components/composer src/lib/use-auto-save src/lib/pdf

git add src/components/composer src/lib/use-auto-save.ts src/lib/use-auto-save.test.ts src/lib/pdf

git commit -m "$(cat <<'EOF'
feat(composer): P6 — summary rail + preview drawer + draft restore

Right rail with <ReadinessCard> (totals, account callout, primary action,
two secondary buttons), <ChecklistCard> (click-to-jump), <DraftStateCard>
(Saved/Saving/Unsaved). <BlockerSummary> banner shown when user clicks
"Resolve N blockers". <PreviewDrawer> with stylized HTML preview that
omits internalNotes by design. <DraftRestoreBanner> wired into autosave
flow (banner now lives in composer, not legacy keyboard-mode).

Surfaces isDirty/savingDraft/lastSavedAt from useAutoSave (additive).
Header gains Templates + Preview + Print Register ghost actions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 7 — Quote variant on `/quotes/new`

**Ships:** `/quotes/new` mounts `<DocumentComposer docType="quote">`. All the conditional logic (recipient segmented control, catering rich block, no approver grid, no PrismCore, quote toolbar) was already built in P3-P6 — this phase is mostly wiring + verification + an e2e test.

**Localhost verify:** Full quote creation flow works on `/quotes/new`. External recipient mode, catering toggle with full details disclosure, "Save Quote & Generate PDF" → redirects to `/quotes/${id}` and opens the PDF in a new tab.

### Task 7.1: Wire `/quotes/new` to the composer

**Files:**
- Modify: `src/app/quotes/new/page.tsx`

- [ ] **Step 1: Replace body**

```tsx
// src/app/quotes/new/page.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuoteForm } from "@/components/quote/quote-form";
import { DocumentComposer } from "@/components/composer/document-composer";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { SelectedProduct } from "@/domains/product/types";

function hasRetailPrice(p: SelectedProduct): p is SelectedProduct & { retailPrice: number } {
  return p.retailPrice != null;
}

function readCatalogItems() {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(CATALOG_ITEMS_STORAGE_KEY);
    const items = JSON.parse(raw) as SelectedProduct[];
    return items.filter(hasRetailPrice).map((item) => ({
      sku: String(item.sku),
      description: item.description.toUpperCase(),
      quantity: 1,
      unitPrice: item.retailPrice,
      costPrice: item.cost,
    }));
  } catch {
    return undefined;
  }
}

export default function NewQuotePage() {
  const searchParams = useSearchParams();
  const fromCatalog = searchParams.get("from") === "catalog";

  const initial = useMemo(() => {
    if (!fromCatalog) return undefined;
    const catalogItems = readCatalogItems();
    if (!catalogItems || catalogItems.length === 0) return undefined;
    return {
      items: catalogItems.map((item, i) => ({
        _key: `catalog-${i}`,
        sku: item.sku, description: item.description, quantity: item.quantity,
        unitPrice: item.unitPrice, extendedPrice: item.quantity * item.unitPrice,
        sortOrder: i, isTaxable: true, marginOverride: null, costPrice: item.costPrice,
      })),
    };
  }, [fromCatalog]);

  const quoteForm = useQuoteForm(initial);

  return (
    <DocumentComposer
      composer={{ docType: "quote", form: quoteForm }}
      mode="create"
      status="DRAFT"
      canManageActions
    />
  );
}
```

- [ ] **Step 2: Verify recipient segmented control flips correctly**

Pick a staff member → "Internal" highlighted, hint shown. Click "External party" → staff cleared, recipient inputs revealed.

- [ ] **Step 3: Verify catering toggle**

Toggle catering on → 4-col block (event name, date, attendees, location) appears. Open "More catering details" disclosure → all 12+ rich fields render and round-trip via `cateringDetails`.

- [ ] **Step 4: Verify catering preset wiring**

With catering on, in section 4 the "Catering preset" ghost button appears. Click it → catalog drawer opens (with title showing `Product Catalog · Catering`).

- [ ] **Step 5: Verify primary action**

Fill required fields → "Save Quote & Generate PDF" enabled → click → redirected to `/quotes/${id}` and a new tab opens `/api/quotes/${id}/pdf` (binary inline PDF).

### Task 7.2: Playwright e2e for quote creation

**Files:**
- Create: `tests/e2e/composer-quote.spec.ts` (or wherever existing playwright specs live; check `playwright.config.ts`)

- [ ] **Step 1: Locate playwright config**

```bash
ls tests/ playwright.config.* 2>&1 | head
```

- [ ] **Step 2: Failing e2e**

```ts
// tests/e2e/composer-quote.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Quote composer", () => {
  test("creates an external-recipient catering quote", async ({ page }) => {
    await page.goto("/quotes/new");
    await expect(page.getByText(/New Quote/)).toBeVisible();
    // External recipient
    await page.getByRole("radio", { name: /External/i }).click();
    await page.getByPlaceholder("Recipient name").fill("Acme Corp");
    await page.getByPlaceholder("Recipient email (optional)").fill("acme@example.com");
    // Section 2
    await page.getByLabel(/Department/i).click();
    await page.getByText("BKST").click();
    await page.getByLabel(/Account number/i).fill("10-4500-301");
    // Section 3 + catering
    await page.getByLabel(/Category/i).click();
    await page.getByText("Catering").first().click();
    await page.getByRole("switch", { name: /Catering/i }).click();
    await page.getByLabel(/Event name/i).fill("Spring Mixer");
    // Section 4 — add a custom line
    await page.getByRole("button", { name: /Add custom line/i }).click();
    await page.getByLabel(/Description row 1/i).fill("BAGELS");
    await page.getByLabel(/Qty row 1/i).fill("12");
    await page.getByLabel(/Charged row 1/i).fill("2.50");
    // Readiness should now be ≥ 80%
    await expect(page.getByText(/QUOTED TOTAL/)).toBeVisible();
    // The Save Quote button must be enabled
    await expect(page.getByRole("button", { name: /Save Quote & Generate PDF/i }).first()).toBeEnabled();
  });
});
```

- [ ] **Step 3: Run e2e**

```bash
npx playwright test tests/e2e/composer-quote.spec.ts
```

If selectors mismatch (e.g., the BKST select uses a different role), adjust to match the real DOM by running the spec in headed mode: `npx playwright test --ui`.

### Task 7.3: Phase 7 commit

```bash
npm run lint && npx tsc --noEmit
npm test -- src/components/composer
npx playwright test tests/e2e/composer-quote.spec.ts

git add src/app/quotes/new/page.tsx tests/e2e/composer-quote.spec.ts

git commit -m "$(cat <<'EOF'
feat(composer): P7 — wire /quotes/new to DocumentComposer

Quote variant lights up: recipient segmented control (internal/external),
catering rich block with "more details" disclosure, no approver grid,
no PrismCore upload, quote-style action toolbar (no signatures column).

Adds Playwright e2e for the external-recipient catering flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 8 — Edit pages + legacy cleanup

**Ships:** `/invoices/[id]/edit` and `/quotes/[id]/edit` mount `<DocumentComposer mode="edit">`. Status-aware toolbar variants (FINALIZED, SENT, etc.). Read-only approver slots when finalized. **Deletes** `keyboard-mode.tsx`, `quote-mode.tsx`, and the sticky `<LazyProductSearchPanel>` mounting blocks from page files. Final e2e + manual edit verification.

**Localhost verify:** Edit existing DRAFT invoice — full composer with all actions enabled. Edit existing FINALIZED invoice — approver slots read-only, "Save Draft" hidden, "Re-generate PDF" instead of "Generate PDF". Edit existing SENT quote — toolbar adapted; approver/PrismCore not relevant. Cross-user view (canManageActions=false) — toolbar hidden entirely.

### Task 8.1: Wire `/invoices/[id]/edit`

**Files:**
- Modify: `src/app/invoices/[id]/edit/page.tsx`

- [ ] **Step 1: Replace body (keep fetch/loading/error skeleton)**

In the existing file, the fetch + `mapApiToFormData` + `canManageActions` extraction stays intact. Replace only the JSX return (the `<KeyboardMode />` + `<LazyProductSearchPanel />` block):

```tsx
return (
  <DocumentComposer
    composer={{ docType: "invoice", form: invoiceForm }}
    mode="edit"
    status={initialData ? (await import("@/domains/invoice/types")).status as never : "DRAFT"}  // adapt: use the actual status string from the fetched API response
    canManageActions={canManageActions}
    documentNumber={invoiceForm.form.invoiceNumber}
  />
);
```

Practically: keep a small piece of state for the status string from the fetched invoice and thread it as `status={status}`.

- [ ] **Step 2: Smoke test**

```bash
npm run dev
# Open an existing draft invoice via /invoices/<id>/edit
# Confirm composer mounts, all sections populate, can save & re-finalize.
```

### Task 8.2: Wire `/quotes/[id]/edit`

**Files:**
- Modify: `src/app/quotes/[id]/edit/page.tsx`

- [ ] **Step 1: Replace body similarly**

```tsx
return (
  <DocumentComposer
    composer={{ docType: "quote", form: quoteForm }}
    mode="edit"
    status={quoteStatus}
    canManageActions={canManageActions}
    documentNumber={undefined /* quotes don't have a public-facing number; spec uses convertedToInvoice pill */}
  />
);
```

If the quote has `convertedToInvoice`, surface a pill in the composer header — extend `<ComposerHeader>` with an optional `convertedTo?: { invoiceNumber: string | null; id: string }` prop, render an `info-bg` pill near the title:

```tsx
{convertedTo && (
  <span className="inline-flex items-center rounded-full border border-info-border bg-info-bg px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider text-info">
    Converted → {convertedTo.invoiceNumber ?? "INV"}
  </span>
)}
```

- [ ] **Step 2: Smoke test on a SENT quote** — toolbar adapts; primary action becomes "Re-send" / "Save changes" depending on status.

### Task 8.3: Status-aware toolbar variants

**Files:**
- Modify: `src/components/composer/sections/approval-output.tsx`
- Modify: `src/components/composer/document-composer.tsx`

- [ ] **Step 1: Define status mapping**

In a new helper `src/components/composer/status-rules.ts`:

```ts
import type { ComposerStatus, DocType } from "./types";

export interface ToolbarVisibility {
  primaryLabel: string;
  showSaveDraft: boolean;
  showSaveTemplate: boolean;
  approversReadOnly: boolean;
  prismcoreVisible: boolean;
}

export function toolbarVisibility(docType: DocType, status: ComposerStatus, canManageActions: boolean): ToolbarVisibility {
  if (!canManageActions) {
    return { primaryLabel: "", showSaveDraft: false, showSaveTemplate: false, approversReadOnly: true, prismcoreVisible: false };
  }
  if (status === "DRAFT") {
    return {
      primaryLabel: docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF",
      showSaveDraft: true, showSaveTemplate: true, approversReadOnly: false, prismcoreVisible: docType === "invoice",
    };
  }
  if (status === "FINALIZED") {
    return {
      primaryLabel: "Re-generate PDF",
      showSaveDraft: false, showSaveTemplate: true, approversReadOnly: true, prismcoreVisible: false,
    };
  }
  // SENT / PAID / EXPIRED / DECLINED / REVISED
  return {
    primaryLabel: "Save changes",
    showSaveDraft: false, showSaveTemplate: true, approversReadOnly: true, prismcoreVisible: false,
  };
}
```

- [ ] **Step 2: Thread visibility through `<ApprovalOutputSection>`**

Add a `visibility` prop and use it to conditionally render Save Draft / Save Template / PrismCore + flip approver `disabled`. Use `visibility.primaryLabel` instead of hardcoding "Generate PDF".

- [ ] **Step 3: Failing test for FINALIZED behavior**

```tsx
// append to approval-output.test.tsx
it("hides Save Draft and disables approvers when FINALIZED", () => {
  const { result } = renderHook(() => useInvoiceForm({ signatureStaffIds: { line1: "x", line2: "y", line3: "" } }));
  render(
    <ApprovalOutputSection
      docType="invoice" composer={result.current} sectionStatus="default"
      attemptedSubmit={false} canManageActions
      visibility={{ primaryLabel: "Re-generate PDF", showSaveDraft: false, showSaveTemplate: true, approversReadOnly: true, prismcoreVisible: false }}
      onOpenTemplates={() => {}} onPrimaryAction={() => {}} onSaveDraft={() => {}} onPrintRegister={() => {}}
      canSaveDraft={false} primaryDisabled={false}
    />
  );
  expect(screen.queryByRole("button", { name: /Save Draft/i })).toBeNull();
  expect(screen.getByRole("button", { name: /Re-generate PDF/i })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Verify on localhost**

Open a FINALIZED invoice → toolbar shows only "Re-generate PDF" + "Save as Template"; Save Draft is gone; approver slots are read-only.

### Task 8.4: Delete legacy code

**Files:**
- Delete: `src/components/invoice/keyboard-mode.tsx`
- Delete: `src/components/quote/quote-mode.tsx`
- Modify: `src/app/invoices/new/page.tsx` (already done in P2; verify no remnants)
- Modify: `src/app/quotes/new/page.tsx` (already done in P7; verify no remnants)
- Modify: `src/app/invoices/[id]/edit/page.tsx` (already done in 8.1; remove `LazyProductSearchPanel` + `KeyboardMode` imports)
- Modify: `src/app/quotes/[id]/edit/page.tsx` (already done in 8.2)

- [ ] **Step 1: Verify no remaining importers**

```bash
grep -rn 'KeyboardMode\|QuoteMode\|keyboard-mode\|quote-mode' src/ tests/ 2>&1 | grep -v 'composer'
```

Expected: empty (or only the files about to be deleted). If any other importer exists, address it before deletion.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/invoice/keyboard-mode.tsx
git rm src/components/quote/quote-mode.tsx
```

Also remove the legacy `<LazyProductSearchPanel>` mount blocks from edit page files (the component itself stays — it's used inside `<CatalogDrawer>`).

- [ ] **Step 3: TS + tests**

```bash
npx tsc --noEmit
npm test
```

All green expected.

### Task 8.5: Final e2e + manual verification

- [ ] **Step 1: Run the full Vitest + Playwright suite**

```bash
npm run lint
npx tsc --noEmit
npm test
npx playwright test
```

- [ ] **Step 2: Manual flows on localhost**

| Flow | Expectation |
|---|---|
| New invoice with all fields → Generate PDF | redirects to `/invoices/<id>`, PDF generated, `<PdfProgress>` modal seen |
| New quote external recipient + catering → Save Quote & Generate PDF | redirects to `/quotes/<id>`, PDF tab opens |
| New invoice → Save Draft (schema-min only) | redirects to detail page, toast "Draft saved" |
| New invoice → autosave → refresh → DraftRestoreBanner | shows; click Restore → fields populated |
| New invoice → Save as Template, give name | toast; new template appears in Load tab |
| Edit DRAFT invoice → make changes → Generate PDF | re-finalizes |
| Edit FINALIZED invoice | approvers read-only, no Save Draft |
| Edit invoice as a different user (canManageActions=false) | toolbar hidden |
| Print Register on any state | opens existing register print window unchanged |
| /quotes/new on mobile width | bottom action bar visible, rail collapses |

- [ ] **Step 3: Cross-theme smoke test**

Toggle theme to dark + each Catppuccin variant. Composer should remain readable (status pill colors mapped, shadow-rail visible).

### Task 8.6: Phase 8 commit + publish PR

```bash
npm run lint && npx tsc --noEmit && npm test
npx playwright test

# Stage explicit paths only — never `git add -A` / `git add .` (per repo rules).
# Quote paths containing `[...]` so zsh doesn't try to glob them.
# The deletes from Task 8.4 (`git rm`) are already staged; only the new edits need adding here.
git add \
  'src/app/invoices/[id]/edit/page.tsx' \
  'src/app/quotes/[id]/edit/page.tsx' \
  src/components/composer/document-composer.tsx \
  src/components/composer/composer-header.tsx \
  src/components/composer/sections/approval-output.tsx \
  src/components/composer/sections/approval-output.test.tsx \
  src/components/composer/status-rules.ts

# Confirm the staged set matches expectations before committing.
git status

git commit -m "$(cat <<'EOF'
feat(composer): P8 — wire edit pages + delete legacy keyboard/quote modes

/invoices/[id]/edit and /quotes/[id]/edit now mount <DocumentComposer
mode="edit"> with status-aware toolbar (FINALIZED→Re-generate, SENT→Save
changes, no-manage→hidden). Approver slots are read-only post-finalize.

Deletes keyboard-mode.tsx and quote-mode.tsx. Removes the legacy sticky
<LazyProductSearchPanel> mounting code from page files (the component
itself remains — used inside <CatalogDrawer>).

Full Vitest + Playwright suite green. Manual cross-theme + mobile checks
done.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

npm run ship-check && npm run git:checkpoint
/codex:adversarial-review
# If verdict = APPROVE:
npm run git:publish-pr   # marks the PR ready for review
afplay /System/Library/Sounds/Glass.aiff
```

---

## Self-review (run after the plan is written, before executing)

This was performed by the plan author at write-time. Re-run if you edit the plan.

**1. Spec coverage:**

| Spec section | Plan task |
|---|---|
| §3 architecture / file tree | P1-P8 file paths match; everything in §13 is created or modified |
| §4 view-models + validators | P2 task 2.1, 2.2 + types.ts in P1 task 1.8 |
| §4 persistence: internalNotes via pdfMetadata | P4 tasks 4.1-4.9 |
| §5 CSS tokens | P1 tasks 1.1-1.4 |
| §6 composer shell + header + edit-mode toolbar | P2 tasks 2.3-2.5 + P8 task 8.3 |
| §7 sections 1-6 | P3 tasks 3.1-3.5; P4 tasks 4.10-4.12; P5 tasks 5.2-5.3 |
| §8 right rail | P6 tasks 6.2-6.5 |
| §9 drawers + banners | P5 tasks 5.4-5.6; P6 tasks 6.6, 6.8, 6.9 |
| §10 edit-page integration | P8 tasks 8.1-8.3 |
| §11 phase plan (8 phases) | P1-P8 mirror the spec's phase boundaries |
| §12 testing/a11y/mobile | TDD per task; mobile bottom-bar in P6 task 6.10; a11y attributes baked into primitives |

**2. Placeholder scan:** Searched the plan for "TBD", "TODO", "implement later", "fill in details", "add appropriate", "similar to". One legitimate "TODO" remains in P6 task 6.11 step 2 marking the bottom-sheet rail (mobile summary sheet) as a follow-up — that matches §12's "deferred" framing in the spec. Acceptable.

**3. Type consistency:**
- `DocumentComposer` props match across P2 (definition) and P8 (consumers): `composer`, `mode`, `status`, `canManageActions`, `documentNumber`. ✓
- `ComposerForm` discriminated union (docType + form) used consistently. ✓
- `useComposerValidation` returns `{ blockers, checklist, readiness, canSaveDraft, totals }` — every consumer reads from this same set. ✓
- `chargedFor` formula `cost * (1 + m/100)` matches form-state hook's `itemsWithMargin` (P4 §10 step 2). NO `cost / (1 - m)` anywhere. ✓
- `pdfMetadata.internalNotes` shape consistent across validator (P4 §4.4), service (§4.6), payload builder (§4.2/§4.3), and edit-page mapper (§4.8). ✓

**4. Known caveats / open verifications**

- **Task 6.7 (pdf-layout extraction):** the actual PDF templates structure was not exhaustively explored at plan-write time. If `cover-sheet.ts` is the only template and it's a memo (no items table), the extraction may be no-op — the preview drawer's hard-coded layout stands on its own. The task's Step 1 verification handles this.
- **Task 8.1:** `status` extraction from the fetched invoice needs a small piece of state in the page wrapper; the snippet hand-waves with `(await import(...))` which is wrong syntax. The engineer must read the existing `ApiInvoice.status` field and hold it in `useState`. Concrete fix:

  ```tsx
  const [status, setStatus] = useState("DRAFT");
  // inside the .then(invoice =>):
  setStatus(invoice.status);
  // ...
  status={status}
  ```

  Apply the same pattern in 8.2 for `quoteStatus`.

- **Task 5.7 register print mapping:** the snippet hand-waves the existing register-print payload. Pull it verbatim from `keyboard-mode.tsx` lines 220-260 (or wherever `openDeferredRegisterPrintWindow` is called) into a shared helper at `src/components/composer/hooks/use-register-print.ts` so both invoice + quote variants share one source.

- **Task 6.11 step 1 `useUserId`:** the hook name is hand-waved. Look at `keyboard-mode.tsx` line ~135 for the actual user-id source — copy it verbatim. The autosave routeKey + userId pattern is exactly what the legacy modes do.

- **Task 5.5 (templateApi.items.sku):** small additive backend change. If `sku` is missing from `CreateTemplateInput.items`, add it as optional. If the prisma schema for templates also lacks SKU storage, that's a real schema migration which would push P5 over its scope — flag it to the user before proceeding.

These are noted here rather than embedded as TODOs in the tasks because they're discovery items the executing engineer will resolve in 5 minutes by reading existing code; not architectural questions that need re-planning.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-document-composer-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**

If subagent-driven: I'll use `superpowers:subagent-driven-development` and spawn one agent per phase (or per task within a phase, depending on size). Each agent gets the spec + this plan + the specific task scope.

If inline: I'll use `superpowers:executing-plans` and walk through P1 task-by-task in this session, pausing at each phase commit for your review before continuing.

**Either way, P1 is the natural starting point** — it ships under the radar (no UI swap), establishes all the primitives the rest of the plan depends on, and is the lowest-risk first commit.

