# Quote Payment Follow-Up Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make accepted quotes with unresolved payment details visibly show their payment follow-up state across the internal quote UI, including dual-status badges like `Accepted` + `Follow Up 1/5`.

**Architecture:** Add a derived payment follow-up badge summary to quote DTOs instead of inventing a new persisted quote status. Compute the badge from existing quote acceptance/payment fields plus the number of sent `PAYMENT_REMINDER` follow-ups, then reuse that summary anywhere quote status badges are rendered.

**Tech Stack:** Next.js, React, TypeScript, Prisma, Vitest, Testing Library

---

### Task 1: Add a derived quote payment follow-up summary

**Files:**
- Create: `src/domains/quote/payment-follow-up.ts`
- Modify: `src/domains/quote/types.ts`
- Modify: `src/domains/quote/service.ts`
- Modify: `src/domains/quote/repository.ts`
- Test: `tests/domains/quote/payment-follow-up.test.ts`
- Test: `tests/domains/quote/service.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import { getQuotePaymentFollowUpBadgeState, PAYMENT_FOLLOW_UP_MAX_ATTEMPTS } from "@/domains/quote/payment-follow-up";

describe("getQuotePaymentFollowUpBadgeState", () => {
  it("returns an active 1/5 badge immediately after acceptance when payment is still unresolved", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: false,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: 0,
      }),
    ).toEqual({
      seriesStatus: "ACTIVE",
      currentAttempt: 1,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    });
  });

  it("advances the badge attempt after reminders have already been sent", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: false,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: 2,
      }),
    ).toEqual({
      seriesStatus: "ACTIVE",
      currentAttempt: 3,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    });
  });

  it("returns exhausted after the fifth reminder has already been sent", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: false,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: 5,
      }),
    ).toEqual({
      seriesStatus: "EXHAUSTED",
      currentAttempt: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    });
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `npm test -- tests/domains/quote/payment-follow-up.test.ts`
Expected: FAIL because the new helper module does not exist yet.

- [ ] **Step 3: Add the minimal helper + DTO plumbing**

```ts
export const PAYMENT_FOLLOW_UP_MAX_ATTEMPTS = 5;

export function getQuotePaymentFollowUpBadgeState(...) {
  // accepted + unresolved + shareable + not converted => ACTIVE/EXHAUSTED
}
```

Add `paymentFollowUpBadge` to `QuoteResponse`, then update `quoteService` to:
- count sent `PAYMENT_REMINDER` rows for the current quote ids
- derive the badge summary
- attach it to both list and detail responses

- [ ] **Step 4: Run the helper and service tests**

Run: `npm test -- tests/domains/quote/payment-follow-up.test.ts tests/domains/quote/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/quote/payment-follow-up.ts src/domains/quote/types.ts src/domains/quote/service.ts src/domains/quote/repository.ts tests/domains/quote/payment-follow-up.test.ts tests/domains/quote/service.test.ts
git commit -m "feat: expose quote payment follow-up badge state"
```

### Task 2: Show dual quote status badges in the internal quote surfaces

**Files:**
- Modify: `src/components/quotes/quote-detail.tsx`
- Modify: `src/components/quotes/quote-table.tsx`
- Modify: `src/components/dashboard/recent-invoices.tsx`
- Test: `src/__tests__/quote-detail.test.tsx`
- Test: `src/__tests__/nav-page-bootstrap.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

Add assertions that accepted unresolved quotes render both:
- `Accepted`
- `Follow Up 1/5`

Use a quote fixture with:

```ts
{
  quoteStatus: "ACCEPTED",
  paymentDetailsResolved: false,
  paymentFollowUpBadge: {
    seriesStatus: "ACTIVE",
    currentAttempt: 1,
    maxAttempts: 5,
  },
}
```

- [ ] **Step 2: Run the UI tests to verify they fail**

Run: `npm test -- src/__tests__/quote-detail.test.tsx src/__tests__/nav-page-bootstrap.test.tsx`
Expected: FAIL because the components do not yet render the new quote badge.

- [ ] **Step 3: Render the badge next to accepted quote status**

Update:
- `quote-detail.tsx` header badges and the unresolved-payment banner copy
- `quote-table.tsx` mobile + desktop quote rows
- `recent-invoices.tsx` quote rows in dashboard recent activity

Use the existing `FollowUpBadge` component so the new quote badge matches the current follow-up visual language.

- [ ] **Step 4: Run the UI tests**

Run: `npm test -- src/__tests__/quote-detail.test.tsx src/__tests__/nav-page-bootstrap.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/quote-detail.tsx src/components/quotes/quote-table.tsx src/components/dashboard/recent-invoices.tsx src/__tests__/quote-detail.test.tsx src/__tests__/nav-page-bootstrap.test.tsx
git commit -m "feat: show quote payment follow-up badges"
```

### Task 3: Final verification

**Files:**
- Modify: `src/__tests__/quote-activity.test.tsx` (only if rendering copy or status expectations change)

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npm test -- tests/domains/quote/payment-follow-up.test.ts tests/domains/quote/service.test.ts src/__tests__/quote-detail.test.tsx src/__tests__/nav-page-bootstrap.test.tsx src/__tests__/quote-activity.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run lint or broader validation if the focused suite passes cleanly**

Run: `npm test -- src/__tests__/public-quote-view.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: verify quote payment follow-up visibility"
```
