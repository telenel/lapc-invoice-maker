# Prism Write Confirmation Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent accidental Prism/POS writes by requiring explicit human confirmation, strong warnings, and deliberate acknowledgment on every live product write path.

**Architecture:** Add one shared confirmation dialog component for high-risk product writes, then route every Prism-backed product action through it. The dialog will clearly state the target system, require an acknowledgment checkbox plus a typed confirmation phrase for destructive operations, and disable the submit button until both conditions are met. Existing write flows will keep their domain logic, but none of them will call `productApi.*` until the shared gate is satisfied.

**Tech Stack:** Next.js App Router, React client components, shadcn/ui dialog + checkbox + input, Vitest + React Testing Library.

---

### Task 1: Add a reusable Prism write confirmation dialog

**Files:**
- Create: `src/components/products/prism-write-confirmation-dialog.tsx`
- Test: `tests/components/products-prism-write-confirmation-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

describe("PrismWriteConfirmationDialog", () => {
  it("keeps confirm disabled until the checkbox is checked and the phrase matches", () => {
    // render dialog and verify disabled/enabled transitions
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/products-prism-write-confirmation-dialog.test.tsx -v`
Expected: FAIL because the dialog component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function PrismWriteConfirmationDialog({ open, title, warning, confirmPhrase, ... }: Props) {
  // show explicit Prism/POS warning copy
  // require checkbox + typed phrase before enabling confirm
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/products-prism-write-confirmation-dialog.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/prism-write-confirmation-dialog.tsx tests/components/products-prism-write-confirmation-dialog.test.tsx
git commit -m "feat(products): add shared prism write confirmation gate"
```

### Task 2: Gate product edit, new item, discontinue, and hard delete actions

**Files:**
- Modify: `src/components/products/edit-item-dialog.tsx`
- Modify: `src/components/products/new-item-dialog.tsx`
- Modify: `src/components/products/product-action-bar.tsx`
- Modify: `src/components/products/hard-delete-dialog.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";

describe("product write flows", () => {
  it("do not call Prism APIs until the confirmation gate is accepted", () => {
    // mock productApi methods and assert they are not invoked before confirm
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/products-write-gates.test.tsx -v`
Expected: FAIL until the dialogs/actions use the shared gate.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Edit/new/hard-delete/discontinue actions open the shared dialog first.
// The final API call happens only after explicit confirmation.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/products-write-gates.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/edit-item-dialog.tsx src/components/products/new-item-dialog.tsx src/components/products/product-action-bar.tsx src/components/products/hard-delete-dialog.tsx
git commit -m "feat(products): require explicit confirmation for prism writes"
```

### Task 3: Strengthen bulk edit and batch add commit flows

**Files:**
- Modify: `src/components/bulk-edit/commit-confirm-dialog.tsx`
- Modify: `src/app/products/bulk-edit/page.tsx`
- Modify: `src/components/products/batch-add-grid.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";

describe("bulk product writes", () => {
  it("uses explicit confirmation copy for Prism/POS writes", () => {
    // assert dialog text and disabled submit state until acknowledgment
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/products-bulk-write-confirmation.test.tsx -v`
Expected: FAIL until bulk flows use the stronger dialog requirements.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Add explicit Prism/POS warning text, checkbox acknowledgment, and typed phrase
// for bulk edit and batch-add commit buttons.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/products-bulk-write-confirmation.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/bulk-edit/commit-confirm-dialog.tsx src/app/products/bulk-edit/page.tsx src/components/products/batch-add-grid.tsx
git commit -m "feat(products): harden bulk prism write confirmation"
```

### Task 4: Verify the full product surface and ship-check the branch

**Files:**
- Modify: any remaining product write surfaces discovered during implementation

- [ ] **Step 1: Inspect for missed Prism write paths**

```bash
rg -n "productApi\\.(create|update|batch|discontinue|hardDelete)" src/components src/app
```

- [ ] **Step 2: Run the repo validation gate**

Run: `npm run ship-check`
Expected: PASS with no lint, type, test, or build regressions.

- [ ] **Step 3: Commit or fix any remaining gaps**

```bash
git add -A
git commit -m "feat(products): finalize prism write confirmation gate"
```
