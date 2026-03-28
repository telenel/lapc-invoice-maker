# Online Quote Sharing & Approval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable sharing quotes via public links, let recipients approve/decline, track views, and notify creators in real-time via SSE.

**Architecture:** New Prisma models (QuoteView, Notification) + shareToken on Invoice. Public unauthenticated routes for review/respond/tracking. In-memory SSE pub/sub pushes notifications to connected clients. Notification domain module follows existing domain pattern.

**Tech Stack:** Next.js 14 App Router, Prisma 7 (PrismaPg adapter), shadcn/ui v4, Server-Sent Events, navigator.sendBeacon

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/sse.ts` | In-memory SSE pub/sub (subscribe/unsubscribe/publish) |
| `src/domains/notification/types.ts` | NotificationType, NotificationResponse DTO |
| `src/domains/notification/repository.ts` | Prisma CRUD for notifications |
| `src/domains/notification/service.ts` | createAndPublish, list, markRead, markAllRead |
| `src/domains/notification/api-client.ts` | Client-side HTTP methods |
| `src/domains/notification/hooks.ts` | useNotifications hook with EventSource |
| `src/app/api/notifications/route.ts` | GET list notifications |
| `src/app/api/notifications/[id]/route.ts` | PATCH mark single read |
| `src/app/api/notifications/read-all/route.ts` | PATCH mark all read |
| `src/app/api/notifications/stream/route.ts` | GET SSE endpoint |
| `src/app/api/quotes/public/[token]/view/route.ts` | POST register view |
| `src/app/api/quotes/public/[token]/view/[viewId]/route.ts` | PATCH update duration |
| `src/app/api/quotes/public/[token]/respond/route.ts` | POST approve/decline |
| `src/app/quotes/review/[token]/page.tsx` | Public quote review page |
| `src/components/notifications/notification-bell.tsx` | Bell icon + dropdown in navbar |
| `src/components/quotes/share-link-dialog.tsx` | Copy link + email dialog |
| `src/components/quotes/quote-activity.tsx` | View tracking table on detail page |
| `src/components/quotes/public-quote-view.tsx` | Read-only quote view for recipients |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add shareToken, QuoteView model, Notification model, relations |
| `src/middleware.ts` | Exclude `/quotes/review` and `/api/quotes/public` from auth |
| `src/domains/quote/repository.ts` | Add findByShareToken, markSentWithToken, findViewsForQuote |
| `src/domains/quote/service.ts` | Update markSent to generate shareToken, add getByShareToken, recordView, updateViewDuration, respondToQuote |
| `src/domains/quote/types.ts` | Add shareToken to QuoteResponse, add QuoteViewResponse type |
| `src/domains/quote/api-client.ts` | Add markSent return type update, getShareUrl method |
| `src/app/api/quotes/[id]/send/route.ts` | Return shareUrl in response |
| `src/components/quotes/quote-detail.tsx` | Add Share Link button, Activity section, share dialog integration |
| `src/components/nav.tsx` | Add NotificationBell component |

---

## Task 1: Prisma Schema — New Models & Fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add shareToken field to Invoice model**

In `prisma/schema.prisma`, add after the `quoteNumber` line (line 90):

```prisma
  shareToken        String?         @unique @map("share_token")
```

- [ ] **Step 2: Add QuoteView model**

Add after the `UserQuickPick` model (after line 201):

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

- [ ] **Step 3: Add Notification model**

Add after the QuoteView model:

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

- [ ] **Step 4: Add relations to existing models**

Add to the `User` model (after line 22, after `userQuickPicks`):

```prisma
  notifications  Notification[]
```

Add to the `Invoice` model (after `convertedToInvoice` relation on line 101):

```prisma
  quoteViews       QuoteView[]
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add-quote-sharing-notifications
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add QuoteView, Notification models and shareToken field"
```

---

## Task 2: SSE Pub/Sub Module

**Files:**
- Create: `src/lib/sse.ts`

- [ ] **Step 1: Create the SSE pub/sub module**

```typescript
// src/lib/sse.ts

type SSEWriter = ReadableStreamDefaultController<Uint8Array>;

const connections = new Map<string, Set<SSEWriter>>();

export function subscribe(userId: string, controller: SSEWriter): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
}

export function unsubscribe(userId: string, controller: SSEWriter): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) connections.delete(userId);
}

export function publish(userId: string, data: unknown): void {
  const set = connections.get(userId);
  if (!set) return;
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  for (const controller of set) {
    try {
      controller.enqueue(encoded);
    } catch {
      // Connection closed — clean up
      set.delete(controller);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sse.ts
git commit -m "feat: add in-memory SSE pub/sub module"
```

---

## Task 3: Notification Domain — Types

**Files:**
- Create: `src/domains/notification/types.ts`

- [ ] **Step 1: Create notification types**

```typescript
// src/domains/notification/types.ts

export type NotificationType = "QUOTE_VIEWED" | "QUOTE_APPROVED" | "QUOTE_DECLINED";

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  quoteId: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  quoteId?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/notification/types.ts
git commit -m "feat: add notification domain types"
```

---

## Task 4: Notification Domain — Repository

**Files:**
- Create: `src/domains/notification/repository.ts`

- [ ] **Step 1: Create notification repository**

```typescript
// src/domains/notification/repository.ts
import { prisma } from "@/lib/prisma";
import type { CreateNotificationInput } from "./types";

export async function create(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      quoteId: input.quoteId ?? null,
    },
  });
}

export async function findByUserId(userId: string, limit = 20, offset = 0) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ read: "asc" }, { createdAt: "desc" }],
    take: limit,
    skip: offset,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function markRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/notification/repository.ts
git commit -m "feat: add notification repository"
```

---

## Task 5: Notification Domain — Service

**Files:**
- Create: `src/domains/notification/service.ts`

- [ ] **Step 1: Create notification service**

```typescript
// src/domains/notification/service.ts
import * as notificationRepository from "./repository";
import { publish } from "@/lib/sse";
import type { NotificationResponse, CreateNotificationInput } from "./types";

function toResponse(n: { id: string; type: string; title: string; message: string | null; quoteId: string | null; read: boolean; createdAt: Date }): NotificationResponse {
  return {
    id: n.id,
    type: n.type as NotificationResponse["type"],
    title: n.title,
    message: n.message,
    quoteId: n.quoteId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export const notificationService = {
  async createAndPublish(input: CreateNotificationInput): Promise<NotificationResponse> {
    const notification = await notificationRepository.create(input);
    const response = toResponse(notification);
    publish(input.userId, response);
    return response;
  },

  async list(userId: string, limit = 20, offset = 0) {
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.findByUserId(userId, limit, offset),
      notificationRepository.countUnread(userId),
    ]);
    return {
      notifications: notifications.map(toResponse),
      unreadCount,
    };
  },

  async markRead(id: string): Promise<void> {
    await notificationRepository.markRead(id);
  },

  async markAllRead(userId: string): Promise<void> {
    await notificationRepository.markAllRead(userId);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/notification/service.ts
git commit -m "feat: add notification service with SSE publishing"
```

---

## Task 6: Notification API Routes

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/route.ts`
- Create: `src/app/api/notifications/read-all/route.ts`
- Create: `src/app/api/notifications/stream/route.ts`

- [ ] **Step 1: Create GET /api/notifications**

```typescript
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

export const GET = withAuth(async (req: NextRequest, session) => {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const result = await notificationService.list(session.user.id, limit, offset);
  return NextResponse.json(result);
});
```

- [ ] **Step 2: Create PATCH /api/notifications/[id]**

```typescript
// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  await notificationService.markRead(id);
  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Create PATCH /api/notifications/read-all**

```typescript
// src/app/api/notifications/read-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

export const PATCH = withAuth(async (_req: NextRequest, session) => {
  await notificationService.markAllRead(session.user.id);
  return NextResponse.json({ success: true });
});
```

- [ ] **Step 4: Create GET /api/notifications/stream (SSE)**

```typescript
// src/app/api/notifications/stream/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscribe, unsubscribe } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      subscribe(userId, controller);

      // Send initial connection event
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Heartbeat every 30s
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // Connection closed
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 30_000);

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        if (pingInterval) clearInterval(pingInterval);
        if (controllerRef) {
          unsubscribe(userId, controllerRef);
          try { controllerRef.close(); } catch { /* already closed */ }
        }
      });
    },
    cancel() {
      if (pingInterval) clearInterval(pingInterval);
      if (controllerRef) unsubscribe(userId, controllerRef);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/
git commit -m "feat: add notification API routes with SSE stream"
```

---

## Task 7: Notification Domain — Client & Hooks

**Files:**
- Create: `src/domains/notification/api-client.ts`
- Create: `src/domains/notification/hooks.ts`

- [ ] **Step 1: Create notification api-client**

```typescript
// src/domains/notification/api-client.ts
import { ApiError } from "@/domains/shared/types";
import type { NotificationResponse } from "./types";

const BASE = "/api/notifications";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  unreadCount: number;
}

export const notificationApi = {
  async list(limit = 20, offset = 0): Promise<NotificationListResponse> {
    return request<NotificationListResponse>(`${BASE}?limit=${limit}&offset=${offset}`);
  },

  async markRead(id: string): Promise<void> {
    await request(`${BASE}/${id}`, { method: "PATCH" });
  },

  async markAllRead(): Promise<void> {
    await request(`${BASE}/read-all`, { method: "PATCH" });
  },
};
```

- [ ] **Step 2: Create notification hooks**

```typescript
// src/domains/notification/hooks.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notificationApi } from "./api-client";
import type { NotificationResponse } from "./types";

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await notificationApi.list();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + SSE connection
  useEffect(() => {
    fetchNotifications();

    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const notification: NotificationResponse = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch {
        // Ignore parse errors (e.g. ping comments)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/notification/api-client.ts src/domains/notification/hooks.ts
git commit -m "feat: add notification api-client and hooks with SSE"
```

---

## Task 8: Notification Bell Component

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Create the notification bell component**

```tsx
// src/components/notifications/notification-bell.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/domains/notification/hooks";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleNotificationClick(notificationId: string, quoteId: string | null) {
    markRead(notificationId);
    setOpen(false);
    if (quoteId) router.push(`/quotes/${quoteId}`);
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      >
        <BellIcon className="size-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => markAllRead()}
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                No notifications
              </p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border/50 last:border-0",
                    !n.read && "bg-accent/30"
                  )}
                  onClick={() => handleNotificationClick(n.id, n.quoteId)}
                >
                  <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add NotificationBell to the navbar**

In `src/components/nav.tsx`, add the import at line 19 (after HelpModal import):

```typescript
import { NotificationBell } from "@/components/notifications/notification-bell";
```

Then add the component right after `<HelpModal />` on line 113:

```tsx
          <HelpModal />
          <NotificationBell />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/notifications/notification-bell.tsx src/components/nav.tsx
git commit -m "feat: add notification bell with dropdown to navbar"
```

---

## Task 9: Middleware — Exclude Public Routes

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update the matcher pattern**

In `src/middleware.ts`, update the matcher config (line 26-28) to exclude public quote routes:

Replace:

```typescript
export const config = {
  matcher: [
    "/((?!login|api/auth|api/setup|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
```

With:

```typescript
export const config = {
  matcher: [
    "/((?!login|api/auth|api/setup|api/quotes/public|quotes/review|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: exclude public quote routes from auth middleware"
```

---

## Task 10: Quote Domain — Repository Updates

**Files:**
- Modify: `src/domains/quote/repository.ts`

- [ ] **Step 1: Add findByShareToken method**

Add after the `findById` method (after line 132):

```typescript
/**
 * Find a quote by its public share token.
 */
export async function findByShareToken(token: string) {
  return prisma.invoice.findUnique({
    where: { shareToken: token },
    include: detailInclude,
  });
}
```

- [ ] **Step 2: Add markSentWithToken method**

Add after the existing `markSent` method (after line 258):

```typescript
/**
 * Mark a quote as SENT and generate a share token.
 */
export async function markSentWithToken(id: string, shareToken: string) {
  return prisma.invoice.update({
    where: { id },
    data: { quoteStatus: "SENT", shareToken },
  });
}

/**
 * Get the share token for an existing quote.
 */
export async function getShareToken(id: string): Promise<string | null> {
  const result = await prisma.invoice.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  return result?.shareToken ?? null;
}
```

- [ ] **Step 3: Add view tracking methods**

Add at the end of the file:

```typescript
/**
 * Record a quote view.
 */
export async function createView(data: {
  invoiceId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  viewport?: string;
}) {
  return prisma.quoteView.create({ data });
}

/**
 * Update view duration (called via sendBeacon on page unload).
 */
export async function updateViewDuration(viewId: string, durationSeconds: number) {
  return prisma.quoteView.update({
    where: { id: viewId },
    data: { durationSeconds },
  });
}

/**
 * Update the respondedWith field on a view.
 */
export async function updateViewResponse(viewId: string, respondedWith: string) {
  return prisma.quoteView.update({
    where: { id: viewId },
    data: { respondedWith },
  });
}

/**
 * Find all views for a quote (for activity display).
 */
export async function findViewsByInvoiceId(invoiceId: string) {
  return prisma.quoteView.findMany({
    where: { invoiceId },
    orderBy: { viewedAt: "desc" },
  });
}

/**
 * Check if a QUOTE_VIEWED notification was sent for this quote in the last N minutes.
 */
export async function hasRecentView(invoiceId: string, withinMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  const count = await prisma.quoteView.count({
    where: {
      invoiceId,
      viewedAt: { gte: since },
    },
  });
  // count > 1 because the current view was already created
  return count > 1;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/quote/repository.ts
git commit -m "feat: add share token, view tracking to quote repository"
```

---

## Task 11: Quote Domain — Types Update

**Files:**
- Modify: `src/domains/quote/types.ts`

- [ ] **Step 1: Add shareToken to QuoteResponse**

In `src/domains/quote/types.ts`, add `shareToken` to the `QuoteResponse` interface after `pdfPath` (after line 37):

```typescript
  shareToken: string | null;
```

- [ ] **Step 2: Add QuoteViewResponse type**

Add at the end of the file:

```typescript
export interface QuoteViewResponse {
  id: string;
  viewedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  viewport: string | null;
  durationSeconds: number | null;
  respondedWith: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/quote/types.ts
git commit -m "feat: add shareToken and QuoteViewResponse to quote types"
```

---

## Task 12: Quote Domain — Service Updates

**Files:**
- Modify: `src/domains/quote/service.ts`

- [ ] **Step 1: Update toQuoteResponse to include shareToken**

In `src/domains/quote/service.ts`, in the `toQuoteResponse` function, add `shareToken` to the returned object. Add after the `pdfPath: quote.pdfPath,` line (after line 52):

```typescript
    shareToken: quote.shareToken ?? null,
```

- [ ] **Step 2: Update markSent to generate shareToken and return shareUrl**

Replace the existing `markSent` method (lines 193-205) with:

```typescript
  /**
   * Mark a DRAFT quote as SENT and generate a share token.
   * Returns the share token for URL construction.
   */
  async markSent(id: string): Promise<{ shareToken: string }> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (quote.quoteStatus !== "DRAFT") {
      throw Object.assign(
        new Error("Only draft quotes can be marked as sent"),
        { code: "FORBIDDEN" }
      );
    }
    const shareToken = quote.shareToken ?? crypto.randomUUID();
    await quoteRepository.markSentWithToken(id, shareToken);
    return { shareToken };
  },
```

- [ ] **Step 3: Add getByShareToken method**

Add after the `getById` method:

```typescript
  /**
   * Get a quote by its share token (for public access).
   */
  async getByShareToken(token: string): Promise<QuoteResponse | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    // Auto-expire if past expiration date
    if (
      quote.expirationDate &&
      new Date(quote.expirationDate) < new Date() &&
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT")
    ) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      quote.quoteStatus = "EXPIRED";
    }

    return toQuoteResponse(quote);
  },
```

- [ ] **Step 4: Add getShareToken method**

Add after `getByShareToken`:

```typescript
  /**
   * Get the share token for a quote (for share link dialog on already-sent quotes).
   */
  async getShareToken(id: string): Promise<string | null> {
    return quoteRepository.getShareToken(id);
  },
```

- [ ] **Step 5: Add view tracking methods**

Add after `getShareToken`:

```typescript
  /**
   * Record a quote page view and optionally trigger a notification.
   */
  async recordView(
    token: string,
    data: { ipAddress?: string; userAgent?: string; referrer?: string; viewport?: string }
  ): Promise<{ viewId: string } | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    const view = await quoteRepository.createView({
      invoiceId: quote.id,
      ...data,
    });

    // Debounce: only notify if no view in last 10 minutes
    const hasRecent = await quoteRepository.hasRecentView(quote.id, 10);
    if (!hasRecent) {
      const { notificationService } = await import("@/domains/notification/service");
      await notificationService.createAndPublish({
        userId: quote.createdBy,
        type: "QUOTE_VIEWED",
        title: `${quote.quoteNumber ?? "Quote"} was viewed`,
        message: quote.recipientName ? `Viewed by ${quote.recipientName}` : "Someone viewed your quote",
        quoteId: quote.id,
      });
    }

    return { viewId: view.id };
  },

  /**
   * Update the duration of a page view (called via sendBeacon).
   */
  async updateViewDuration(viewId: string, durationSeconds: number): Promise<void> {
    await quoteRepository.updateViewDuration(viewId, durationSeconds);
  },

  /**
   * Handle a recipient's response (approve/decline) to a quote.
   */
  async respondToQuote(
    token: string,
    response: "ACCEPTED" | "DECLINED",
    viewId?: string
  ): Promise<{ success: boolean; status: string } | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    if (quote.quoteStatus !== "SENT") {
      throw Object.assign(
        new Error(
          quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED"
            ? "This quote has already been responded to"
            : "This quote is no longer available"
        ),
        { code: "FORBIDDEN" }
      );
    }

    // Check expiration
    if (quote.expirationDate && new Date(quote.expirationDate) < new Date()) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      throw Object.assign(new Error("This quote has expired"), { code: "FORBIDDEN" });
    }

    await quoteRepository.update(quote.id, { quoteStatus: response });

    if (viewId) {
      await quoteRepository.updateViewResponse(viewId, response);
    }

    const { notificationService } = await import("@/domains/notification/service");
    const notifType = response === "ACCEPTED" ? "QUOTE_APPROVED" : "QUOTE_DECLINED";
    const verb = response === "ACCEPTED" ? "approved" : "declined";
    await notificationService.createAndPublish({
      userId: quote.createdBy,
      type: notifType,
      title: `${quote.quoteNumber ?? "Quote"} was ${verb}`,
      message: quote.recipientName ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} by ${quote.recipientName}` : undefined,
      quoteId: quote.id,
    });

    return { success: true, status: response };
  },

  /**
   * Get all views for a quote (for activity display on detail page).
   */
  async getViews(id: string): Promise<QuoteViewResponse[]> {
    const views = await quoteRepository.findViewsByInvoiceId(id);
    return views.map((v) => ({
      id: v.id,
      viewedAt: v.viewedAt.toISOString(),
      ipAddress: v.ipAddress,
      userAgent: v.userAgent,
      referrer: v.referrer,
      viewport: v.viewport,
      durationSeconds: v.durationSeconds,
      respondedWith: v.respondedWith,
    }));
  },
```

- [ ] **Step 6: Add QuoteViewResponse import to the service file**

At the top of the file, update the imports from `./types` to include `QuoteViewResponse`:

```typescript
import type {
  QuoteResponse,
  QuoteItemResponse,
  QuoteFilters,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteViewResponse,
} from "./types";
```

- [ ] **Step 7: Commit**

```bash
git add src/domains/quote/service.ts
git commit -m "feat: add share token, view tracking, respond to quote service"
```

---

## Task 13: Quote API — Update Send Route & Add Public Routes

**Files:**
- Modify: `src/app/api/quotes/[id]/send/route.ts`
- Create: `src/app/api/quotes/public/[token]/view/route.ts`
- Create: `src/app/api/quotes/public/[token]/view/[viewId]/route.ts`
- Create: `src/app/api/quotes/public/[token]/respond/route.ts`

- [ ] **Step 1: Update the send route to return shareUrl**

Replace the entire `src/app/api/quotes/[id]/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const POST = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const { shareToken } = await quoteService.markSent(id);
    const origin = req.headers.get("origin") ?? req.headers.get("host") ?? "";
    const protocol = origin.startsWith("http") ? "" : "https://";
    const shareUrl = `${protocol}${origin}/quotes/review/${shareToken}`;
    return NextResponse.json({ success: true, shareUrl });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("POST /api/quotes/[id]/send failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
```

- [ ] **Step 2: Create POST /api/quotes/public/[token]/view**

```typescript
// src/app/api/quotes/public/[token]/view/route.ts
import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await quoteService.recordView(token, {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    referrer: req.headers.get("referer") ?? undefined,
    viewport: body.viewport ?? undefined,
  });

  if (!result) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ viewId: result.viewId });
}
```

- [ ] **Step 3: Create PATCH /api/quotes/public/[token]/view/[viewId]**

```typescript
// src/app/api/quotes/public/[token]/view/[viewId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string; viewId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { viewId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const duration = Number(body.durationSeconds);

  if (!isNaN(duration) && duration > 0) {
    await quoteService.updateViewDuration(viewId, Math.round(duration));
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create POST /api/quotes/public/[token]/respond**

```typescript
// src/app/api/quotes/public/[token]/respond/route.ts
import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const response = body.response;
  if (response !== "ACCEPTED" && response !== "DECLINED") {
    return NextResponse.json({ error: "Invalid response. Must be ACCEPTED or DECLINED" }, { status: 400 });
  }

  try {
    const result = await quoteService.respondToQuote(token, response, body.viewId);
    if (!result) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    console.error("POST /api/quotes/public/[token]/respond failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/quotes/[id]/send/route.ts src/app/api/quotes/public/
git commit -m "feat: add public quote view/respond API routes, update send route"
```

---

## Task 14: Quote API Client Update

**Files:**
- Modify: `src/domains/quote/api-client.ts`

- [ ] **Step 1: Update markSent return type**

In `src/domains/quote/api-client.ts`, replace the `markSent` method (lines 71-74):

```typescript
  async markSent(id: string): Promise<{ success: boolean; shareUrl: string }> {
    return request<{ success: boolean; shareUrl: string }>(`${BASE}/${id}/send`, {
      method: "POST",
    });
  },
```

- [ ] **Step 2: Add getViews method**

Add after the `getPdf` method (before the closing `};`):

```typescript
  async getViews(id: string): Promise<import("./types").QuoteViewResponse[]> {
    return request<import("./types").QuoteViewResponse[]>(`${BASE}/${id}/views`);
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/quote/api-client.ts
git commit -m "feat: update quote api-client with shareUrl and views"
```

---

## Task 15: Quote Views API Route

**Files:**
- Create: `src/app/api/quotes/[id]/views/route.ts`

- [ ] **Step 1: Create GET /api/quotes/[id]/views**

```typescript
// src/app/api/quotes/[id]/views/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const views = await quoteService.getViews(id);
    return NextResponse.json(views);
  } catch (err) {
    console.error("GET /api/quotes/[id]/views failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/quotes/[id]/views/route.ts
git commit -m "feat: add quote views API route"
```

---

## Task 16: Share Link Dialog Component

**Files:**
- Create: `src/components/quotes/share-link-dialog.tsx`

- [ ] **Step 1: Create the share link dialog**

```tsx
// src/components/quotes/share-link-dialog.tsx
"use client";

import { useRef } from "react";
import { CopyIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  quoteNumber: string | null;
  recipientEmail: string | null;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  shareUrl,
  quoteNumber,
  recipientEmail,
}: ShareLinkDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Link copied!");
      inputRef.current?.select();
    });
  }

  function handleEmail() {
    const subject = encodeURIComponent(
      `Quote ${quoteNumber ?? ""} from Los Angeles Pierce College`
    );
    const body = encodeURIComponent(
      `Hello,\n\nPlease review the following quote:\n\n${shareUrl}\n\nThank you.`
    );
    const to = recipientEmail ? encodeURIComponent(recipientEmail) : "";
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Quote Link</DialogTitle>
          <DialogDescription>
            Send this link to your recipient so they can review and respond to the quote.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono select-all"
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline" size="sm" onClick={handleCopy} title="Copy to clipboard">
              <CopyIcon className="size-4 mr-1.5" />
              Copy
            </Button>
          </div>
          <Button className="w-full" onClick={handleEmail}>
            <MailIcon className="size-4 mr-2" />
            Email Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quotes/share-link-dialog.tsx
git commit -m "feat: add share link dialog with copy and email"
```

---

## Task 17: Quote Activity Component

**Files:**
- Create: `src/components/quotes/quote-activity.tsx`

- [ ] **Step 1: Create the quote activity component**

```tsx
// src/components/quotes/quote-activity.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { QuoteViewResponse } from "@/domains/quote/types";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortenUA(ua: string | null): string {
  if (!ua) return "—";
  // Extract browser name roughly
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  return "Other";
}

export function QuoteActivity({ quoteId }: { quoteId: string }) {
  const [views, setViews] = useState<QuoteViewResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}/views`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setViews(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) return null;
  if (views.length === 0) return null;

  const uniqueIPs = new Set(views.map((v) => v.ipAddress).filter(Boolean)).size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Activity</span>
          <span className="text-sm font-normal text-muted-foreground">
            {views.length} view{views.length !== 1 ? "s" : ""} · {uniqueIPs} unique IP{uniqueIPs !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>Viewport</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((view) => (
              <TableRow key={view.id}>
                <TableCell className="text-sm">{formatDateTime(view.viewedAt)}</TableCell>
                <TableCell className="text-sm font-mono">{view.ipAddress ?? "—"}</TableCell>
                <TableCell className="text-sm">{shortenUA(view.userAgent)}</TableCell>
                <TableCell className="text-sm font-mono">{view.viewport ?? "—"}</TableCell>
                <TableCell className="text-sm">{formatDuration(view.durationSeconds)}</TableCell>
                <TableCell>
                  {view.respondedWith ? (
                    <Badge variant={view.respondedWith === "ACCEPTED" ? "default" : "destructive"}>
                      {view.respondedWith === "ACCEPTED" ? "Approved" : "Declined"}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quotes/quote-activity.tsx
git commit -m "feat: add quote activity tracking component"
```

---

## Task 18: Public Quote Review Page

**Files:**
- Create: `src/components/quotes/public-quote-view.tsx`
- Create: `src/app/quotes/review/[token]/page.tsx`

- [ ] **Step 1: Create the public quote view component**

```tsx
// src/components/quotes/public-quote-view.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

interface PublicQuote {
  id: string;
  quoteNumber: string | null;
  quoteStatus: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  date: string;
  expirationDate: string | null;
  department: string;
  category: string;
  notes: string;
  totalAmount: number;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  staff: {
    name: string;
    title: string;
    department: string;
    extension: string | null;
    email: string | null;
  };
  items: QuoteItem[];
}

function expirationText(dateStr: string): string {
  const exp = new Date(dateStr);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (diffDays === 0) return "Expires today";
  return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`;
}

export function PublicQuoteView({ token }: { token: string }) {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const viewIdRef = useRef<string | null>(null);
  const loadTimeRef = useRef<number>(Date.now());

  // Fetch quote and register view
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quotes/public/${token}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          }),
        });

        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const { viewId } = await res.json();
        viewIdRef.current = viewId;

        // Now fetch the quote data via the respond endpoint with a GET-like approach
        // Actually, we need a separate endpoint to get quote data. Let's use the view response
        // to confirm the quote exists, then fetch via a dedicated public GET
      } catch {
        setNotFound(true);
      }
    }
    load();
  }, [token]);

  // Fetch quote data separately
  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/quotes/public/${token}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          }),
        });
        // We actually need a GET route for the quote data
        // Let me adjust — we'll use the existing pattern
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchQuote();
  }, [token]);

  // Send duration on page unload
  useEffect(() => {
    function handleUnload() {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - loadTimeRef.current) / 1000);
      const blob = new Blob(
        [JSON.stringify({ durationSeconds: duration })],
        { type: "application/json" }
      );
      navigator.sendBeacon(
        `/api/quotes/public/${token}/view/${viewIdRef.current}`,
        blob
      );
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [token]);

  async function handleRespond(response: "ACCEPTED" | "DECLINED") {
    setResponding(true);
    try {
      const res = await fetch(`/api/quotes/public/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, viewId: viewIdRef.current }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to submit response");
        return;
      }
      const data = await res.json();
      setResponded(true);
      setQuote((prev) => prev ? { ...prev, quoteStatus: data.status } : prev);
      toast.success(response === "ACCEPTED" ? "Quote approved!" : "Quote declined");
    } catch {
      toast.error("Failed to submit response");
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading quote...</p>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Quote Not Found</h2>
            <p className="text-muted-foreground">
              This quote may have expired or the link is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = quote.quoteStatus === "EXPIRED";
  const alreadyResponded = quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED";
  const canRespond = quote.quoteStatus === "SENT" && !responded;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lapc-logo.png" alt="LAPC" width={22} style={{ height: "22px" }} />
          </div>
          <div>
            <h1 className="font-bold text-lg">Los Angeles Pierce College</h1>
            <p className="text-sm text-muted-foreground">Quote Review</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Quote header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{quote.quoteNumber ?? "Quote"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Date: {formatDate(quote.date)}
            </p>
            {quote.expirationDate && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {expirationText(quote.expirationDate)}
              </p>
            )}
          </div>
          {isExpired && <Badge variant="outline">Expired</Badge>}
          {quote.quoteStatus === "ACCEPTED" && <Badge variant="default">Approved</Badge>}
          {quote.quoteStatus === "DECLINED" && <Badge variant="destructive">Declined</Badge>}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Staff info */}
          <Card>
            <CardHeader>
              <CardTitle>From</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{quote.staff.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Title</span>
                <span>{quote.staff.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Department</span>
                <span>{quote.staff.department}</span>
              </div>
              {quote.staff.email && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{quote.staff.email}</span>
                </div>
              )}
              {quote.staff.extension && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extension</span>
                  <span>{quote.staff.extension}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipient info */}
          {(quote.recipientName || quote.recipientOrg) && (
            <Card>
              <CardHeader>
                <CardTitle>To</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quote.recipientName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{quote.recipientName}</span>
                  </div>
                )}
                {quote.recipientOrg && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span>{quote.recipientOrg}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Notes */}
        {quote.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Line items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Extended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(item.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(item.extendedPrice)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatAmount(quote.totalAmount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Response section */}
        {canRespond && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground mb-4">
                Would you like to approve or decline this quote?
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => handleRespond("ACCEPTED")}
                  disabled={responding}
                  className="bg-green-600 text-white hover:bg-green-700 min-w-[140px]"
                >
                  {responding ? "Submitting..." : "Approve Quote"}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => handleRespond("DECLINED")}
                  disabled={responding}
                  className="min-w-[140px]"
                >
                  {responding ? "Submitting..." : "Decline Quote"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {alreadyResponded && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {quote.quoteStatus === "ACCEPTED"
                  ? "This quote has been approved."
                  : "This quote has been declined."}
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                This quote has expired and can no longer be responded to.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fix the data loading — add a public GET route for quote data**

We need to add a GET route so the public page can fetch quote data. Create:

```typescript
// src/app/api/quotes/public/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const quote = await quoteService.getByShareToken(token);

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json(quote);
}
```

- [ ] **Step 3: Update PublicQuoteView to use proper data loading**

Replace the two `useEffect` blocks for data loading (the ones containing `load` and `fetchQuote`) with a single clean effect:

```tsx
  // Fetch quote data and register view
  useEffect(() => {
    async function init() {
      try {
        // Fetch quote data
        const quoteRes = await fetch(`/api/quotes/public/${token}`);
        if (!quoteRes.ok) {
          setNotFound(true);
          return;
        }
        const quoteData: PublicQuote = await quoteRes.json();
        setQuote(quoteData);

        // Register view
        const viewRes = await fetch(`/api/quotes/public/${token}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          }),
        });
        if (viewRes.ok) {
          const { viewId } = await viewRes.json();
          viewIdRef.current = viewId;
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token]);
```

- [ ] **Step 4: Create the page route**

```tsx
// src/app/quotes/review/[token]/page.tsx
import { PublicQuoteView } from "@/components/quotes/public-quote-view";

export default async function QuoteReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicQuoteView token={token} />;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/public-quote-view.tsx src/app/quotes/review/ src/app/api/quotes/public/[token]/route.ts
git commit -m "feat: add public quote review page with tracking"
```

---

## Task 19: Update Quote Detail View

**Files:**
- Modify: `src/components/quotes/quote-detail.tsx`

- [ ] **Step 1: Add imports for new components**

Add at the top of `src/components/quotes/quote-detail.tsx`, after the existing imports:

```typescript
import { ShareLinkDialog } from "@/components/quotes/share-link-dialog";
import { QuoteActivity } from "@/components/quotes/quote-activity";
```

Add `LinkIcon` to the lucide-react imports (there aren't any currently — add a new import):

```typescript
import { LinkIcon } from "lucide-react";
```

- [ ] **Step 2: Add state for share dialog**

In the component, after the existing state declarations (after line 128), add:

```typescript
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
```

- [ ] **Step 3: Update handleMarkAsSent to show share dialog**

Replace the `handleMarkAsSent` function (lines 170-191) with:

```typescript
  async function handleMarkAsSent() {
    if (!quote) return;
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to mark quote as sent");
      } else {
        const data = await res.json();
        toast.success("Quote marked as sent");
        setShareUrl(data.shareUrl);
        setShareDialogOpen(true);
        // Refresh quote data
        const refreshRes = await fetch(`/api/quotes/${id}`);
        if (refreshRes.ok) {
          const refreshData: Quote = await refreshRes.json();
          setQuote(refreshData);
        }
      }
    } catch {
      toast.error("Failed to mark quote as sent");
    } finally {
      setSending(false);
    }
  }
```

- [ ] **Step 4: Add handleShareLink function**

Add after `handleMarkAsSent`:

```typescript
  async function handleShareLink() {
    if (!quote) return;
    // For already-sent quotes, construct URL from shareToken
    if (quote.shareToken) {
      setShareUrl(`${window.location.origin}/quotes/review/${quote.shareToken}`);
      setShareDialogOpen(true);
    }
  }
```

- [ ] **Step 5: Add shareToken to the Quote interface**

In the `Quote` interface (around line 49), add after `recipientOrg`:

```typescript
  shareToken: string | null;
```

- [ ] **Step 6: Add Share Link button in the action bar**

After the "Download PDF" button (around line 301) and before the "Mark as Sent" button, add:

```tsx
          {/* Share Link: SENT, ACCEPTED, DECLINED (has shareToken) */}
          {status !== "DRAFT" && quote.shareToken && (
            <Button variant="outline" size="sm" onClick={handleShareLink}>
              <LinkIcon className="size-3.5 mr-1.5" />
              Share Link
            </Button>
          )}
```

- [ ] **Step 7: Add ShareLinkDialog and QuoteActivity to the JSX**

Add the `ShareLinkDialog` right before the closing `</div>` of the component (before the final `</div>` that wraps `space-y-6`):

```tsx
      {/* Share Link Dialog */}
      {shareUrl && (
        <ShareLinkDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          shareUrl={shareUrl}
          quoteNumber={quote.quoteNumber}
          recipientEmail={quote.recipientEmail}
        />
      )}
```

Add the `QuoteActivity` component after the Line Items card (after the closing `</Card>` for line items, around line 568):

```tsx
      {/* Activity tracking */}
      {(status === "SENT" || status === "ACCEPTED" || status === "DECLINED") && (
        <QuoteActivity quoteId={id} />
      )}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/quotes/quote-detail.tsx
git commit -m "feat: integrate share dialog and activity tracking in quote detail"
```

---

## Task 20: Build & Verify

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All existing tests pass. New code doesn't break anything.

- [ ] **Step 3: Fix any issues found**

Address any type errors or test failures.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: address build/test issues from quote sharing feature"
```
