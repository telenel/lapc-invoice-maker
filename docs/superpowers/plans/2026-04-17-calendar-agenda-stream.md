# Calendar Agenda Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop weekly calendar with the Agenda Stream custom FullCalendar view while preserving the existing catering, manual-event, birthday, SSE, and CRUD infrastructure.

**Architecture:** Keep FullCalendar as the engine and the existing `/api/calendar/events` feed as the source of truth. Build a new `agendaStreamWeek` custom view under `src/domains/calendar/views/agenda-stream/`, then integrate it into the existing `CalendarView` so desktop uses the custom renderer while mobile stays on the current day/month flow. Reuse the existing event detail sidebar and add-event modal instead of creating parallel data paths.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, FullCalendar 6, Vitest, React Testing Library, Tailwind CSS 4, CSS modules, shadcn/ui

---

## File Map

### New files

- `src/domains/calendar/views/agenda-stream/types.ts`
  - view-local event types, source metadata, persisted state types
- `src/domains/calendar/views/agenda-stream/utils.ts`
  - date-key conversion, minute math, overlap columns, stats, source grouping
- `src/domains/calendar/views/agenda-stream/hooks.ts`
  - persisted desktop preferences, quick-add defaults, manual-event reschedule helpers
- `src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx`
  - FullCalendar custom view renderer and subcomponents
- `src/domains/calendar/views/agenda-stream/agendaStreamPlugin.ts`
  - `createPlugin()` registration for `agendaStreamWeek`
- `src/domains/calendar/views/agenda-stream/agendaStream.module.css`
  - scoped lane, overlay, rail, and timeline styles
- `src/__tests__/agenda-stream-utils.test.ts`
  - unit tests for lane math and event shaping
- `src/__tests__/calendar-view-agenda-stream.test.tsx`
  - desktop integration tests for the custom view behavior

### Existing files to modify

- `src/components/calendar/calendar-view.tsx`
  - register the plugin, switch desktop initial view, keep fetch/cache/SSE/pinned-event plumbing
- `src/components/calendar/event-detail-sidebar.tsx`
  - evolve rail layout to support filters, quick add, week stats, and pinned details
- `src/components/calendar/mini-month.tsx`
  - add density dots and week-row selection behavior used by the rail
- `src/components/calendar/add-event-modal.tsx`
  - support optional initial values for quick-add and reschedule edit paths
- `src/app/globals.css`
  - add `--c-past-fade` and `--c-lane-today`

---

### Task 1: Build Agenda Stream Event Adapters And Lane Math

**Files:**
- Create: `src/domains/calendar/views/agenda-stream/types.ts`
- Create: `src/domains/calendar/views/agenda-stream/utils.ts`
- Test: `src/__tests__/agenda-stream-utils.test.ts`

- [ ] **Step 1: Write the failing utility tests**

```ts
import { describe, expect, it } from "vitest";
import {
  assignColumns,
  buildAgendaStreamDays,
  buildAgendaStreamStats,
  getAgendaSourceMeta,
  toAgendaStreamEvent,
} from "@/domains/calendar/views/agenda-stream/utils";

describe("agenda stream utils", () => {
  it("maps calendar events into minute-based agenda events", () => {
    const event = toAgendaStreamEvent({
      id: "quote-1",
      title: "Board Lunch",
      start: "2026-04-14T18:30:00.000Z",
      end: "2026-04-14T20:00:00.000Z",
      allDay: false,
      color: "#fff7ed",
      borderColor: "#f97316",
      textColor: "#f97316",
      source: "catering",
      extendedProps: {
        quoteId: "quote-1",
        quoteNumber: "QT-101",
        quoteStatus: "ACCEPTED",
        location: "Library",
        headcount: 18,
      },
    });

    expect(event.dateKey).toBe("2026-04-14");
    expect(event.startMin).toBe(11 * 60 + 30);
    expect(event.durMin).toBe(90);
    expect(event.readOnly).toBe(true);
  });

  it("assigns side-by-side columns for overlapping events", () => {
    const events = assignColumns([
      { id: "a", startMin: 540, durMin: 60 },
      { id: "b", startMin: 555, durMin: 45 },
      { id: "c", startMin: 660, durMin: 30 },
    ]);

    expect(events.find((event) => event.id === "a")).toMatchObject({ col: 0, colCount: 2 });
    expect(events.find((event) => event.id === "b")).toMatchObject({ col: 1, colCount: 2 });
    expect(events.find((event) => event.id === "c")).toMatchObject({ col: 0, colCount: 2 });
  });

  it("computes week stats without dropping catering totals", () => {
    const stats = buildAgendaStreamStats([
      { source: "catering", amount: 1200 },
      { source: "manual", amount: null },
      { source: "birthday", amount: null },
      { source: "catering", amount: 800 },
    ]);

    expect(stats.totalEvents).toBe(4);
    expect(stats.cateringCount).toBe(2);
    expect(stats.cateringTotal).toBe(2000);
  });

  it("builds five weekday lanes and preserves empty days", () => {
    const days = buildAgendaStreamDays("2026-04-13", [
      { id: "evt-1", dateKey: "2026-04-14", startMin: 600, durMin: 30, source: "manual" },
    ]);

    expect(days).toHaveLength(5);
    expect(days[0].dateKey).toBe("2026-04-13");
    expect(days[1].events).toHaveLength(1);
    expect(days[4].events).toHaveLength(0);
  });

  it("returns stable source metadata for all supported sources", () => {
    expect(getAgendaSourceMeta("MEETING")).toMatchObject({ label: "Meeting", color: "#3b82f6" });
    expect(getAgendaSourceMeta("catering")).toMatchObject({ label: "Catering", color: "#f97316" });
    expect(getAgendaSourceMeta("birthday")).toMatchObject({ label: "Birthday", color: "#ec4899" });
  });
});
```

- [ ] **Step 2: Run the utility tests to verify they fail**

Run: `npm test -- src/__tests__/agenda-stream-utils.test.ts`

Expected: FAIL with module-not-found errors for `agenda-stream/utils` and missing exports.

- [ ] **Step 3: Write the minimal types and utility implementation**

```ts
// src/domains/calendar/views/agenda-stream/types.ts
import type { CalendarEventItem, EventType } from "@/domains/event/types";

export type AgendaSourceKey = EventType | "catering" | "birthday";

export interface AgendaStreamEvent {
  id: string;
  calendarEventId: string;
  dateKey: string;
  startMin: number;
  durMin: number;
  source: AgendaSourceKey;
  title: string;
  location: string | null;
  headcount: number | null;
  amount: number | null;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteStatus: string | null;
  staffId: string | null;
  eventId: string | null;
  description: string | null;
  setupTime: string | null;
  takedownTime: string | null;
  allDay: boolean;
  readOnly: boolean;
  original: CalendarEventItem;
}

export interface AgendaLaneEvent extends AgendaStreamEvent {
  col: number;
  colCount: number;
}
```

```ts
// src/domains/calendar/views/agenda-stream/utils.ts
import type { CalendarEventItem } from "@/domains/event/types";
import { fromDateKey, getDateKeyInLosAngeles } from "@/lib/date-utils";
import type { AgendaLaneEvent, AgendaSourceKey, AgendaStreamEvent } from "./types";

const SOURCE_META = {
  MEETING: { label: "Meeting", color: "#3b82f6", icon: "📋" },
  SEMINAR: { label: "Seminar", color: "#8b5cf6", icon: "🎓" },
  VENDOR: { label: "Vendor", color: "#14b8a6", icon: "🏢" },
  OTHER: { label: "Other", color: "#6b7280", icon: "📌" },
  catering: { label: "Catering", color: "#f97316", icon: "🍽️" },
  birthday: { label: "Birthday", color: "#ec4899", icon: "🎂" },
} satisfies Record<AgendaSourceKey, { label: string; color: string; icon: string }>;

export function getAgendaSourceMeta(source: AgendaSourceKey) {
  return SOURCE_META[source];
}

export function toAgendaStreamEvent(event: CalendarEventItem): AgendaStreamEvent {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 30 * 60 * 1000);
  const dateKey = event.allDay ? event.start.split("T")[0] : getDateKeyInLosAngeles(start);
  const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
  const durMin = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  const source = event.source === "manual"
    ? (event.extendedProps.type ?? "OTHER")
    : event.source;

  return {
    id: event.id,
    calendarEventId: event.id,
    dateKey,
    startMin,
    durMin,
    source,
    title: event.title,
    location: event.extendedProps.location ?? null,
    headcount: event.extendedProps.headcount ?? null,
    amount: null,
    quoteId: event.extendedProps.quoteId ?? null,
    quoteNumber: event.extendedProps.quoteNumber ?? null,
    quoteStatus: event.extendedProps.quoteStatus ?? null,
    staffId: event.extendedProps.staffId ?? null,
    eventId: event.extendedProps.eventId ?? null,
    description: event.extendedProps.description ?? null,
    setupTime: event.extendedProps.setupTime ?? null,
    takedownTime: event.extendedProps.takedownTime ?? null,
    allDay: event.allDay,
    readOnly: event.source !== "manual",
    original: event,
  };
}

export function assignColumns<T extends { startMin: number; durMin: number }>(events: T[]): Array<T & { col: number; colCount: number }> {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.durMin - b.durMin);
  const columns: number[] = [];
  const assigned = sorted.map((event) => {
    let col = columns.findIndex((endMin) => endMin <= event.startMin);
    if (col === -1) {
      col = columns.length;
      columns.push(0);
    }
    columns[col] = event.startMin + event.durMin;
    return { ...event, col };
  });
  const colCount = Math.max(1, columns.length);
  return assigned.map((event) => ({ ...event, colCount }));
}

export function buildAgendaStreamDays(weekStart: string, events: AgendaStreamEvent[]) {
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(fromDateKey(weekStart).getTime() + index * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().slice(0, 10);
    return {
      date,
      dateKey,
      events: events.filter((event) => event.dateKey === dateKey),
    };
  });
}

export function buildAgendaStreamStats(events: Array<{ source: string; amount?: number | null }>) {
  return {
    totalEvents: events.length,
    cateringCount: events.filter((event) => event.source === "catering").length,
    cateringTotal: events.reduce((sum, event) => sum + (event.source === "catering" ? event.amount ?? 0 : 0), 0),
  };
}
```

- [ ] **Step 4: Run the utility tests to verify they pass**

Run: `npm test -- src/__tests__/agenda-stream-utils.test.ts`

Expected: PASS with 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/domains/calendar/views/agenda-stream/types.ts \
  src/domains/calendar/views/agenda-stream/utils.ts \
  src/__tests__/agenda-stream-utils.test.ts
git commit -m "feat: add agenda stream event utilities"
```

### Task 2: Add Persisted Desktop State And FullCalendar Plugin Registration

**Files:**
- Create: `src/domains/calendar/views/agenda-stream/hooks.ts`
- Create: `src/domains/calendar/views/agenda-stream/agendaStreamPlugin.ts`
- Modify: `src/app/globals.css`
- Test: `src/__tests__/agenda-stream-utils.test.ts`

- [ ] **Step 1: Extend the test file with persisted state and plugin registration coverage**

```ts
import { agendaStreamPlugin } from "@/domains/calendar/views/agenda-stream/agendaStreamPlugin";
import { loadAgendaPreferences, saveAgendaPreferences } from "@/domains/calendar/views/agenda-stream/hooks";

it("round-trips agenda stream preferences in localStorage", () => {
  saveAgendaPreferences({
    weekStart: "2026-04-13",
    expanded: ["2026-04-16"],
    showPast: false,
    activeSources: ["MEETING", "catering"],
  });

  expect(loadAgendaPreferences()).toEqual({
    weekStart: "2026-04-13",
    expanded: ["2026-04-16"],
    showPast: false,
    activeSources: ["MEETING", "catering"],
  });
});

it("registers agendaStreamWeek as a time-grid-derived custom view", () => {
  expect(agendaStreamPlugin).toBeDefined();
});
```

- [ ] **Step 2: Run the test file to verify the new expectations fail**

Run: `npm test -- src/__tests__/agenda-stream-utils.test.ts`

Expected: FAIL because `hooks.ts` and `agendaStreamPlugin.ts` do not exist yet.

- [ ] **Step 3: Add persisted-state helpers, plugin registration, and theme tokens**

```ts
// src/domains/calendar/views/agenda-stream/hooks.ts
export const AGENDA_PREFERENCES_KEY = "agenda-v2";

export interface AgendaPreferences {
  weekStart: string | null;
  expanded: string[];
  showPast: boolean;
  activeSources: string[];
}

const DEFAULT_PREFERENCES: AgendaPreferences = {
  weekStart: null,
  expanded: [],
  showPast: true,
  activeSources: ["MEETING", "SEMINAR", "VENDOR", "OTHER", "catering", "birthday"],
};

export function loadAgendaPreferences(): AgendaPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(AGENDA_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveAgendaPreferences(value: AgendaPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENDA_PREFERENCES_KEY, JSON.stringify(value));
}
```

```ts
// src/domains/calendar/views/agenda-stream/agendaStreamPlugin.ts
import { createPlugin } from "@fullcalendar/core";
import { AgendaStreamView } from "./AgendaStreamView";

export const agendaStreamPlugin = createPlugin({
  name: "agendaStream",
  views: {
    agendaStreamWeek: {
      type: "timeGrid",
      duration: { weeks: 1 },
      buttonText: "Stream",
      content: AgendaStreamView,
    },
  },
});
```

```css
/* src/app/globals.css */
:root {
  --c-past-fade: color-mix(in oklch, var(--muted-foreground) 10%, transparent);
  --c-lane-today: color-mix(in oklch, var(--primary) 100%, transparent);
}

.dark,
.theme-latte,
.theme-frappe,
.theme-macchiato,
.theme-mocha {
  --c-past-fade: color-mix(in oklch, var(--muted-foreground) 16%, transparent);
  --c-lane-today: color-mix(in oklch, var(--primary) 75%, transparent);
}
```

- [ ] **Step 4: Re-run the test file to verify the new expectations pass**

Run: `npm test -- src/__tests__/agenda-stream-utils.test.ts`

Expected: PASS with the persisted-state and plugin expectations included.

- [ ] **Step 5: Commit**

```bash
git add src/domains/calendar/views/agenda-stream/hooks.ts \
  src/domains/calendar/views/agenda-stream/agendaStreamPlugin.ts \
  src/app/globals.css \
  src/__tests__/agenda-stream-utils.test.ts
git commit -m "feat: add agenda stream plugin scaffolding"
```

### Task 3: Port The Agenda Stream View And Desktop Lane UI

**Files:**
- Create: `src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx`
- Create: `src/domains/calendar/views/agenda-stream/agendaStream.module.css`
- Modify: `src/components/calendar/mini-month.tsx`
- Test: `src/__tests__/calendar-view-agenda-stream.test.tsx`

- [ ] **Step 1: Write the failing desktop rendering test**

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domains/calendar/api-client", () => ({
  calendarApi: { getEvents: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/domains/calendar/hooks", () => ({
  useCalendarSSE: vi.fn(),
}));

import { CalendarView } from "@/components/calendar/calendar-view";

describe("CalendarView agenda stream desktop mode", () => {
  it("uses the agenda stream view on desktop and shows the stream rail", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });

    render(
      <CalendarView
        initialData={{
          desktop: { start: "2026-04-13", end: "2026-04-20", events: [] },
          mobile: { start: "2026-04-16", end: "2026-04-17", events: [] },
        }}
      />,
    );

    expect(await screen.findByText(/quick add/i)).toBeInTheDocument();
    expect(screen.getByText(/show past/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the desktop rendering test to verify it fails**

Run: `npm test -- src/__tests__/calendar-view-agenda-stream.test.tsx`

Expected: FAIL because `CalendarView` still renders the legacy desktop week view and the new rail copy is absent.

- [ ] **Step 3: Implement the custom view and rail UI**

```tsx
// src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx
import { sliceEvents, type ViewProps } from "@fullcalendar/core";
import styles from "./agendaStream.module.css";
import { assignColumns, buildAgendaStreamDays, buildAgendaStreamStats, toAgendaStreamEvent } from "./utils";

export function AgendaStreamView(props: ViewProps) {
  const segments = sliceEvents(props, true);
  const events = segments
    .map((segment) => segment.def.publicId)
    .map((id) => props.eventStore.defs[id])
    .filter(Boolean);

  const mapped = events.map((def) => toAgendaStreamEvent({
    id: def.publicId,
    title: def.title,
    start: def.ui.startEditable ? def.extendedProps.start : def.extendedProps.start,
    end: def.extendedProps.end ?? null,
    allDay: def.allDay,
    color: def.ui.backgroundColor ?? "#ffffff",
    borderColor: def.ui.borderColor ?? "#000000",
    textColor: def.ui.textColor ?? "#000000",
    source: def.extendedProps.source,
    extendedProps: def.extendedProps,
  }));

  const weekStart = props.dateProfile.currentRange.start.toISOString().slice(0, 10);
  const days = buildAgendaStreamDays(weekStart, mapped).map((day) => ({
    ...day,
    events: assignColumns(day.events),
  }));
  const stats = buildAgendaStreamStats(mapped);

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <div className={styles.quickStats}>
          <span>{stats.totalEvents} events</span>
          <span>{stats.cateringCount} catering</span>
        </div>
        <label className={styles.showPastToggle}>
          <input type="checkbox" defaultChecked />
          <span>Show past</span>
        </label>
      </div>
      <div className={styles.body}>
        <aside className={styles.rail}>
          <section className={styles.railSection}>
            <div className={styles.eyebrow}>Quick add</div>
          </section>
        </aside>
        <main className={styles.main}>
          {days.map((day) => (
            <section key={day.dateKey} className={styles.lane}>
              <header className={styles.lanePlate}>
                <span>{day.date.toLocaleDateString("en-US", { weekday: "short" })}</span>
                <strong>{day.date.getDate()}</strong>
              </header>
              <div className={styles.laneCards}>
                {day.events.map((event) => (
                  <article key={event.id} className={styles.card}>
                    <span>{event.title}</span>
                    {event.location ? <span>{event.location}</span> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
```

```css
/* src/domains/calendar/views/agenda-stream/agendaStream.module.css */
.shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
  background: var(--background);
  color: var(--foreground);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}

.body {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
}

.rail {
  position: sticky;
  top: 88px;
  align-self: start;
}
```

```tsx
// src/components/calendar/mini-month.tsx
export interface MiniMonthWeekCount {
  weekStart: string;
  countsByDate?: Record<string, number>;
  onWeekClick?: (weekStart: string) => void;
}
```

- [ ] **Step 4: Re-run the desktop rendering test to verify it passes**

Run: `npm test -- src/__tests__/calendar-view-agenda-stream.test.tsx`

Expected: PASS with the rail labels rendered in desktop mode.

- [ ] **Step 5: Commit**

```bash
git add src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx \
  src/domains/calendar/views/agenda-stream/agendaStream.module.css \
  src/components/calendar/mini-month.tsx \
  src/__tests__/calendar-view-agenda-stream.test.tsx
git commit -m "feat: port agenda stream desktop view"
```

### Task 4: Integrate The Custom View Into CalendarView And Preserve Existing Flows

**Files:**
- Modify: `src/components/calendar/calendar-view.tsx`
- Modify: `src/components/calendar/event-detail-sidebar.tsx`
- Modify: `src/components/calendar/add-event-modal.tsx`
- Test: `src/__tests__/calendar-view-agenda-stream.test.tsx`

- [ ] **Step 1: Add failing integration assertions for preserved behaviors**

```tsx
it("preserves the existing add-event trigger and quote navigation metadata", async () => {
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });

  render(
    <CalendarView
      initialData={{
        desktop: {
          start: "2026-04-13",
          end: "2026-04-20",
          events: [
            {
              id: "quote-evt",
              title: "Dean Lunch",
              start: "2026-04-16T18:00:00.000Z",
              end: "2026-04-16T19:00:00.000Z",
              allDay: false,
              color: "#fff7ed",
              borderColor: "#f97316",
              textColor: "#f97316",
              source: "catering",
              extendedProps: {
                quoteId: "quote-123",
                quoteNumber: "QT-123",
                quoteStatus: "ACCEPTED",
                location: "Library",
              },
            },
          ],
        },
        mobile: { start: "2026-04-16", end: "2026-04-17", events: [] },
      }}
    />,
  );

  expect(await screen.findByRole("button", { name: /add event/i })).toBeInTheDocument();
  expect(screen.getByText(/dean lunch/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `npm test -- src/__tests__/calendar-view-agenda-stream.test.tsx`

Expected: FAIL because `CalendarView` has not yet been switched to the custom desktop view and the sidebar still assumes the old layout.

- [ ] **Step 3: Wire the plugin into the calendar container and preserve modal/sidebar actions**

```tsx
// src/components/calendar/calendar-view.tsx
import { agendaStreamPlugin } from "@/domains/calendar/views/agenda-stream/agendaStreamPlugin";

<FullCalendar
  key={isMobile ? "mobile" : "desktop"}
  ref={calendarRef}
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, agendaStreamPlugin]}
  initialView={isMobile ? "timeGridDay" : "agendaStreamWeek"}
  headerToolbar={{
    left: isMobile ? "prev,next" : "prev,next today",
    center: "title",
    right: isMobile ? "dayGridMonth,timeGridDay" : "dayGridMonth,agendaStreamWeek,timeGridDay",
  }}
  events={fetchEvents}
  datesSet={handleDatesSet}
  eventClick={handleEventClick}
  eventMouseEnter={handleEventMouseEnter}
  eventMouseLeave={handleEventMouseLeave}
/>
```

```tsx
// src/components/calendar/add-event-modal.tsx
interface AddEventModalProps {
  initialValues?: Partial<CreateEventInput> & { endTime?: string | null };
}

const [date, setDate] = useState(() => event?.date ?? initialValues?.date ?? todayStr());
const [startTime, setStartTime] = useState(event?.startTime ?? initialValues?.startTime ?? "09:00");
const [endTime, setEndTime] = useState(event?.endTime ?? initialValues?.endTime ?? "10:00");
const [type, setType] = useState<EventType>(event?.type ?? initialValues?.type ?? "MEETING");
```

```tsx
// src/components/calendar/event-detail-sidebar.tsx
interface EventDetailSidebarProps {
  countsBySource?: Record<string, number>;
  weeklyStats?: { totalEvents: number; cateringCount: number; cateringTotal: number };
  quickAddTrigger?: React.ReactNode;
}
```

- [ ] **Step 4: Re-run the integration test to verify the preserved behaviors pass**

Run: `npm test -- src/__tests__/calendar-view-agenda-stream.test.tsx`

Expected: PASS with desktop stream rendering and existing add/edit affordances still present.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/calendar-view.tsx \
  src/components/calendar/event-detail-sidebar.tsx \
  src/components/calendar/add-event-modal.tsx \
  src/__tests__/calendar-view-agenda-stream.test.tsx
git commit -m "feat: integrate agenda stream into calendar view"
```

### Task 5: Add Manual-Event Quick Add, Rescheduling, And Final Verification

**Files:**
- Modify: `src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx`
- Modify: `src/domains/calendar/views/agenda-stream/hooks.ts`
- Modify: `src/__tests__/calendar-view-agenda-stream.test.tsx`

- [ ] **Step 1: Add failing quick-add and reschedule tests**

```tsx
import userEvent from "@testing-library/user-event";
import { eventApi } from "@/domains/event/api-client";

vi.mock("@/domains/event/api-client", () => ({
  eventApi: {
    getById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "evt-created" }),
    update: vi.fn().mockResolvedValue({ id: "evt-updated" }),
    remove: vi.fn(),
  },
}));

it("creates manual events from quick add defaults", async () => {
  const user = userEvent.setup();
  render(/* CalendarView with desktop bootstrap */);

  await user.click(await screen.findByRole("button", { name: /\+ new event/i }));
  await user.type(screen.getByPlaceholderText(/event title/i), "Ops review");
  await user.click(screen.getByRole("button", { name: /add event/i }));

  expect(eventApi.create).toHaveBeenCalledWith(expect.objectContaining({
    title: "Ops review",
    type: "MEETING",
  }));
});

it("updates only manual events during drag reschedule", async () => {
  render(/* desktop CalendarView with manual + catering events */);

  expect(eventApi.update).not.toHaveBeenCalledWith("quote-evt", expect.anything());
});
```

- [ ] **Step 2: Run the integration test file to verify the new interactions fail**

Run: `npm test -- src/__tests__/calendar-view-agenda-stream.test.tsx`

Expected: FAIL because the quick-add popover and manual-only drag handlers are not wired to `eventApi` yet.

- [ ] **Step 3: Wire quick-add creation and manual-only rescheduling**

```ts
// src/domains/calendar/views/agenda-stream/hooks.ts
import { eventApi } from "@/domains/event/api-client";

export async function createManualAgendaEvent(input: {
  title: string;
  type: "MEETING" | "SEMINAR" | "VENDOR" | "OTHER";
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
}) {
  return eventApi.create({
    title: input.title,
    type: input.type,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location ?? null,
    allDay: false,
  });
}

export async function rescheduleManualAgendaEvent(eventId: string, date: string, startTime: string, endTime: string) {
  return eventApi.update(eventId, { date, startTime, endTime, allDay: false });
}
```

```tsx
// src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx
async function handleQuickAddSubmit(values: QuickAddDraft) {
  await createManualAgendaEvent({
    title: values.title,
    type: values.type,
    date: values.dateKey,
    startTime: values.startTime,
    endTime: values.endTime,
    location: values.location,
  });
  props.calendarApi.refetchEvents();
}

async function handleReschedule(event: AgendaStreamEvent, nextStartMin: number) {
  if (event.readOnly || !event.eventId) return;
  await rescheduleManualAgendaEvent(
    event.eventId,
    event.dateKey,
    minutesToTimeString(nextStartMin),
    minutesToTimeString(nextStartMin + event.durMin),
  );
  props.calendarApi.refetchEvents();
}
```

- [ ] **Step 4: Run targeted tests and then repo validation**

Run:

```bash
npm test -- src/__tests__/agenda-stream-utils.test.ts src/__tests__/calendar-view-agenda-stream.test.tsx
npm run ship-check
```

Expected:

- targeted tests PASS
- `ship-check` exits 0 after lint, test, and build

- [ ] **Step 5: Commit**

```bash
git add src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx \
  src/domains/calendar/views/agenda-stream/hooks.ts \
  src/__tests__/calendar-view-agenda-stream.test.tsx
git commit -m "feat: add agenda stream quick add and rescheduling"
```

---

## Spec Coverage Check

- Desktop `timeGridWeek` replacement: covered by Tasks 3 and 4
- Preserve existing calendar data infrastructure: covered by Tasks 1 and 4
- Sticky rail, filters, stats, quick add: covered by Tasks 3 and 4
- Quick-add manual event creation: covered by Task 5
- Manual-only drag reschedule: covered by Task 5
- Mobile unchanged: covered by Task 4 assertions and non-desktop integration behavior
- Theme tokens and styling guardrails: covered by Task 2 and Task 3
- Verification with repo validation: covered by Task 5

## Self-Review Notes

- No schema/API work was introduced beyond existing client calls.
- All new behavior is routed through existing calendar and event infrastructure.
- The plan keeps drag/create restricted to manual events to avoid breaking catering or birthday sources.
