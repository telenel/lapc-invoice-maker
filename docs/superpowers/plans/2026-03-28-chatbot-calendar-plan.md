# AI Assistant & Calendar Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent AI chatbot sidebar (Vercel AI SDK + Claude Haiku) and enhance the calendar with general-purpose events, recurrence, color coding, birthday auto-generation, and reminders.

**Architecture:** Two new domain modules (`event`, `chat`) following the existing domain pattern (types → repository → service → api-client → hooks). The chatbot uses Vercel AI SDK with tools that call existing domain services. Calendar merges three event sources (catering, manual, birthdays) into a unified API response.

**Tech Stack:** Next.js 14, Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`), Prisma 7, FullCalendar 6, Zod 4, Vitest

**Spec:** [docs/superpowers/specs/2026-03-28-chatbot-calendar-design.md](../specs/2026-03-28-chatbot-calendar-design.md)

---

## Phase 1: Calendar Enhancements (Event Domain)

### Task 1: Prisma Schema — Event Model & Staff Birthday Fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add EventType and Recurrence enums and Event model to schema**

Add after the existing `QuoteStatus` enum in `prisma/schema.prisma`:

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
  id                String      @id @default(uuid())
  title             String
  description       String?
  type              EventType
  date              DateTime    @db.Date
  startTime         String?     @map("start_time")
  endTime           String?     @map("end_time")
  allDay            Boolean     @default(false) @map("all_day")
  location          String?
  color             String
  recurrence        Recurrence?
  recurrenceEnd     DateTime?   @map("recurrence_end") @db.Date
  reminderMinutes   Int?        @map("reminder_minutes")
  reminderSentDates Json        @default("[]") @map("reminder_sent_dates")
  createdBy         String      @map("created_by")
  creator           User        @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  createdAt         DateTime    @default(now()) @map("created_at")
  updatedAt         DateTime    @updatedAt @map("updated_at")

  @@map("events")
}
```

- [ ] **Step 2: Add birthday fields to Staff model**

Add to the existing `Staff` model, after the `phone` field:

```prisma
  birthMonth      Int?        @map("birth_month")
  birthDay        Int?        @map("birth_day")
```

- [ ] **Step 3: Add events relation to User model**

Add to the existing `User` model relations:

```prisma
  events         Event[]
```

- [ ] **Step 4: Run migration**

Run: `npx prisma migrate dev --name add-events-and-birthdays`

Expected: Migration applied successfully, `events` table created, `staff` table altered with `birth_month` and `birth_day` columns.

- [ ] **Step 5: Regenerate Prisma client**

Run: `npx prisma generate`

Expected: Client generated at `src/generated/prisma/client`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add Event model, EventType/Recurrence enums, Staff birthday fields"
```

---

### Task 2: Event Domain — Types

**Files:**
- Create: `src/domains/event/types.ts`

- [ ] **Step 1: Create event types**

```typescript
// src/domains/event/types.ts

export type EventType = "MEETING" | "SEMINAR" | "VENDOR" | "OTHER";
export type Recurrence = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  MEETING: "#3b82f6",
  SEMINAR: "#8b5cf6",
  VENDOR: "#14b8a6",
  OTHER: "#6b7280",
};

export const BIRTHDAY_COLOR = "#ec4899";
export const CATERING_COLOR = "#f97316";

export interface EventResponse {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  color: string;
  recurrence: Recurrence | null;
  recurrenceEnd: string | null;
  reminderMinutes: number | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  type: EventType;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  recurrence?: Recurrence;
  recurrenceEnd?: string;
  reminderMinutes?: number;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  type?: EventType;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  location?: string | null;
  recurrence?: Recurrence | null;
  recurrenceEnd?: string | null;
  reminderMinutes?: number | null;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  color: string;
  borderColor: string;
  textColor: string;
  source: "catering" | "manual" | "birthday";
  extendedProps: {
    type?: EventType;
    location?: string | null;
    headcount?: number | null;
    quoteId?: string | null;
    staffId?: string | null;
    eventId?: string | null;
    description?: string | null;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/event/types.ts
git commit -m "feat: add event domain types"
```

---

### Task 3: Event Domain — Repository

**Files:**
- Create: `src/domains/event/repository.ts`
- Create: `tests/domains/event/repository.test.ts`

- [ ] **Step 1: Write repository tests**

```typescript
// tests/domains/event/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import * as eventRepository from "@/domains/event/repository";

const mockPrisma = vi.mocked(prisma);

describe("eventRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an event with correct data", async () => {
    const input = {
      title: "Staff Meeting",
      type: "MEETING" as const,
      date: new Date("2026-03-30"),
      color: "#3b82f6",
      allDay: false,
      startTime: "09:00",
      endTime: "10:00",
      reminderMinutes: 60,
      createdBy: "user-1",
    };
    const expected = { id: "evt-1", ...input, description: null, location: null, recurrence: null, recurrenceEnd: null, reminderSentDates: [], createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.event.create.mockResolvedValue(expected as never);

    const result = await eventRepository.create(input);

    expect(mockPrisma.event.create).toHaveBeenCalledWith({ data: input });
    expect(result).toEqual(expected);
  });

  it("finds events within a date range", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);

    await eventRepository.findByDateRange(new Date("2026-03-01"), new Date("2026-03-31"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date("2026-03-01"),
          lte: new Date("2026-03-31"),
        },
      },
      orderBy: { date: "asc" },
    });
  });

  it("finds event by id", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const result = await eventRepository.findById("evt-1");

    expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({ where: { id: "evt-1" } });
    expect(result).toBeNull();
  });

  it("updates an event", async () => {
    const updated = { id: "evt-1", title: "Updated" };
    mockPrisma.event.update.mockResolvedValue(updated as never);

    await eventRepository.update("evt-1", { title: "Updated" });

    expect(mockPrisma.event.update).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: { title: "Updated" },
    });
  });

  it("deletes an event", async () => {
    mockPrisma.event.delete.mockResolvedValue({} as never);

    await eventRepository.remove("evt-1");

    expect(mockPrisma.event.delete).toHaveBeenCalledWith({ where: { id: "evt-1" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domains/event/repository.test.ts`

Expected: FAIL — module `@/domains/event/repository` not found.

- [ ] **Step 3: Implement repository**

```typescript
// src/domains/event/repository.ts
import { prisma } from "@/lib/prisma";

export async function create(data: {
  title: string;
  type: string;
  date: Date;
  color: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  location?: string | null;
  recurrence?: string | null;
  recurrenceEnd?: Date | null;
  reminderMinutes?: number | null;
  createdBy: string;
}) {
  return prisma.event.create({ data });
}

export async function findByDateRange(start: Date, end: Date) {
  return prisma.event.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });
}

export async function findById(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.event.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.event.delete({ where: { id } });
}

export async function findDueReminders(now: Date) {
  return prisma.event.findMany({
    where: {
      reminderMinutes: { not: null },
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domains/event/repository.test.ts`

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/event/repository.ts tests/domains/event/repository.test.ts
git commit -m "feat: add event repository with tests"
```

---

### Task 4: Event Domain — Service (with recurrence expansion)

**Files:**
- Create: `src/domains/event/service.ts`
- Create: `tests/domains/event/service.test.ts`

- [ ] **Step 1: Write service tests**

```typescript
// tests/domains/event/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/event/repository");
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import * as eventRepository from "@/domains/event/repository";
import { eventService } from "@/domains/event/service";

const mockRepo = vi.mocked(eventRepository);

describe("eventService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates event with auto-assigned color from type", async () => {
      const input = {
        title: "Staff Meeting",
        type: "MEETING" as const,
        date: "2026-03-30",
        startTime: "09:00",
        endTime: "10:00",
      };
      const dbEvent = {
        id: "evt-1",
        title: "Staff Meeting",
        description: null,
        type: "MEETING",
        date: new Date("2026-03-30"),
        startTime: "09:00",
        endTime: "10:00",
        allDay: false,
        location: null,
        color: "#3b82f6",
        recurrence: null,
        recurrenceEnd: null,
        reminderMinutes: 60,
        reminderSentDates: [],
        createdBy: "user-1",
        createdAt: new Date("2026-03-28"),
        updatedAt: new Date("2026-03-28"),
      };
      mockRepo.create.mockResolvedValue(dbEvent as never);

      const result = await eventService.create(input, "user-1");

      expect(mockRepo.create).toHaveBeenCalledWith({
        title: "Staff Meeting",
        type: "MEETING",
        date: new Date("2026-03-30"),
        startTime: "09:00",
        endTime: "10:00",
        allDay: false,
        color: "#3b82f6",
        description: null,
        location: null,
        recurrence: null,
        recurrenceEnd: null,
        reminderMinutes: 60,
        createdBy: "user-1",
      });
      expect(result.id).toBe("evt-1");
      expect(result.color).toBe("#3b82f6");
    });

    it("defaults reminderMinutes to 60 when not provided", async () => {
      const input = { title: "Test", type: "OTHER" as const, date: "2026-04-01" };
      mockRepo.create.mockResolvedValue({
        id: "evt-2", title: "Test", description: null, type: "OTHER",
        date: new Date("2026-04-01"), startTime: null, endTime: null,
        allDay: false, location: null, color: "#6b7280", recurrence: null,
        recurrenceEnd: null, reminderMinutes: 60, reminderSentDates: [],
        createdBy: "user-1", createdAt: new Date(), updatedAt: new Date(),
      } as never);

      await eventService.create(input, "user-1");

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reminderMinutes: 60 }),
      );
    });
  });

  describe("expandRecurring", () => {
    it("expands a weekly event within date range", () => {
      const baseEvent = {
        id: "evt-1",
        title: "Weekly Standup",
        description: null,
        type: "MEETING",
        date: new Date("2026-03-02"), // Monday
        startTime: "09:00",
        endTime: "09:30",
        allDay: false,
        location: null,
        color: "#3b82f6",
        recurrence: "WEEKLY",
        recurrenceEnd: null,
        reminderMinutes: 60,
        reminderSentDates: [],
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const start = new Date("2026-03-09");
      const end = new Date("2026-03-23");

      const occurrences = eventService.expandRecurring(baseEvent as never, start, end);

      expect(occurrences).toHaveLength(3); // Mar 9, 16, 23
      expect(occurrences[0].start).toContain("2026-03-09");
      expect(occurrences[1].start).toContain("2026-03-16");
      expect(occurrences[2].start).toContain("2026-03-23");
    });

    it("stops expansion at recurrenceEnd", () => {
      const baseEvent = {
        id: "evt-1",
        title: "Daily Huddle",
        description: null,
        type: "MEETING",
        date: new Date("2026-03-01"),
        startTime: "08:00",
        endTime: "08:15",
        allDay: false,
        location: null,
        color: "#3b82f6",
        recurrence: "DAILY",
        recurrenceEnd: new Date("2026-03-05"),
        reminderMinutes: null,
        reminderSentDates: [],
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-10");

      const occurrences = eventService.expandRecurring(baseEvent as never, start, end);

      expect(occurrences).toHaveLength(5); // Mar 1-5 only
    });

    it("returns non-recurring event as single occurrence", () => {
      const baseEvent = {
        id: "evt-1",
        title: "One-off",
        description: null,
        type: "OTHER",
        date: new Date("2026-03-15"),
        startTime: "14:00",
        endTime: "15:00",
        allDay: false,
        location: null,
        color: "#6b7280",
        recurrence: null,
        recurrenceEnd: null,
        reminderMinutes: null,
        reminderSentDates: [],
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-31");

      const occurrences = eventService.expandRecurring(baseEvent as never, start, end);

      expect(occurrences).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domains/event/service.test.ts`

Expected: FAIL — module `@/domains/event/service` not found.

- [ ] **Step 3: Implement service**

```typescript
// src/domains/event/service.ts
import * as eventRepository from "./repository";
import {
  EVENT_TYPE_COLORS,
  type EventResponse,
  type CreateEventInput,
  type UpdateEventInput,
  type EventType,
  type CalendarEventItem,
} from "./types";

function toResponse(e: {
  id: string;
  title: string;
  description: string | null;
  type: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  color: string;
  recurrence: string | null;
  recurrenceEnd: Date | null;
  reminderMinutes: number | null;
  createdBy: string;
  createdAt: Date;
}): EventResponse {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    type: e.type as EventType,
    date: e.date.toISOString().split("T")[0],
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: e.allDay,
    location: e.location,
    color: e.color,
    recurrence: e.recurrence as EventResponse["recurrence"],
    recurrenceEnd: e.recurrenceEnd?.toISOString().split("T")[0] ?? null,
    reminderMinutes: e.reminderMinutes,
    createdBy: e.createdBy,
    createdAt: e.createdAt.toISOString(),
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function nextOccurrence(date: Date, recurrence: string): Date {
  switch (recurrence) {
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addDays(date, 7);
    case "MONTHLY":
      return addMonths(date, 1);
    case "YEARLY":
      return addYears(date, 1);
    default:
      return date;
  }
}

function toCalendarItem(
  e: { id: string; title: string; description: string | null; type: string; startTime: string | null; endTime: string | null; allDay: boolean; location: string | null; color: string },
  dateStr: string,
): CalendarEventItem {
  const start = e.startTime && !e.allDay ? `${dateStr}T${e.startTime}:00` : dateStr;
  const end = e.endTime && !e.allDay ? `${dateStr}T${e.endTime}:00` : null;

  return {
    id: `${e.id}-${dateStr}`,
    title: e.title,
    start,
    end,
    allDay: e.allDay,
    color: `${e.color}26`,
    borderColor: e.color,
    textColor: e.color,
    source: "manual",
    extendedProps: {
      type: e.type as EventType,
      location: e.location,
      eventId: e.id,
      description: e.description,
    },
  };
}

export const eventService = {
  async create(input: CreateEventInput, userId: string): Promise<EventResponse> {
    const color = EVENT_TYPE_COLORS[input.type];
    const event = await eventRepository.create({
      title: input.title,
      type: input.type,
      date: new Date(input.date),
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      allDay: input.allDay ?? false,
      color,
      description: input.description ?? null,
      location: input.location ?? null,
      recurrence: input.recurrence ?? null,
      recurrenceEnd: input.recurrenceEnd ? new Date(input.recurrenceEnd) : null,
      reminderMinutes: input.reminderMinutes ?? 60,
      createdBy: userId,
    });
    return toResponse(event);
  },

  async getById(id: string): Promise<EventResponse | null> {
    const event = await eventRepository.findById(id);
    return event ? toResponse(event) : null;
  },

  async update(id: string, input: UpdateEventInput): Promise<EventResponse | null> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.type !== undefined) {
      data.type = input.type;
      data.color = EVENT_TYPE_COLORS[input.type];
    }
    if (input.date !== undefined) data.date = new Date(input.date);
    if (input.startTime !== undefined) data.startTime = input.startTime;
    if (input.endTime !== undefined) data.endTime = input.endTime;
    if (input.allDay !== undefined) data.allDay = input.allDay;
    if (input.location !== undefined) data.location = input.location;
    if (input.recurrence !== undefined) data.recurrence = input.recurrence;
    if (input.recurrenceEnd !== undefined) {
      data.recurrenceEnd = input.recurrenceEnd ? new Date(input.recurrenceEnd) : null;
    }
    if (input.reminderMinutes !== undefined) data.reminderMinutes = input.reminderMinutes;

    const event = await eventRepository.update(id, data);
    return toResponse(event);
  },

  async remove(id: string): Promise<void> {
    await eventRepository.remove(id);
  },

  async listForDateRange(start: Date, end: Date): Promise<CalendarEventItem[]> {
    const events = await eventRepository.findByDateRange(
      addDays(start, -365),
      end,
    );

    const items: CalendarEventItem[] = [];
    for (const event of events) {
      items.push(...this.expandRecurring(event, start, end));
    }
    return items;
  },

  expandRecurring(
    event: { id: string; title: string; description: string | null; type: string; date: Date; startTime: string | null; endTime: string | null; allDay: boolean; location: string | null; color: string; recurrence: string | null; recurrenceEnd: Date | null },
    rangeStart: Date,
    rangeEnd: Date,
  ): CalendarEventItem[] {
    if (!event.recurrence) {
      const dateStr = event.date.toISOString().split("T")[0];
      if (event.date >= rangeStart && event.date <= rangeEnd) {
        return [toCalendarItem(event, dateStr)];
      }
      return [];
    }

    const items: CalendarEventItem[] = [];
    let current = new Date(event.date);
    const effectiveEnd = event.recurrenceEnd && event.recurrenceEnd < rangeEnd
      ? event.recurrenceEnd
      : rangeEnd;

    while (current <= effectiveEnd) {
      if (current >= rangeStart) {
        const dateStr = current.toISOString().split("T")[0];
        items.push(toCalendarItem(event, dateStr));
      }
      current = nextOccurrence(current, event.recurrence);
    }

    return items;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domains/event/service.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/event/service.ts tests/domains/event/service.test.ts
git commit -m "feat: add event service with recurrence expansion"
```

---

### Task 5: Event Domain — Zod Validators

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add event schemas to validators**

Add to the end of `src/lib/validators.ts`:

```typescript
export const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["MEETING", "SEMINAR", "VENDOR", "OTHER"]),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  recurrenceEnd: z.string().optional(),
  reminderMinutes: z.number().int().optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat: add event Zod validation schema"
```

---

### Task 6: Event API Routes

**Files:**
- Create: `src/app/api/events/route.ts`
- Create: `src/app/api/events/[id]/route.ts`

- [ ] **Step 1: Create list/create route**

```typescript
// src/app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { eventService } from "@/domains/event/service";
import { eventSchema } from "@/lib/validators";

export const GET = withAuth(async (req: NextRequest, session) => {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params required" }, { status: 400 });
  }

  const events = await eventService.listForDateRange(
    new Date(start),
    new Date(end),
  );
  return NextResponse.json(events);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = eventSchema.parse(await req.json());
  const event = await eventService.create(body, session.user.id);
  return NextResponse.json(event, { status: 201 });
});
```

- [ ] **Step 2: Create single-event route**

```typescript
// src/app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { eventService } from "@/domains/event/service";
import { eventSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const event = await eventService.getById(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const PUT = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const body = eventSchema.parse(await req.json());
  const event = await eventService.update(id, body);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const PATCH = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const body = eventSchema.partial().parse(await req.json());
  const event = await eventService.update(id, body);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const DELETE = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  await eventService.remove(id);
  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/
git commit -m "feat: add event CRUD API routes"
```

---

### Task 7: Event Domain — API Client & Hooks

**Files:**
- Create: `src/domains/event/api-client.ts`
- Create: `src/domains/event/hooks.ts`

- [ ] **Step 1: Create API client**

```typescript
// src/domains/event/api-client.ts
import { ApiError } from "@/domains/shared/types";
import type { EventResponse, CreateEventInput, UpdateEventInput, CalendarEventItem } from "./types";

const BASE = "/api/events";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const eventApi = {
  async list(start: string, end: string): Promise<CalendarEventItem[]> {
    return request<CalendarEventItem[]>(
      `${BASE}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
  },

  async getById(id: string): Promise<EventResponse> {
    return request<EventResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateEventInput): Promise<EventResponse> {
    return request<EventResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateEventInput): Promise<EventResponse> {
    return request<EventResponse>(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async remove(id: string): Promise<void> {
    await request(`${BASE}/${id}`, { method: "DELETE" });
  },
};
```

- [ ] **Step 2: Create hooks**

```typescript
// src/domains/event/hooks.ts
"use client";

import { useState, useCallback } from "react";
import { eventApi } from "./api-client";
import type { EventResponse, CreateEventInput, UpdateEventInput } from "./types";

export function useCreateEvent() {
  const [loading, setLoading] = useState(false);

  const createEvent = useCallback(async (input: CreateEventInput): Promise<EventResponse> => {
    setLoading(true);
    try {
      return await eventApi.create(input);
    } finally {
      setLoading(false);
    }
  }, []);

  return { createEvent, loading };
}

export function useUpdateEvent() {
  const [loading, setLoading] = useState(false);

  const updateEvent = useCallback(async (id: string, input: UpdateEventInput): Promise<EventResponse> => {
    setLoading(true);
    try {
      return await eventApi.update(id, input);
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateEvent, loading };
}

export function useDeleteEvent() {
  const [loading, setLoading] = useState(false);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await eventApi.remove(id);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteEvent, loading };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/event/api-client.ts src/domains/event/hooks.ts
git commit -m "feat: add event API client and React hooks"
```

---

### Task 8: Merge Calendar Event Sources (Catering + Manual + Birthdays)

**Files:**
- Modify: `src/app/api/calendar/events/route.ts`

- [ ] **Step 1: Read the current calendar events route**

Read `src/app/api/calendar/events/route.ts` to understand the existing catering event query.

- [ ] **Step 2: Update route to merge all three sources**

Modify `src/app/api/calendar/events/route.ts` to import and merge manual events and birthdays alongside the existing catering events. The route should:

1. Keep existing catering event logic unchanged
2. Query `eventService.listForDateRange(start, end)` for manual events
3. Query staff with `birthMonth`/`birthDay` set and generate birthday items for the requested range
4. Return all three arrays concatenated

The birthday generation logic: for each staff with birthday fields, check if their birth month/day falls within the requested range, and create an all-day `CalendarEventItem` with `source: "birthday"`, pink color (`#ec4899`), title `"🎂 {name}'s Birthday"`, and `extendedProps.staffId`.

- [ ] **Step 3: Run build to verify**

Run: `npm run build`

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/events/route.ts
git commit -m "feat: merge manual events and birthdays into calendar API"
```

---

### Task 9: Calendar UI — Add Event Button, Legend, and Event Modal

**Files:**
- Create: `src/components/calendar/event-legend.tsx`
- Create: `src/components/calendar/add-event-modal.tsx`
- Modify: `src/app/calendar/page.tsx`

- [ ] **Step 1: Create event legend component**

```typescript
// src/components/calendar/event-legend.tsx
"use client";

const LEGEND_ITEMS = [
  { label: "Catering", color: "#f97316" },
  { label: "Meeting", color: "#3b82f6" },
  { label: "Seminar", color: "#8b5cf6" },
  { label: "Birthday", color: "#ec4899" },
  { label: "Vendor", color: "#14b8a6" },
  { label: "Other", color: "#6b7280" },
];

export function EventLegend() {
  return (
    <div className="flex flex-wrap gap-3 px-3 py-2 bg-muted/50 rounded-lg">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create add event modal**

Create `src/components/calendar/add-event-modal.tsx` — a Dialog component using the existing Dialog/Input/Label/Button from `@/components/ui/`. The form includes:
- Title (required Input)
- Type (pill selector buttons for MEETING, SEMINAR, VENDOR, OTHER — visually styled with the type's color when selected)
- Date (Input type="date")
- All Day toggle (checkbox)
- Start Time / End Time (Input type="time", hidden when allDay)
- Repeat (pill selector: none, DAILY, WEEKLY, MONTHLY, YEARLY)
- Recurrence End (Input type="date", shown only when repeat is set)
- Location (optional Input)
- Description (optional textarea)
- Reminder (pill selector: null=None, 15, 30, 60, 120, 1440 — default 60)
- Delete button (shown only when editing, with confirmation dialog)
- Cancel / Submit buttons

The component accepts props: `{ event?: EventResponse; onSave: () => void; trigger: React.ReactNode }` following the same pattern as `StaffForm`.

Use `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent` hooks from `@/domains/event/hooks`.

- [ ] **Step 3: Update calendar page**

Modify `src/app/calendar/page.tsx` to:
1. Import `EventLegend`, `AddEventModal`, `eventApi`
2. Add the "Add Event" button (purple, with + icon) next to the page title
3. Add the `EventLegend` component below the title
4. Update `fetchEvents` to call both `calendarApi.getEvents()` (catering) and the events now merged into the same endpoint — the API already returns merged data, so just update the color mapping to use the event's own colors instead of hardcoded orange
5. Add `eventClick` handler: for catering events navigate to quote, for manual events open the edit modal, for birthday events navigate to staff profile
6. Add state for selected event and edit modal open/closed

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/ src/app/calendar/page.tsx
git commit -m "feat: add event legend, creation modal, and enhanced calendar page"
```

---

### Task 10: Staff Birthday Fields — Form & Onboarding

**Files:**
- Modify: `src/components/staff/staff-form.tsx`
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add birthday fields to staff validator**

In `src/lib/validators.ts`, add to the `staffSchema`:

```typescript
  birthMonth: z.number().int().min(1).max(12).optional(),
  birthDay: z.number().int().min(1).max(31).optional(),
```

- [ ] **Step 2: Add birthday fields to staff form**

In `src/components/staff/staff-form.tsx`, add two new form fields after the Phone field:
- **Birth Month**: A `<select>` dropdown with options January (1) through December (12), with an empty default "Select month..."
- **Birth Day**: A number `<Input>` with min=1, max=31

Add state: `const [birthMonth, setBirthMonth] = useState<number | undefined>(staff?.birthMonth ?? undefined)` and same for `birthDay`.

Include both in the `payload` object sent to `staffApi.create()` / `staffApi.update()`.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/staff/staff-form.tsx src/lib/validators.ts
git commit -m "feat: add birthday month/day fields to staff form"
```

---

### Task 11: Update Today's Events Dashboard Card

**Files:**
- Modify: `src/components/dashboard/todays-events.tsx`

- [ ] **Step 1: Update to show all event types**

Modify `src/components/dashboard/todays-events.tsx` to:
1. The API now returns merged events (catering + manual + birthday) with a `source` field and individual colors
2. Update the event card rendering to use each event's `borderColor`/`color` instead of hardcoded orange
3. For catering events: keep the 🍽 emoji, link to quote
4. For manual events: use type-appropriate emoji (📅 meeting, 🎓 seminar, 🚚 vendor, 📌 other), link to calendar
5. For birthday events: use 🎂 emoji, link to calendar
6. Show setup/takedown times only for catering events

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/todays-events.tsx
git commit -m "feat: update Today's Events card to show all event types"
```

---

### Task 12: Event Reminders via Notification System

**Files:**
- Create: `src/domains/event/reminders.ts`
- Modify: `src/app/api/calendar/events/route.ts`

- [ ] **Step 1: Create reminder checking logic**

```typescript
// src/domains/event/reminders.ts
import * as eventRepository from "./repository";
import { notificationService } from "@/domains/notification/service";
import { prisma } from "@/lib/prisma";

export async function checkAndSendReminders(): Promise<void> {
  const now = new Date();
  const events = await eventRepository.findDueReminders(now);

  for (const event of events) {
    if (event.reminderMinutes === null) continue;

    const sentDates: string[] = Array.isArray(event.reminderSentDates)
      ? (event.reminderSentDates as string[])
      : [];

    const eventDate = new Date(event.date);
    const dateStr = eventDate.toISOString().split("T")[0];

    if (sentDates.includes(dateStr)) continue;

    const reminderTime = new Date(eventDate);
    if (event.startTime) {
      const [hours, minutes] = event.startTime.split(":").map(Number);
      reminderTime.setHours(hours, minutes, 0, 0);
    }
    reminderTime.setMinutes(reminderTime.getMinutes() - event.reminderMinutes);

    if (now < reminderTime) continue;

    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true },
    });

    for (const user of users) {
      await notificationService.createAndPublish({
        userId: user.id,
        type: "QUOTE_VIEWED" as never,
        title: `Reminder: ${event.title}`,
        message: event.startTime
          ? `Starting at ${event.startTime}${event.location ? ` — ${event.location}` : ""}`
          : `Today${event.location ? ` — ${event.location}` : ""}`,
      });
    }

    await eventRepository.update(event.id, {
      reminderSentDates: [...sentDates, dateStr],
    });
  }
}
```

- [ ] **Step 2: Call reminder check from calendar events route**

Trigger reminder checks from a scheduled or background mechanism (e.g., a cron-based API route or a `setInterval` in the SSE stream) rather than piggybacking on the calendar GET endpoint. This avoids latency spikes and duplicate sends under concurrent requests. Use an idempotency check (`reminderSentDates` array) to prevent duplicate notifications.

```typescript
import { checkAndSendReminders } from "@/domains/event/reminders";

// Called from a scheduled trigger, NOT from the read endpoint
await checkAndSendReminders();
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/event/reminders.ts src/app/api/calendar/events/route.ts
git commit -m "feat: add event reminder system via notifications"
```

---

### Task 13: Phase 1 Integration Test

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --dir tests`

Expected: All existing tests pass plus new event tests.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No lint errors.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit any fixes if needed**

---

## Phase 2: AI Assistant (Chat Domain)

### Task 14: Install Vercel AI SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

Run: `npm install ai @ai-sdk/react @ai-sdk/anthropic`

Expected: Three packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install Vercel AI SDK packages"
```

---

### Task 15: Chat Domain — Types & System Prompt

**Files:**
- Create: `src/domains/chat/types.ts`
- Create: `src/domains/chat/system-prompt.ts`

- [ ] **Step 1: Create chat types**

```typescript
// src/domains/chat/types.ts

export interface ChatUser {
  id: string;
  name: string;
  role: string;
}
```

- [ ] **Step 2: Create system prompt**

```typescript
// src/domains/chat/system-prompt.ts
import type { ChatUser } from "./types";

export function buildSystemPrompt(user: ChatUser): string {
  return `You are the LAPC Assistant, a helpful AI assistant for the Los Angeles Pierce College Invoice Maker portal.

## About You
- You help staff with invoices, quotes, calendar events, staff lookups, and general portal questions.
- You are professional, concise, and friendly.
- You address the user by their first name.

## Current User
- Name: ${user.name}
- Role: ${user.role}
- User ID: ${user.id}

## Capabilities
You have tools to:
- List, view, create, and update invoices (user can only modify their own, unless admin)
- List, view, create, and update quotes (user can only modify their own, unless admin)
- Search and look up staff members
- List, create, update, and delete calendar events (communal — anyone can edit)
- View analytics and stats
- Navigate the user to specific pages

## Safeguards
- NEVER delete an invoice, quote, or any record without asking the user to confirm first.
- For invoices and quotes: only allow modifications if createdBy matches the current user ID (${user.id}), UNLESS the user's role is "admin".
- Calendar events are communal — any user can create, edit, or delete them.
- If the user asks you to do something you cannot do, explain what you can help with instead.

## Portal Knowledge
- Tax rate: 9.75% (configurable per invoice)
- Invoice statuses: DRAFT, FINALIZED, SENT
- Quote statuses: DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED
- Staff have: name, title, department, account code, extension, email, phone, approval chain
- The calendar shows catering events (from quotes), manual events, and staff birthdays
- PDF generation: cover sheets (portrait) and IDPs (landscape) are generated from HTML templates

## Response Format
- Keep responses concise — 1-3 sentences for simple answers
- When showing data (invoices, quotes, events), format as a brief list with key details
- Include relevant links: "[View Invoice #1234](/invoices/id-here)"
- Use markdown formatting for readability
`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/chat/types.ts src/domains/chat/system-prompt.ts
git commit -m "feat: add chat domain types and system prompt"
```

---

### Task 16: Chat Domain — Tool Definitions

**Files:**
- Create: `src/domains/chat/tools.ts`

- [ ] **Step 1: Create tool definitions**

```typescript
// src/domains/chat/tools.ts
import { z } from "zod";
import { tool } from "ai";
import { invoiceService } from "@/domains/invoice/service";
import { staffService } from "@/domains/staff/service";
import { eventService } from "@/domains/event/service";
import type { ChatUser } from "./types";

export function buildTools(user: ChatUser) {
  return {
    listInvoices: tool({
      description: "List invoices. Optionally filter by status or search term.",
      parameters: z.object({
        status: z.enum(["DRAFT", "FINALIZED", "SENT"]).optional(),
        search: z.string().optional(),
        limit: z.number().int().default(10),
      }),
      execute: async ({ status, search, limit }) => {
        const result = await invoiceService.list({
          status,
          search,
          page: 1,
          pageSize: limit,
          type: "INVOICE",
        });
        return result;
      },
    }),

    listQuotes: tool({
      description: "List quotes. Optionally filter by status.",
      parameters: z.object({
        status: z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
        search: z.string().optional(),
        limit: z.number().int().default(10),
      }),
      execute: async ({ status, search, limit }) => {
        const result = await invoiceService.list({
          quoteStatus: status,
          search,
          page: 1,
          pageSize: limit,
          type: "QUOTE",
        });
        return result;
      },
    }),

    getInvoice: tool({
      description: "Get a single invoice by ID",
      parameters: z.object({
        id: z.string(),
      }),
      execute: async ({ id }) => {
        return invoiceService.getById(id);
      },
    }),

    searchStaff: tool({
      description: "Search for staff members by name, department, or title",
      parameters: z.object({
        search: z.string(),
      }),
      execute: async ({ search }) => {
        return staffService.list({ search });
      },
    }),

    listCalendarEvents: tool({
      description: "List calendar events for a date range",
      parameters: z.object({
        start: z.string().describe("Start date in YYYY-MM-DD format"),
        end: z.string().describe("End date in YYYY-MM-DD format"),
      }),
      execute: async ({ start, end }) => {
        return eventService.listForDateRange(new Date(start), new Date(end));
      },
    }),

    createCalendarEvent: tool({
      description: "Create a new calendar event",
      parameters: z.object({
        title: z.string(),
        type: z.enum(["MEETING", "SEMINAR", "VENDOR", "OTHER"]),
        date: z.string().describe("Date in YYYY-MM-DD format"),
        startTime: z.string().optional().describe("Start time in HH:mm format"),
        endTime: z.string().optional().describe("End time in HH:mm format"),
        allDay: z.boolean().default(false),
        location: z.string().optional(),
        description: z.string().optional(),
        recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
        reminderMinutes: z.number().int().optional(),
      }),
      execute: async (input) => {
        return eventService.create(input, user.id);
      },
    }),

    getAnalytics: tool({
      description: "Get dashboard analytics and statistics",
      parameters: z.object({
        period: z.enum(["week", "month", "quarter", "year"]).default("month"),
      }),
      execute: async ({ period }) => {
        const analyticsService = await import("@/domains/analytics/service").then(m => m.analyticsService);
        return analyticsService.getDashboardStats();
      },
    }),

    navigate: tool({
      description: "Navigate the user to a specific page in the portal. Returns the URL path for the client to handle.",
      parameters: z.object({
        path: z.string().describe("URL path like /invoices, /quotes, /calendar, /analytics, /staff, /admin/settings"),
      }),
      execute: async ({ path }) => {
        return { action: "navigate", path };
      },
    }),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/chat/tools.ts
git commit -m "feat: add chat tool definitions for AI assistant"
```

---

### Task 17: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create streaming chat route**

```typescript
// src/app/api/chat/route.ts
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildSystemPrompt } from "@/domains/chat/system-prompt";
import { buildTools } from "@/domains/chat/tools";
import type { ChatUser } from "@/domains/chat/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user: ChatUser = {
    id: (session.user as { id: string }).id,
    name: session.user.name ?? "User",
    role: (session.user as { role: string }).role,
  };

  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildSystemPrompt(user),
    messages,
    tools: buildTools(user),
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 2: Add ANTHROPIC_API_KEY to local env (untracked) and CI secrets**

Add to `.env.local` (ensure this file is in `.gitignore` — never commit secrets):

```bash
ANTHROPIC_API_KEY=your-key-here
```

For production, add `ANTHROPIC_API_KEY` as a GitHub Actions secret and to the VPS `.env` file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: add streaming chat API route with Claude Haiku"
```

---

### Task 18: Chat Sidebar UI Components

**Files:**
- Create: `src/components/chat/chat-message.tsx`
- Create: `src/components/chat/chat-input.tsx`
- Create: `src/components/chat/chat-sidebar.tsx`

- [ ] **Step 1: Create message component**

```typescript
// src/components/chat/chat-message.tsx
"use client";

import type { Message } from "ai";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-violet-600 text-white rounded-tr-none"
            : "bg-muted rounded-tl-none"
        }`}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
          {message.content}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create input component**

```typescript
// src/components/chat/chat-input.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isLoading) return;
      onSend(trimmed);
      setValue("");
    },
    [value, isLoading, onSend],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask anything..."
        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create sidebar component**

```typescript
// src/components/chat/chat-sidebar.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquare, ChevronsRight, ChevronsLeft } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

const STORAGE_KEY = "lapc-chat-open";

const QUICK_ACTIONS = [
  "Show pending invoices",
  "Today's events",
  "Create a quote",
];

export function ChatSidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open));
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle navigation tool results
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.toolInvocations) {
      for (const invocation of lastMessage.toolInvocations) {
        if (
          invocation.toolName === "navigate" &&
          invocation.state === "result" &&
          invocation.result?.action === "navigate"
        ) {
          router.push(invocation.result.path);
        }
      }
    }
  }, [messages, router]);

  const handleSend = useCallback(
    (text: string) => {
      append({ role: "user", content: text });
    },
    [append],
  );

  if (!session) return null;

  const firstName = session.user?.name?.split(" ")[0] ?? "there";

  if (!open) {
    return (
      <div className="w-9 flex-shrink-0 bg-muted/30 border-l flex flex-col items-center pt-3 gap-2">
        <button
          onClick={() => setOpen(true)}
          className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center hover:scale-110 transition-transform"
          title="Open Assistant"
        >
          <MessageSquare className="w-3.5 h-3.5 text-white" />
        </button>
        <span className="text-[9px] text-muted-foreground tracking-widest" style={{ writingMode: "vertical-rl" }}>
          ASSISTANT
        </span>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0 border-l bg-muted/20 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
          <MessageSquare className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">LAPC Assistant</div>
          <div className="text-[10px] text-emerald-500">● Online</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Minimize"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center mt-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="bg-muted rounded-xl rounded-tl-none px-3 py-2 text-sm">
                Hi {firstName}! I can help with invoices, quotes, staff, calendar events, or answer questions about the portal. What can I do for you?
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-8">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSend(action)}
                  className="text-xs border border-violet-500/30 bg-violet-500/10 text-violet-400 rounded-full px-2.5 py-1 hover:bg-violet-500/20 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="bg-muted rounded-xl rounded-tl-none px-3 py-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/
git commit -m "feat: add chat sidebar UI components"
```

---

### Task 19: Integrate Chat Sidebar into Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add ChatSidebar to layout**

In `src/app/layout.tsx`, modify the layout to include the chat sidebar next to the main content. The sidebar should be inside the `AuthSessionProvider` so it has access to the session, and outside the `<main>` tag so it sits beside the content.

Change the body content structure from:

```tsx
<Nav />
<main id="main-content" className="mx-auto max-w-7xl px-4 py-6">{children}</main>
```

To:

```tsx
<Nav />
<div className="flex min-h-[calc(100vh-3.5rem)]">
  <main id="main-content" className="flex-1 mx-auto max-w-7xl px-4 py-6">{children}</main>
  <ChatSidebar />
</div>
```

Add the import:
```typescript
import { ChatSidebar } from "@/components/chat/chat-sidebar";
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: integrate chat sidebar into app layout"
```

---

### Task 20: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --dir tests`

Expected: All tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No lint errors.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev`

Verify:
1. Chat sidebar appears on right side, open by default
2. Minimize/restore works, state persists across page navigation
3. Quick action chips work
4. Chat responses stream in
5. Calendar shows "Add Event" button and legend
6. Creating an event via the modal works
7. Events show with correct colors
8. Staff form shows birthday fields
9. Today's Events card shows all event types

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from smoke testing"
```
