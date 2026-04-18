# Calendar Agenda Stream — Design Spec

**Date:** 2026-04-17
**Status:** Draft
**Scope:** Desktop calendar week-view overhaul using the Agenda Stream handoff in `/Users/montalvo/Downloads/LAPortal-2.zip`

---

## Overview

Replace the current desktop `timeGridWeek` experience on `/calendar` with a custom FullCalendar view called **Agenda Stream**.

This is a presentation and interaction overhaul, not a calendar data-model rewrite. The existing LAPortal calendar infrastructure remains the source of truth:

- manual events still come from the `Event` model and existing event APIs
- catering events still derive from quote records with `isCateringEvent = true`
- birthdays still derive from `Staff.birthMonth` / `Staff.birthDay`
- FullCalendar remains the calendar engine and date-range owner
- the existing LA-time helpers, SSE refresh path, add/edit modal, and detail actions stay in place

The standalone HTML/React files in the zip are visual and behavioral references only. Production code must be rebuilt inside the repo’s existing Next.js, TypeScript, Tailwind, shadcn, and FullCalendar architecture.

---

## Goals

1. Replace the desktop weekly calendar with a lane-based agenda view that matches the handoff closely.
2. Preserve all existing event infrastructure and adjacent flows, especially catering quote events and manual event CRUD.
3. Keep mobile behavior functional and familiar instead of forcing the desktop redesign onto small screens.
4. Continue to support hover/pin detail behavior, quote linking, staff linking, and event editing.

## Non-Goals

- No schema changes
- No new server endpoints
- No change to how catering events are generated from quotes
- No change to AI/chatbot, quote, ad, or catering data ownership
- No attempt to replace FullCalendar entirely

---

## Current Source Of Truth

### Data pipeline

- `src/domains/calendar/service.ts`
  - merges catering quotes, manual events, and birthdays into `CalendarEventItem[]`
- `src/app/api/calendar/events/route.ts`
  - exposes the unified event feed to the client
- `src/domains/calendar/api-client.ts`
  - fetches the event feed
- `src/domains/calendar/hooks.ts`
  - refreshes on `calendar-changed` SSE messages

### Existing desktop behavior

- `src/components/calendar/calendar-view.tsx`
  - renders FullCalendar with `timeGridWeek` on desktop and `timeGridDay` on mobile
  - owns event caching, hover/pin state, modal editing, mini-month sync, and event fetching
- `src/components/calendar/event-detail-sidebar.tsx`
  - renders the current left rail with mini-month + event details + action buttons
- `src/components/calendar/add-event-modal.tsx`
  - provides manual event create/edit/delete flows

### Preservation rule

All new desktop rendering must continue to consume `CalendarEventItem` data from the existing unified calendar feed. Any view-specific shaping happens client-side only.

---

## Replacement Strategy

### Desktop

Desktop weekly view changes from:

- `timeGridWeek`

to:

- custom FullCalendar view `agendaStreamWeek`

This custom view becomes the default desktop initial view and the desktop weekly button target.

### Mobile

Mobile keeps the current simpler views:

- default `timeGridDay`
- month/day switching remains available

The handoff’s dense lane layout is desktop-only.

### FullCalendar ownership

FullCalendar still owns:

- visible date range
- toolbar navigation (`prev`, `next`, `today`)
- event store slicing
- event lifecycle hooks

Agenda Stream only replaces the weekly rendering layer.

---

## Target Desktop Experience

The port should reproduce these handoff regions:

1. Top bar
   - today button, prev/next week controls, week label, month/year, counts, show-past toggle
2. Sticky left rail
   - month navigator
   - quick add
   - source filters
   - this-week stats
3. Main lane stack
   - one weekday per row
   - collapsed compact timeline + cards by default
   - expandable detailed time grid per day
4. Hover peek
   - floating event preview card
5. Quick-add popover
   - lightweight creation UI for manual events

The visual language should follow the handoff tokens closely while still using the repo’s existing theme variables and components where practical.

---

## Event Model Mapping

The current client event shape is:

```ts
type CalendarEventItem = {
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
    type?: "MEETING" | "SEMINAR" | "VENDOR" | "OTHER";
    location?: string | null;
    headcount?: number | null;
    quoteId?: string | null;
    quoteNumber?: string | null;
    quoteStatus?: string | null;
    staffId?: string | null;
    eventId?: string | null;
    description?: string | null;
    setupTime?: string | null;
    takedownTime?: string | null;
  };
};
```

The Agenda Stream view will derive a view-local shape from FullCalendar events:

- `dateKey`
- `startMin`
- `durMin`
- `source`
- `title`
- metadata for hover cards and actions

No server contract changes are needed.

### Source mapping

- manual events
  - map from `source: "manual"` and `extendedProps.type`
  - editable and draggable
- catering events
  - map from `source: "catering"`
  - read-only in calendar, keep quote navigation
- birthdays
  - map from `source: "birthday"`
  - read-only in calendar, keep staff navigation

---

## Interaction Rules

### Expansion

- each weekday lane is collapsed by default
- clicking the day plate toggles expansion
- expanded lane state persists in `localStorage`
- `Today` should expand the current day lane automatically

### Filters

- filter chips/rows control source visibility
- persisted in `localStorage`
- initial set includes all supported sources:
  - Meeting
  - Seminar
  - Vendor
  - Other
  - Catering
  - Birthday

### Show past

- desktop-only boolean preference
- persisted in `localStorage`
- hides past weekday lanes in the current displayed week when disabled

### Hover and pin behavior

- hover peek becomes the primary desktop hover affordance in the lane stack
- existing detail/sidebar actions still remain available through the left rail detail region
- pinning an event should still freeze the detailed event panel until cleared

### Quick add

- quick add only creates manual events
- default type should remain a manual event type
- create path must use existing `eventApi.create` / `useCreateEvent`
- after successful creation, refresh through the existing refetch flow

### Rescheduling

- dragging is supported only for manual events
- update path must use existing `eventApi.update`
- dragging catering or birthday events must be disabled

### Existing event edit

- editing a manual event still uses `AddEventModal`
- quote-linked catering events still route to `/quotes/[quoteId]`
- birthdays still route to `/staff/[staffId]`

---

## Component Architecture

### New files

- `src/domains/calendar/views/agenda-stream/AgendaStreamView.tsx`
  - top-level custom FullCalendar view renderer
- `src/domains/calendar/views/agenda-stream/agendaStreamPlugin.ts`
  - FullCalendar plugin registration
- `src/domains/calendar/views/agenda-stream/agendaStream.module.css`
  - scoped lane/timeline/overlay styles
- `src/domains/calendar/views/agenda-stream/hooks.ts`
  - persisted state and interaction hooks
- `src/domains/calendar/views/agenda-stream/types.ts`
  - local view models and helper types
- `src/domains/calendar/views/agenda-stream/utils.ts`
  - event slicing, overlap columns, minute math, stats helpers

### Existing files to modify

- `src/components/calendar/calendar-view.tsx`
  - register the custom plugin
  - make `agendaStreamWeek` the desktop default
  - keep current fetch/cache/SSE/modal integration
  - route desktop weekly toolbar behavior to the custom view
- `src/components/calendar/event-detail-sidebar.tsx`
  - evolve the existing sidebar into the new sticky rail shape without losing current event detail/actions
- `src/components/calendar/mini-month.tsx`
  - support week-row jumping and density dots for the rail navigator
- `src/components/calendar/add-event-modal.tsx`
  - accept optional initial date/time/type defaults so quick-add can open prefilled
- `src/app/globals.css`
  - add `--c-past-fade` and `--c-lane-today`

### Internal split

`AgendaStreamView.tsx` should remain mostly orchestration. Break visual regions into local subcomponents inside the view folder when the file starts growing:

- top bar
- rail stats / filters
- day lane
- collapsed bar
- expanded timeline
- hover peek
- quick-add popover

---

## Persistence

Use a single desktop preference blob in `localStorage` keyed as:

```ts
"agenda-v2"
```

Persist:

- `weekStart`
- `expanded`
- `showPast`
- `activeSources`

Do not persist:

- hover state
- popover open state
- nav month display

This is intentionally client-local for now. No user preferences API work is required in this pass.

---

## Styling

The handoff’s typography, spacing, radii, shadows, and color treatment are the fidelity target.

Implementation rules:

- prefer existing global theme tokens over hard-coded values when equivalent tokens already exist
- add only the two missing tokens called out by the handoff:
  - `--c-past-fade`
  - `--c-lane-today`
- use CSS modules for Agenda Stream-specific layout and FullCalendar view styling to avoid leaking into month/day views
- keep existing calendar styles for non-stream views untouched

---

## Preservation Boundaries

The following infrastructure must remain unchanged in behavior:

- catering event derivation from quotes
- quote status, headcount, setup/takedown, and location metadata in calendar events
- birthday generation from staff records
- manual event CRUD and recurrence support
- `calendar-changed` SSE refresh flow
- existing quote/staff links from calendar surfaces
- any existing event-adjacent operational data used elsewhere in the app

If a requirement from the handoff conflicts with that infrastructure, the infrastructure wins and the view adapts.

---

## Rollout Plan

### Phase 1

Add the plugin, local event adapters, and collapsed lane rendering with static rail content.

### Phase 2

Port lane expansion, hour grid rendering, overlap layout, current-time marker, and hover peek.

### Phase 3

Wire quick add and manual-event dragging to existing event APIs.

### Phase 4

Polish rail stats, density dots, filters, persistence, responsive behavior, and verification coverage.

---

## Verification

### Functional

1. Desktop `/calendar` opens in Agenda Stream instead of `timeGridWeek`.
2. Mobile calendar still opens in the existing day-first flow.
3. Catering events still appear with quote metadata and navigate to quotes.
4. Birthday events still appear and navigate to staff pages.
5. Manual events can still be created, edited, and deleted.
6. Manual events can be rescheduled from the stream view.
7. Catering and birthday events cannot be rescheduled.
8. Source filters, expanded lanes, and show-past persist across reloads.
9. SSE-triggered calendar refresh still updates the stream view.

### Visual

1. Left rail is sticky and matches the handoff structure closely.
2. Today lane is visually distinct.
3. Expanded lanes render a readable 7:00a–7:30p grid.
4. Hover peek avoids clipping at viewport edges.

### Repo validation

- targeted tests for new view helpers and interaction logic
- relevant component tests for desktop stream behavior where practical
- `npm run ship-check`

---

## Open Decisions Resolved

- Desktop replacement only: yes
- Keep FullCalendar as the engine: yes
- Keep existing event infrastructure: yes
- Keep mobile on simpler views: yes
- Restrict drag/create behavior to manual events: yes
