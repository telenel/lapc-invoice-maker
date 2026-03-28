# Online Quote Sharing & Approval — Design Spec

**Date:** 2026-03-28
**Approach:** Token-Based Sharing with Embedded Tracking + SSE Notifications

## Overview

Generate shareable links for quotes that external recipients can review, approve, or decline — without logging in. Track views with full analytics. Notify the quote creator in real-time via SSE.

---

## 1. Database Schema Changes

### New field on Invoice model

```prisma
shareToken String? @unique @map("share_token")
```

UUID generated when "Mark as Sent" is clicked. Serves as the public access key for the review page.

### New model: QuoteView

```prisma
model QuoteView {
  id              String   @id @default(uuid())
  invoiceId       String   @map("invoice_id")
  viewedAt        DateTime @default(now()) @map("viewed_at")
  ipAddress       String?  @map("ip_address")
  userAgent       String?  @map("user_agent")
  referrer        String?
  viewport        String?
  durationSeconds Int?     @map("duration_seconds")
  respondedWith   String?  @map("responded_with")

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@map("quote_views")
}
```

### New model: Notification

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  type      String
  title     String
  message   String?
  quoteId   String?  @map("quote_id")
  read      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notifications")
}
```

Both models follow project convention: `@@map("snake_case_table")`, fields `@map("snake_case_column")`.

The `User` model gets a new relation: `notifications Notification[]`.
The `Invoice` model gets a new relation: `quoteViews QuoteView[]`.

---

## 2. Public Quote Review Page

**Route:** `/quotes/review/[token]`

A server component that:
1. Looks up the quote by `shareToken`
2. If not found or expired → shows "Quote not found or expired"
3. If found → renders a read-only view of the quote

### What the recipient sees

- Quote number, date, expiration countdown
- Recipient info (their name, org)
- Staff member info (who sent it)
- Line items table with totals
- Notes (if any)
- **Two buttons at the bottom: "Approve Quote" and "Decline Quote"**
- If already responded → shows status text ("You approved this quote on Mar 28, 2026"), no buttons
- If expired → shows "This quote has expired", no buttons

### Tracking

- On mount: POST to `/api/quotes/public/[token]/view` with viewport dimensions → returns `viewId`
- On `beforeunload`: `navigator.sendBeacon` to `/api/quotes/public/[token]/view/[viewId]` with duration

### Styling

Matches existing app design (shadcn cards, tables, badges) but no nav bar or authenticated chrome. Clean standalone page with LAPC logo at top.

### Middleware

Add `/quotes/review` and `/api/quotes/public` to the matcher exclusion pattern in `src/middleware.ts`.

---

## 3. Send Flow & Share Link UI

### When user clicks "Mark as Sent" on a DRAFT quote

1. Backend generates `shareToken` (UUID), saves on quote, sets status to SENT
2. API returns the share URL: `{origin}/quotes/review/{shareToken}`
3. Frontend shows a **dialog** with:
   - Full share link in a read-only input field
   - **"Copy Link"** button next to input (clipboard icon) — copies to clipboard, shows toast "Link copied!"
   - **"Email Link"** button — opens `mailto:{recipientEmail}?subject=Quote {quoteNumber} from Los Angeles Pierce College&body=...` with the link in the body
   - "Close" button
4. Quote detail refreshes to SENT status

### For quotes already in SENT status

- A **"Share Link"** button in the action bar (next to Edit, Download PDF, etc.)
- Opens the same dialog with copy + email options
- User can re-share anytime

### mailto behavior

- If `recipientEmail` exists → pre-filled in `to:` field
- If no email → `mailto:` opens with empty `to:`
- Subject: `Quote {quoteNumber} from Los Angeles Pierce College`
- Body: brief message with the review link

---

## 4. Notification System & SSE

### SSE Endpoint

`GET /api/notifications/stream` (authenticated via `withAuth`)

- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Heartbeat: `: ping` comment every 30s
- Pushes new notifications as `data: {JSON}` events
- In-memory pub/sub: `Map<userId, Set<WritableStreamDefaultWriter>>` — when a notification is created, publish to all active connections for that user. Single-process, sufficient for deployment.

### Notification triggers

| Type | When | Debounce |
|------|------|----------|
| `QUOTE_VIEWED` | Public page registers a view | 10 min per quote (repeated refreshes don't spam) |
| `QUOTE_APPROVED` | Recipient clicks Approve | None |
| `QUOTE_DECLINED` | Recipient clicks Decline | None |

### Notification domain module

`src/domains/notification/` following existing domain pattern:

- **types.ts** — `NotificationType` enum (`QUOTE_VIEWED`, `QUOTE_APPROVED`, `QUOTE_DECLINED`), `NotificationResponse` DTO
- **repository.ts** — CRUD: `create`, `findByUserId` (paginated, unread-first), `markRead`, `markAllRead`, `countUnread`
- **service.ts** — `createAndPublish` (creates in DB + pushes to SSE), `list`, `markRead`, `markAllRead`
- **api-client.ts** — client-side: `list`, `markRead`, `markAllRead`
- **hooks.ts** — `useNotifications()`: manages `EventSource` connection, merges SSE events with fetched list, exposes unread count

### SSE pub/sub module

`src/lib/sse.ts` — simple in-memory event emitter:
- `subscribe(userId, writer)` — registers a connection
- `unsubscribe(userId, writer)` — removes on disconnect
- `publish(userId, data)` — sends to all active connections for that user

### Navbar bell icon

- Bell icon in top nav with unread count badge (red dot with number)
- Click opens dropdown showing recent notifications
- Each notification clickable → navigates to relevant quote
- "Mark all as read" link at bottom
- Individual notifications marked read on click

---

## 5. Public API Routes

All unauthenticated, excluded from middleware:

### `POST /api/quotes/public/[token]/view`

- Called on page load from public review page
- Captures: IP (from `x-forwarded-for` / request headers), user-agent, referrer, viewport (from body)
- Creates `QuoteView` record
- Returns `{ viewId }`
- Triggers `QUOTE_VIEWED` notification (10-min debounce per quote)

### `PATCH /api/quotes/public/[token]/view/[viewId]`

- Called via `navigator.sendBeacon` on `beforeunload`
- Updates `durationSeconds` on existing `QuoteView` record
- Fire-and-forget (beacon)

### `POST /api/quotes/public/[token]/respond`

- Body: `{ response: "ACCEPTED" | "DECLINED", respondentName?: string }`
- Validates token, checks quote is SENT and not expired
- Updates quote status
- Updates current `QuoteView.respondedWith`
- Creates `QUOTE_APPROVED` or `QUOTE_DECLINED` notification
- Returns `{ success: true, status: "ACCEPTED" | "DECLINED" }`
- Errors: already responded, expired, invalid token

### Authenticated API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/notifications` | GET | List notifications for current user |
| `/api/notifications/[id]` | PATCH | Mark single notification as read |
| `/api/notifications/read-all` | PATCH | Mark all as read |
| `/api/notifications/stream` | GET | SSE endpoint |

### Existing route changes

**`POST /api/quotes/[id]/send`** — updated to:
- Generate `shareToken` (UUID) if not already set
- Return `{ success: true, shareUrl: "..." }`

---

## 6. Quote Detail — View Tracking Display

On the authenticated quote detail page, when quote is SENT/ACCEPTED/DECLINED:

- New **"Activity"** card showing tracking data
- Table of views: date/time, IP address, duration, whether they responded
- Summary: total views, unique IPs, last viewed timestamp

---

## 7. Files Changed / Created

### New files
- `src/domains/notification/types.ts`
- `src/domains/notification/repository.ts`
- `src/domains/notification/service.ts`
- `src/domains/notification/api-client.ts`
- `src/domains/notification/hooks.ts`
- `src/lib/sse.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/api/notifications/read-all/route.ts`
- `src/app/api/notifications/stream/route.ts`
- `src/app/api/quotes/public/[token]/view/route.ts`
- `src/app/api/quotes/public/[token]/view/[viewId]/route.ts`
- `src/app/api/quotes/public/[token]/respond/route.ts`
- `src/app/quotes/review/[token]/page.tsx`
- `src/components/notifications/notification-bell.tsx`
- `src/components/notifications/notification-dropdown.tsx`
- `src/components/quotes/share-link-dialog.tsx`
- `src/components/quotes/quote-activity.tsx`
- `src/components/quotes/public-quote-view.tsx`

### Modified files
- `prisma/schema.prisma` — new models + fields
- `src/middleware.ts` — exclude public quote routes
- `src/app/api/quotes/[id]/send/route.ts` — generate shareToken, return shareUrl
- `src/components/quotes/quote-detail.tsx` — add Share Link button, Activity section, send dialog
- Nav bar component — add notification bell
