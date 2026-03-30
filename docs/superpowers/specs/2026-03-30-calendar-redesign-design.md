# Calendar Redesign — Design Spec

**Date:** 2026-03-30
**Problem:** Calendar events are tiny (10px text), pale (15% opacity), and show only titles. No way to see event details without clicking. No sidebar, no inline info, no hover preview.
**Outcome:** Hover-driven sidebar detail panel with Framer Motion animations, rich card event rendering with inline time/location/icons, legend bar removed.

---

## Layout

- **Main calendar** (left, flex-1) — FullCalendar with rich card rendering
- **Detail sidebar** (right, 320px fixed) — hover-driven event detail panel
- **Legend bar removed** — sidebar replaces it
- Sidebar hidden on mobile (< 768px); events still clickable to open modal as fallback

## Sidebar: Hover-Driven Detail Panel

### Default State
When no event is hovered, sidebar shows a placeholder:
```
"Hover over an event to see details"
```
With a subtle pulsing calendar icon (Framer Motion animate opacity 0.3 → 0.6).

### On Event Hover
- **Trigger**: FullCalendar `eventMouseEnter` callback
- **Debounce**: 150ms to prevent flicker on fast mousing
- **Animation**: AnimatePresence with:
  - Exit: current content fades out (opacity 1 → 0, duration 100ms)
  - Enter: new content slides in from right (x: 20 → 0, opacity 0 → 1)
  - Spring: stiffness 300, damping 25
- **Calendar highlight**: hovered event gets a `ring-2 ring-offset-1` style highlight via FullCalendar `eventDidMount` + CSS class toggle

### On Event Hover Leave
- **Sticky**: sidebar keeps showing the last-hovered event (does NOT revert to placeholder)
- **Highlight ring removed** from calendar event

### Content Per Event Type

**Catering Events:**
- Type badge: orange dot + "CATERING" + quote status badge (SENT/ACCEPTED/DECLINED)
- Title (large, bold)
- Date + time range
- Location
- Headcount (👥)
- Quote number + total amount (💰)
- Setup / takedown times
- Buttons: "View Quote" (links to `/quotes/{quoteId}`), "Download PDF"

**Manual Events (Meeting/Seminar/Vendor/Other):**
- Type badge: colored dot + type name
- Title (large, bold)
- Date + time range (or "All Day")
- Location (if set)
- Recurrence badge (🔁 Weekly, Monthly, etc.) if recurring
- Description block (if set) — muted background card
- Buttons: "Edit Event" (opens modal), "Delete"

**Birthday Events:**
- Type badge: pink dot + "BIRTHDAY"
- "🎂 [Name]'s Birthday"
- Department
- Button: "View Staff" (links to `/staff/{staffId}`)

### Component Structure
- New component: `src/components/calendar/event-detail-sidebar.tsx`
- Uses Framer Motion `AnimatePresence` + `motion.div`
- Receives `hoveredEvent` state from calendar page
- Renders different layouts based on `event.source` ("catering" | "manual" | "birthday")

## Event Rendering: Rich Cards

### CSS Changes in `src/app/globals.css`

| Property | Before | After |
|----------|--------|-------|
| `.fc .fc-event` font-size | 0.75rem | 0.85rem |
| `.fc .fc-event` background opacity | 15% (`color26`) | 50% (`color80`) |
| `.fc .fc-timegrid-slot` height | 2rem | 2.5rem |
| Event border-radius | 4px | 0 6px 6px 0 (with left border accent) |

### Event Content Rendering

Use FullCalendar's `eventContent` render hook to customize what appears inside each event block:

```tsx
eventContent={(arg) => {
  const source = arg.event.extendedProps.source;
  const icon = source === "catering" ? "🍽️" : source === "birthday" ? "🎂" :
               arg.event.extendedProps.type === "VENDOR" ? "🏢" :
               arg.event.extendedProps.type === "SEMINAR" ? "🎓" : "📋";
  const location = arg.event.extendedProps.location;
  const headcount = arg.event.extendedProps.headcount;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span>{icon}</span>
        <strong>{arg.event.title}</strong>
      </div>
      {(location || headcount) && (
        <div style={{ fontSize: "0.7rem", marginTop: 2, opacity: 0.8 }}>
          {arg.timeText}{location ? ` · ${location}` : ""}
          {headcount ? ` · ${headcount} guests` : ""}
        </div>
      )}
    </div>
  );
}}
```

### Color Mapping Update

Update `src/domains/event/service.ts` event color generation and `src/app/api/calendar/events/route.ts` to use 50% opacity (`80` hex suffix) instead of 15% (`26`):

| Event Type | Border Color | Background |
|------------|-------------|------------|
| Meeting | #3b82f6 | #3b82f680 |
| Seminar | #8b5cf6 | #8b5cf680 |
| Vendor | #14b8a6 | #14b8a680 |
| Other | #6b7280 | #6b728080 |
| Catering | #f97316 | #f9731680 |
| Birthday | #ec4899 | #ec489980 |

## Calendar Page Changes

**File:** `src/app/calendar/page.tsx`

1. Remove `EventLegend` import and rendering
2. Add `hoveredEvent` state: `useState<CalendarEventItem | null>(null)`
3. Add `eventMouseEnter` handler (debounced 150ms) that sets `hoveredEvent`
4. Add `eventMouseLeave` handler that does NOT clear state (sticky)
5. Wrap layout in flex: calendar (flex-1) + sidebar (w-80)
6. Add `eventContent` render hook for rich cards
7. Add `eventDidMount` / `eventWillUnmount` for hover highlight CSS class

**File:** `src/components/calendar/event-legend.tsx` — no longer imported (can keep file for now)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/calendar/event-detail-sidebar.tsx` | New — sidebar component |
| `src/app/calendar/page.tsx` | Modify — layout, hover state, eventContent, remove legend |
| `src/app/globals.css` | Modify — event font size, colors, slot height |
| `src/domains/event/service.ts` | Modify — color opacity (26 → 80) |
| `src/app/api/calendar/events/route.ts` | Modify — color opacity for catering/birthday |

## Verification

1. Open calendar page → events show as rich cards with icons, time, location inline
2. Hover over a manual event → sidebar animates in with full details + Edit/Delete buttons
3. Hover over a catering event → sidebar shows quote info, headcount, setup times, View Quote button
4. Hover over a birthday → sidebar shows name, department, View Staff button
5. Move mouse away → sidebar keeps showing last event (sticky)
6. Hover quickly across multiple events → no flicker (150ms debounce)
7. Mobile viewport → sidebar hidden, click still opens modal
8. `npm run lint && npm run build`
