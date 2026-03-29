# AI Assistant & Calendar Enhancements — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Features:** AI chatbot sidebar, calendar event management, birthday tracking

---

## 1. AI Assistant (Chatbot Sidebar)

### 1.1 Overview

A persistent AI assistant sidebar powered by Claude Haiku via the Vercel AI SDK. Available to all logged-in users on every page. The assistant can answer portal questions, look up data, create/modify records, and navigate users to pages.

### 1.2 Tech Stack

- **Vercel AI SDK**: `ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`
- **Model**: Claude Haiku (`claude-haiku-4-5-20251001`)
- **Streaming**: Via `streamText()` and `useChat` hook
- **New env var**: `ANTHROPIC_API_KEY`

### 1.3 Architecture

```text
React Sidebar (useChat) ↔ POST /api/chat (withAuth + streamText) ↔ Claude Haiku + Tools
                                                                         ↓
                                                              Existing Domain Services
                                                     (invoice, quote, staff, calendar, analytics)
```

The API route defines tools using Zod schemas. Each tool calls existing domain services — no new data layer needed. The authenticated user's session is passed to every tool call for ownership enforcement.

### 1.4 UI Design

**Right sidebar, always open by default:**
- Width: ~320px
- Minimize button collapses to thin icon strip (~36px) on the right edge
- Open/closed state persisted in localStorage
- Auto-minimize on narrow viewports (< 768px)
- Content area reflows when sidebar toggles

**Sidebar contents:**
- Header: "LAPC Assistant" with online indicator and minimize button
- Welcome message with personalized greeting (uses session user name)
- Suggested quick-action chips: "Show pending invoices", "Today's events", "Create a quote"
- Message thread with bot/user bubbles
- Rich data cards inline for query results (e.g., invoice list with amounts, links)
- Clickable links in responses to navigate to records
- Input area with text field and send button

### 1.5 Tools

The assistant has access to these tool groups, all calling existing domain services:

| Tool Group | Actions | Service |
|------------|---------|---------|
| **Invoice** | list, get by ID, create, update, mark as sent | `invoice/service` |
| **Quote** | list, get by ID, create, update, send | `quote/service` |
| **Staff** | search, lookup by name/ID | `staff/service` |
| **Calendar** | list events, create event, update event, delete event | `event/service` (new) + existing calendar route |
| **Analytics** | get stats, monthly totals, department breakdown | `analytics/service` |
| **Navigation** | route user to a specific page | Client-side via response metadata |
| **Help/Docs** | answer questions about portal usage | System prompt with embedded knowledge |

### 1.6 Safeguards

- **Ownership enforcement**: Users can only modify their own invoices and quotes. The system prompt instructs the assistant to check `createdBy === session.user.id` before any mutation. Tools enforce this server-side.
- **Destructive action confirmation**: Delete operations require the assistant to ask for explicit confirmation before executing. The tool is not called until the user confirms.
- **Calendar events are communal**: Any user can create/edit/delete any calendar event (no ownership restriction).
- **Admin bypass**: Admin-role users can modify any record.

### 1.7 Conversations

- **Ephemeral**: No conversation history stored in the database. Chat resets on page refresh.
- **Rate limiting**: Per-user rate limit (e.g., 20 requests/minute) to prevent accidental cost exhaustion. Uses the existing `src/lib/rate-limit.ts` infrastructure.
- **Context**: Each conversation starts fresh with a system prompt containing portal knowledge, the user's name/role, and tool definitions.

---

## 2. Calendar Enhancements

### 2.1 Overview

Extend the existing catering-only calendar to support general-purpose events (meetings, seminars, vendor events, etc.) with color coding, recurrence, reminders, and auto-generated birthday events from staff profiles.

### 2.2 Event Sources

The calendar merges three event sources in the `GET /api/calendar/events` endpoint:

1. **Catering events** — existing, from Invoice model where `isCateringEvent = true` (orange)
2. **Manual events** — new, from Event table (color by type)
3. **Birthdays** — computed on-the-fly from Staff `birthMonth`/`birthDay` fields (pink, all-day)

### 2.3 New Database Schema

#### Event Table

```prisma
enum EventType {
  MEETING
  SEMINAR
  VENDOR
  OTHER
}

enum Recurrence {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
}

model Event {
  id              String      @id @default(uuid())
  title           String
  description     String?
  type            EventType
  date            DateTime
  startTime       String?     // "HH:mm" format, null if allDay
  endTime         String?     // "HH:mm" format, null if allDay
  allDay          Boolean     @default(false)
  location        String?
  color           String      // Auto-set from type, overridable
  recurrence      Recurrence?
  recurrenceEnd   DateTime?   // null = recurs forever
  reminderMinutes Int?        // 15, 30, 60, 120, 1440; null = no reminder
  reminderSentDates Json       @default("[]")   // Array of ISO date strings for sent reminders (supports recurring)
  createdBy       String
  creator         User        @relation(fields: [createdBy], references: [id])
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@map("events")
}
```

#### Staff Model Addition

```prisma
// Add to existing Staff model:
birthMonth  Int?    // 1-12, no year
birthDay    Int?    // 1-31, no year
```

### 2.4 Event Type Color Mapping

| Type | Color | Hex | Rationale |
|------|-------|-----|-----------|
| Catering | Orange | `#f97316` | Existing, unchanged |
| Meeting | Blue | `#3b82f6` | Professional, most common |
| Seminar | Purple | `#8b5cf6` | Educational |
| Birthday | Pink | `#ec4899` | Celebratory |
| Vendor | Teal | `#14b8a6` | External/business |
| Other | Gray | `#6b7280` | Catch-all |

### 2.5 Event Creation

- **"Add Event" button** on the calendar page header (no drag-to-create, no click-on-cell creation)
- Opens a **modal form** with fields:
  - Title (required)
  - Event Type (pill selector: Meeting, Seminar, Vendor, Other)
  - Date (date picker)
  - All Day toggle
  - Start Time / End Time (shown when not all-day)
  - Repeat (pill selector: No repeat, Daily, Weekly, Monthly, Yearly)
  - Recurrence End Date (shown when repeat is set)
  - Location (optional text)
  - Description (optional textarea)
  - Reminder (pill selector: None, 15 min, 30 min, 1 hour, 2 hours, 1 day — default: 1 hour)
- **Editing**: Click an event on the calendar to open the same form pre-filled. All users can edit any event.
- **Deleting**: Delete button in the edit form. Confirmation required.

### 2.6 Recurrence

- Recurrence is stored on the base event record (not expanded into individual rows).
- The API route expands recurring events into individual occurrences when querying a date range.
- Expansion logic: given base event date and recurrence type, generate occurrences within the requested range, stopping at `recurrenceEnd` if set.
- Editing a recurring event edits all future occurrences (single-edit not supported in v1).

### 2.7 Birthday Auto-Generation

- Staff with `birthMonth` and `birthDay` set automatically appear as all-day pink birthday events on the calendar.
- Computed on-the-fly in the API route — not stored in the Event table.
- Format: "🎂 {staffName}'s Birthday"
- Clicking a birthday event navigates to the staff member's profile.
- Birthday reminders: notification sent to all users on the morning of (via the reminder system).

### 2.8 Onboarding & Staff Profile Changes

- Staff onboarding/profile form gets two new optional fields: **Birth Month** (dropdown, Jan–Dec) and **Birth Day** (number input, 1–31).
- No year field — privacy-conscious, only month and day.
- Optional — staff without birthdays don't appear on the calendar.
- Admin can also set birthdays in the Staff management panel.

---

## 3. Notifications & Reminders

### 3.1 Integration with Existing System

Reminders use the existing notification infrastructure:
- `Notification` table for persistence
- SSE stream via `GET /api/notifications/stream` for real-time delivery
- `NotificationBell` component for display

### 3.2 Reminder Trigger Mechanism

- **Scheduled check**: Reminders are checked via a dedicated scheduled trigger (e.g., cron-based API route or `setInterval` in the SSE connection handler), not piggybacked on unrelated API calls. This avoids unpredictable side effects and duplicate work during traffic spikes.
- After sending, append the occurrence date to `reminderSentDates` JSON array to prevent duplicates (idempotent processing).
- This supports recurring events naturally — each occurrence date is tracked independently.

### 3.3 Reminder Defaults

- All new events default to a 1-hour reminder.
- The event creator can change or disable the reminder.
- Birthday reminders auto-fire at 8:00 AM on the day of.

### 3.4 Notification Targets

- Event reminders are sent to **all users** (shared office calendar model).
- Birthday reminders are sent to **all users**.

---

## 4. New Domain Module: `event`

Following the existing domain pattern:

```text
src/domains/event/
├── types.ts          # Event, EventType, Recurrence types
├── repository.ts     # Prisma CRUD + recurrence expansion
├── service.ts        # Business logic, reminder checks
├── api-client.ts     # Client-side fetch wrappers
└── hooks.ts          # React hooks (useEvents, useCreateEvent, etc.)
```

---

## 5. New Domain Module: `chat`

```text
src/domains/chat/
├── types.ts          # Message types, tool definitions
├── tools.ts          # Tool implementations (invoke, quote, staff, etc.)
├── system-prompt.ts  # System prompt with portal knowledge
└── hooks.ts          # React hooks (wrapper around useChat)
```

API route: `src/app/api/chat/route.ts`
Component: `src/components/chat/chat-sidebar.tsx`

---

## 6. File Changes Summary

### New Files
- `src/domains/event/` — full domain module (types, repository, service, api-client, hooks)
- `src/domains/chat/` — chat domain (types, tools, system-prompt, hooks)
- `src/app/api/chat/route.ts` — streaming chat endpoint
- `src/app/api/events/route.ts` — CRUD for manual events
- `src/app/api/events/[id]/route.ts` — single event operations
- `src/components/chat/chat-sidebar.tsx` — sidebar component
- `src/components/chat/chat-message.tsx` — message bubble component
- `src/components/chat/chat-input.tsx` — input with send button
- `src/components/calendar/add-event-modal.tsx` — event creation/edit form
- `src/components/calendar/event-legend.tsx` — color legend bar
- Prisma migration for Event table and Staff birthday fields

### Modified Files
- `prisma/schema.prisma` — add Event model, EventType/Recurrence enums, Staff birthday fields
- `src/app/layout.tsx` — wrap with chat sidebar
- `src/app/calendar/page.tsx` — add event button, legend, click-to-edit, merged event sources
- `src/app/api/calendar/events/route.ts` — merge manual events + birthdays into response
- `src/components/staff/` — add birthday fields to staff forms
- `src/components/dashboard/todays-events.tsx` — show all event types, not just catering
- `package.json` — add Vercel AI SDK packages
- `.env.local` (untracked) — add ANTHROPIC_API_KEY; also add as GitHub Actions secret and VPS env var for production

---

## 7. Out of Scope (v1)

- Google Calendar sync
- File/image attachments in chat
- Chat conversation history persistence
- Per-user reminder preferences (all users get all reminders)
- Single-occurrence edits for recurring events (edit-all only in v1)
- Drag-to-create or drag-to-resize on calendar
- Chat on mobile (auto-minimized, accessible via icon)
