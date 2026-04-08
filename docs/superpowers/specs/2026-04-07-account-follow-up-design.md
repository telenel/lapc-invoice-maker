# Account Number Follow-Up Feature

Recurring follow-up requests for invoices and quotes missing account numbers. Users initiate a series of up to 5 total requests to the requestor/staff member, requesting the account number via a token-based public form. The first request is sent immediately on initiation; up to 4 additional weekly reminders follow via the scheduled job. The series stops early when the account number is provided.

---

## Data Model

### Migration: Rename QuoteFollowUp to FollowUp

Rename the `quote_follow_ups` table to `follow_ups` and the Prisma model from `QuoteFollowUp` to `FollowUp`. Existing payment follow-up rows are preserved — new fields default to null for backward compatibility.

### New Fields on FollowUp

| Field | Type | Purpose |
|---|---|---|
| `seriesId` | UUID, nullable | Groups all attempts in one follow-up series |
| `shareToken` | UUID, nullable, unique | Token for the public account-number form |
| `seriesStatus` | String, nullable | `ACTIVE`, `COMPLETED`, `EXHAUSTED` (null for legacy payment rows) |
| `maxAttempts` | Int, nullable | Max emails in the series (default 5) |

### Updated FollowUp Model

```
FollowUp
  id              String    @id @default(uuid())
  invoiceId       String    (FK → Invoice)
  type            String    // "PAYMENT_REMINDER", "PAYMENT_REMINDER_CLAIM",
                            // "ACCOUNT_FOLLOWUP", "ACCOUNT_FOLLOWUP_CLAIM"
  recipientEmail  String
  subject         String
  sentAt          DateTime  @default(now())
  metadata        Json?     // { attempt: 2, maxAttempts: 5, tone: "urgent" }
  seriesId        String?   // UUID grouping attempts
  shareToken      String?   @unique  // for public form
  seriesStatus    String?   // ACTIVE, COMPLETED, EXHAUSTED
  maxAttempts     Int?      // default 5
```

### Indexes

- Existing: `(invoiceId, sentAt)`
- New: `(seriesId)` for grouping queries
- New: `(shareToken)` unique index (implicit from `@unique`)
- New: `(seriesStatus, type)` for the cron job query

### Series Tracking Convention

`seriesStatus` and `maxAttempts` are **denormalized onto every row** in the series. When the series state changes (e.g., `ACTIVE` → `COMPLETED`), all rows sharing the same `seriesId` are updated. This avoids joins when computing the badge — the latest `FollowUp` row for an invoice/quote carries the current series state directly.

`shareToken` is set only on the **initiator row** (`metadata.attempt = 1`) since it is a unique token for the public form and does not need to appear on every attempt row. The public form route resolves the token to the initiator row and reads `seriesId` from there.

### Backward Compatibility

Existing `PAYMENT_REMINDER` and `PAYMENT_REMINDER_CLAIM` rows have null `seriesId`, `shareToken`, `seriesStatus`, and `maxAttempts`. No data migration needed. All existing payment follow-up code continues to work by filtering on `type`.

---

## Public Form

### Routes (no auth)

| Route | Method | Purpose |
|---|---|---|
| `/account-request/[token]` | Page | Public form for entering account number |
| `/api/follow-ups/public/[token]` | GET | Fetch invoice/quote summary by share token |
| `/api/follow-ups/public/[token]/submit` | POST | Submit the account number |

These routes are excluded from auth middleware in `src/middleware.ts`, matching the existing public quote page pattern.

### Page Content

The public form displays:
- Invoice/quote number
- Description or summary
- Total amount
- Creator name (who to contact with questions)
- Which follow-up this is ("Reminder 3 of 5")
- Account number input field
- Submit button

### Submit Flow

1. Validate the token resolves to a series
2. **If the series is already `COMPLETED` or `EXHAUSTED`**, or the invoice/quote already has an account number, return an "already resolved" confirmation page — do **not** overwrite an existing account number
3. Validate the account number input (non-empty string, reasonable length)
4. Save the account number to the invoice/quote `accountNumber` field
5. Mark all rows in the series `seriesStatus = COMPLETED`
6. Create notification `ACCOUNT_NUMBER_RECEIVED` for the invoice/quote creator
7. Publish real-time event (`invoice-changed` or `quote-changed`)
8. Show confirmation page

### Security

- UUID share token (same entropy as quote share tokens)
- Form only accepts an account number string — no other fields exposed
- Rate-limited to prevent abuse (same Postgres-backed rate limiter)
- Token is single-purpose — only exposes invoice/quote number, description, amount, and creator name
- Expired/completed series tokens return a clear "already submitted" or "expired" message
- Excluded from auth middleware alongside existing public quote routes

---

## Follow-Up Initiation

### Detail Page

- A **"Request Account Number"** button appears on invoice/quote detail pages when the `accountNumber` field is empty
- Button does not appear if there is already an `ACTIVE` series for that invoice/quote
- Clicking opens a confirmation dialog:
  - Shows: recipient name, email, "A request will be sent now, followed by up to 4 weekly reminders if needed"
  - Confirm / Cancel buttons
- On confirm:
  1. POST to `/api/follow-ups/initiate` with `invoiceId`
  2. **Acquire advisory lock** on the invoiceId (`pg_try_advisory_xact_lock(hashOf(invoiceId))`) to prevent concurrent initiations for the same item. If the lock is not acquired, return a conflict error.
  3. Re-check within the lock that the invoice/quote still has no account number and no active series (prevents TOCTOU race).
  4. **Persist a claim row**: insert a `FollowUp` with `type: ACCOUNT_FOLLOWUP_CLAIM`, `seriesId: newUUID`, `shareToken: newUUID`, `seriesStatus: ACTIVE`, `maxAttempts: 5`, `metadata: { attempt: 1 }`. This is a fast DB write that makes the token durable before the email is sent — if the recipient clicks the link immediately, the token resolves.
  5. Send the first email via Power Automate webhook, including the share token link.
  6. **If the email send fails**: delete the claim row and return an error to the client. The user sees an error and can retry. No notification, no real-time event.
  7. **If the email send succeeds**: promote the claim row by updating `type` from `ACCOUNT_FOLLOWUP_CLAIM` to `ACCOUNT_FOLLOWUP` and setting `sentAt` to now.
  8. Show the email progress dialog (same stepper pattern as quote email sending)
  9. Create notification `ACCOUNT_FOLLOWUP_SENT` for the creator (only after confirmed send)
  10. Publish real-time event (only after confirmed send)

  This is the same claim-then-promote pattern used by the cron job. The token is durable before the email leaves the system, and the advisory lock prevents duplicate initiations.

  **Stale claim recovery**: If the process dies between persisting the claim (step 4) and promoting it (step 7), a stranded `ACCOUNT_FOLLOWUP_CLAIM` row remains. We cannot know whether the email was actually delivered — Power Automate does not provide a durable delivery ID that could prove acceptance. Therefore, stale claims are **deleted, not promoted**, matching the existing payment reminder pattern in `src/domains/quote/follow-ups.ts:92`. This allows a clean retry on the next attempt. A duplicate email (if the original was actually delivered) is acceptable; a silently lost attempt is not.

  - **Fresh claims** (< 30 minutes old): treated as in-flight sends. The cron job and initiation flow skip the series.
  - **Stale claims** (>= 30 minutes old): deleted by the cron job or initiation flow before proceeding, freeing the series for a retry.
  - The initiation flow acquires the advisory lock first (step 2), then checks for and deletes any stale claims within the lock before proceeding.

### Bulk Action from List

- Checkbox selection on invoice/quote list pages
- **"Request Account Numbers"** bulk action button
  - Only enabled when all selected items: (a) have no account number, and (b) have no active follow-up series
- Confirmation dialog: "Send account number requests for N invoices/quotes?"
- On confirm: initiates series for each selected item sequentially (to avoid email webhook overload)
- **Mixed-result handling**: bulk initiation returns per-item results, not all-or-nothing. Each item independently succeeds or fails. Response shape:
  ```json
  {
    "results": [
      { "invoiceId": "uuid1", "status": "success", "seriesId": "..." },
      { "invoiceId": "uuid2", "status": "error", "error": "Email send failed" }
    ],
    "summary": { "succeeded": 1, "failed": 1 }
  }
  ```
- The UI displays a summary after completion: "3 of 4 requests sent successfully. 1 failed — retry?" with per-item status. Successfully initiated series are not rolled back if later items fail.

### API Route

`POST /api/follow-ups/initiate` (authenticated)

```json
{
  "invoiceIds": ["uuid1", "uuid2"]
}
```

**Note on invoices vs quotes:** In LAPortal, quotes are stored in the same `invoices` table with `type = "QUOTE"`. The `invoiceIds` field accepts IDs for both invoices and quotes — the backend resolves the type from the record. The API, service, and repository layers treat both uniformly since they share the same table and `accountNumber` field.

Returns created series info. Validates:
- User owns the invoices/quotes (or is admin)
- Each item has no account number
- Each item has no active follow-up series
- The item has an associated staff member with an email address (the follow-up recipient). If no staff member is linked, the initiation is rejected with a clear error ("No recipient — assign a staff member first")
- This feature targets **internal requestors/staff only**, not external contacts or quote recipients

---

## Status Display

### Badge Overlay

Wherever status badges appear (list rows, detail pages, recent activity, dashboard), items with a follow-up series show an additional badge alongside the existing status:

| Series State | Badge | Color |
|---|---|---|
| Active, attempt 1 sent | `Follow Up 1/5` | Amber/orange |
| Active, attempt 3 sent | `Follow Up 3/5` | Amber/orange |
| Completed (account number received) | None (badge removed) | — |
| Exhausted (5/5, no response) | `No Response` | Red |

The badge is derived from the **latest** `FollowUp` row for the invoice/quote where `type IN (ACCOUNT_FOLLOWUP, ACCOUNT_FOLLOWUP_CLAIM)`. Claim rows are included so that in-flight or stranded claims still surface in the UI. Because `seriesStatus` and `maxAttempts` are denormalized onto every row in the series, a single query on the latest row provides all the data needed for the badge — no join to the initiator row is required. The badge is not a field on the Invoice model; it is computed at display time from the FollowUp table.

### List Page Filter

New filter chip on invoice and quote list pages: **"Needs Account Number"**

Filters to items that either:
- Have an `ACTIVE` follow-up series, or
- Have an `EXHAUSTED` follow-up series (no response received)

### Dashboard Widget

**"Pending Account Numbers"** card on the dashboard:
- **Team-wide visibility** — shows all active + exhausted follow-up series across the team, consistent with the existing dashboard access model where fiscal data is shared (see `docs/PROJECT-OVERVIEW.md` Access Model section)
- Each row shows the invoice/quote number, type indicator (INV/QTE), requestor name, current attempt (e.g., "3/5"), and creator
- The current user's own items are highlighted for emphasis
- Each row links directly to the **detail page** for that specific invoice or quote (type-aware routing: `/invoices/[id]` or `/quotes/[id]`), since invoices and quotes live on separate list pages and a single combined filter destination does not exist

### Recent Activity

The existing Recent Activity widget (`src/components/dashboard/recent-invoices.tsx`) is a merged invoice/quote feed — it displays `ActivityItem` rows, not a general event stream. Follow-up state is surfaced **as badge overlays on existing invoice/quote rows**, not as separate synthetic feed entries.

When an invoice/quote in the Recent Activity feed has an active or exhausted follow-up series, it displays the `FollowUpBadge` component alongside its normal status badge. This is the same badge shown on list pages and detail pages — no new feed item type is needed.

The badge is computed by including follow-up series state in the existing activity query (a join or subquery on the `follow_ups` table grouped by `invoiceId`).

---

## Scheduled Job

### Registration

- Job key: `account-follow-ups`
- Schedule: `0 9 * * 1` (Monday at 9 AM PST, weekly)
- Registered in `src/instrumentation.ts` alongside `event-reminders` and `payment-follow-ups`
- Uses `runTrackedJob()` for DB-backed execution tracking
- Concurrency safety: per-series claim rows with 30-minute TTL (no global advisory lock — unsafe with Prisma connection pooling)

### Job Route

`POST /api/internal/jobs/account-follow-ups` (cron auth required)

### Job Logic: `checkAndSendAccountFollowUps()`

Lives in `src/domains/follow-up/account-follow-ups.ts`, following the pattern of `src/domains/quote/follow-ups.ts`.

1. Query all `FollowUp` rows where `type IN (ACCOUNT_FOLLOWUP, ACCOUNT_FOLLOWUP_CLAIM)` and `seriesStatus = ACTIVE`
2. Group by `seriesId`, get the latest row per series
3. For each active series:
   a. Check if the invoice/quote now has an account number (manual entry) — if so, mark all series rows `COMPLETED`, skip
   b. Check if 5+ business days have passed since the last `sentAt` — if not, skip (see Cadence section below)
   c. Compute `nextAttempt = existingAttemptCount + 1` — this single value is used for subject, tone, footer text, metadata, and exhaustion check
   d. Safety net: if `nextAttempt > maxAttempts`, mark all series rows `EXHAUSTED`, notify creator, skip (should not happen since exhaustion is immediate after final send — see step h)
   e. **Check for existing claims** in this series: if a fresh claim exists (< 30 minutes old), skip — another process is in-flight. If a stale claim exists (>= 30 minutes old), delete it (delivery is unverifiable) and re-count attempts before proceeding. This matches the payment reminder pattern in `src/domains/quote/follow-ups.ts:92`.
   f. Claim mechanism: create `ACCOUNT_FOLLOWUP_CLAIM` row with `metadata: { attempt: nextAttempt }` to prevent double-sends. The 30-minute TTL is enforced by the stale-claim check in step e — not by automatic DB expiry.
   g. Send email with escalating tone based on `nextAttempt`
   h. Convert the claim row in place: update `type` from `ACCOUNT_FOLLOWUP_CLAIM` to `ACCOUNT_FOLLOWUP`, set `sentAt` to now — this is the single row for this attempt, matching the pattern in `src/domains/quote/follow-ups.ts`. No separate sent row is created.
   h. **If `nextAttempt == maxAttempts`**: immediately mark all series rows `EXHAUSTED`, notify creator with `ACCOUNT_FOLLOWUP_EXHAUSTED` — do not wait for the next cron pass
   i. Otherwise: notify creator with `ACCOUNT_FOLLOWUP_SENT`

### Cadence

The job runs every Monday at 9 AM PST. The inter-attempt guard is **5+ business days** since the last `sentAt`, using the existing `businessDaysBetween()` utility. That utility counts weekday-only days (Monday–Friday) — it does **not** account for holidays. Monday-to-next-Monday is exactly 5 business days, so the guard aligns with the weekly cron schedule.

This means attempts are sent roughly once per week. If a series is initiated mid-week, the first cron pass may be fewer than 5 business days away and will be skipped — the second Monday will be the first cron-triggered send.

---

## Email Templates

### Escalating Tone

| Attempt | Tone | Subject |
|---|---|---|
| 1 | Friendly | "Account number needed — {number}" |
| 2 | Gentle reminder | "Reminder: Account number still needed — {number}" |
| 3 | Firm | "Action required: Account number for {number}" |
| 4 | Urgent | "Urgent: Account number overdue — {number}" |
| 5 | Final notice | "Final notice: Account number required — {number}" |

### Email Body Content

Each email contains:
- Greeting with recipient name
- Invoice/quote number and description
- Total amount
- Escalation-appropriate message explaining why the account number is needed
- Prominent link to the public form
- Copy-link fallback text (the raw URL)
- Creator name and contact for questions
- "This is reminder N of 5" footer text

Emails are HTML, sent via the Power Automate webhook using the existing `sendEmail()` utility from `src/lib/email.ts`.

---

## Notifications

### New Notification Types

| Type | Trigger | Title | Message |
|---|---|---|---|
| `ACCOUNT_FOLLOWUP_SENT` | Each sent account-number request (initial + weekly) | "Follow Up N/5 Sent" | "Follow-up {N} sent for {number} to {recipientName}" |
| `ACCOUNT_FOLLOWUP_EXHAUSTED` | All 5 sent, no response | "Follow-Ups Complete" | "All follow-ups sent for {number} — no account number received" |
| `ACCOUNT_NUMBER_RECEIVED` | Recipient submits via form | "Account Number Received" | "Account number received for {number} from {recipientName}" |

All notifications use `createAndPublish()` from the notification service, which writes to DB and publishes via Supabase Realtime.

---

## Real-Time Events

Follow-up state changes emit the existing real-time event types:
- `invoice-changed` when the invoice's follow-up state changes
- `quote-changed` when the quote's follow-up state changes

Triggered by:
- Series initiation
- Each follow-up email sent (badge updates)
- Account number submitted via public form
- Series marked completed or exhausted

---

## Files Affected

### New Files

| File | Purpose |
|---|---|
| `src/domains/follow-up/types.ts` | FollowUp types, series status enum, notification types |
| `src/domains/follow-up/repository.ts` | Prisma queries for follow-up series |
| `src/domains/follow-up/service.ts` | Business logic: initiate, complete, query series state |
| `src/domains/follow-up/api-client.ts` | Client-side typed fetch wrappers |
| `src/domains/follow-up/hooks.ts` | React hooks for follow-up state |
| `src/domains/follow-up/account-follow-ups.ts` | Cron job logic (mirrors quote/follow-ups.ts) |
| `src/domains/follow-up/email-templates.ts` | 5 escalating email templates |
| `src/app/api/follow-ups/initiate/route.ts` | POST: initiate follow-up series |
| `src/app/api/follow-ups/public/[token]/route.ts` | GET: fetch summary by token |
| `src/app/api/follow-ups/public/[token]/submit/route.ts` | POST: submit account number |
| `src/app/api/internal/jobs/account-follow-ups/route.ts` | Cron job endpoint |
| `src/app/account-request/[token]/page.tsx` | Public account number form page |
| `src/components/follow-up/follow-up-badge.tsx` | Badge component (Follow Up 2/5) |
| `src/components/follow-up/request-account-dialog.tsx` | Initiation confirmation dialog |
| `src/components/follow-up/bulk-request-dialog.tsx` | Bulk initiation dialog |
| `src/components/dashboard/pending-accounts.tsx` | Dashboard widget |
| `prisma/migrations/YYYYMMDD_rename_follow_up_add_series/` | Table rename + new fields |

### Modified Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Rename model, add fields |
| `src/middleware.ts` | Exclude `/account-request` and `/api/follow-ups/public` from auth |
| `src/instrumentation.ts` | Register `account-follow-ups` cron job |
| `src/domains/notification/types.ts` | Add 3 new notification types |
| `src/domains/quote/follow-ups.ts` | Update import from `QuoteFollowUp` to `FollowUp` |
| `src/components/invoices/invoice-detail-info.tsx` | Add "Request Account Number" button |
| `src/components/quotes/quote-detail.tsx` | Add "Request Account Number" button |
| `src/components/invoices/invoice-list.tsx` (or equivalent) | Add bulk action, filter chip, badge |
| `src/components/quotes/quote-list.tsx` (or equivalent) | Add bulk action, filter chip, badge |
| `src/components/dashboard/recent-invoices.tsx` | Show follow-up events and badges |
| `src/components/dashboard/` (layout) | Add pending accounts widget |
| `src/lib/job-runs.ts` | Add `account-follow-ups` to `KNOWN_JOB_KEYS` |
| `docs/PROJECT-OVERVIEW.md` | Document the feature |

---

## Relevant Skills for Implementation

| Skill | Phase |
|---|---|
| `superpowers:writing-plans` | Create implementation plan from this spec |
| `superpowers:using-git-worktrees` | Isolate feature branch |
| `superpowers:test-driven-development` | Tests first for each layer |
| `tdd` | TDD enforcement |
| `postgres-patterns` | Migration, indexing, query optimization |
| `security-review` | Public form routes, token validation |
| `backend-patterns` | API routes, service layer |
| `frontend-patterns` | React components, hooks |
| `superpowers:subagent-driven-development` | Parallel task execution |
| `superpowers:dispatching-parallel-agents` | Independent work streams |
| `e2e` | End-to-end tests for public form flow |
| `superpowers:verification-before-completion` | Final verification |
| `superpowers:requesting-code-review` | Pre-merge review |
| `superpowers:finishing-a-development-branch` | PR and merge |
