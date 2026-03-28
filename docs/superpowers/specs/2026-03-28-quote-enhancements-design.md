# Quote System Enhancements — Design Spec

**Date:** 2026-03-28
**Status:** Draft
**Scope:** Catering events, calendar, margin markup, sales tax, public quote form

---

## Overview

Four interconnected enhancements to the quote/invoice system:

1. **Catering event details** on quote creation with auto-population chain
2. **Calendar system** — full page (FullCalendar) + dashboard widget
3. **Margin markup** — global % with per-item override
4. **Sales tax** — per-item taxable flag, separate tax line in totals

All data originates in the quote form. Everything downstream (calendar, dashboard, public page, printable guide) reads from the quote — no duplicate data entry.

---

## 1. Database Schema Changes

### Invoice model (existing — add fields)

```prisma
isCateringEvent    Boolean   @default(false)
cateringDetails    Json?                       // structured JSON, see below
marginEnabled      Boolean   @default(false)
marginPercent      Decimal?  @db.Decimal(5, 2)  // e.g., 15.00
taxEnabled         Boolean   @default(false)
taxRate            Decimal   @default(0.0975) @db.Decimal(5, 4)  // stored per-quote
```

### InvoiceItem model (existing — add fields)

```prisma
isTaxable       Boolean   @default(true)
marginOverride  Decimal?  @db.Decimal(5, 2)   // null = use global margin
costPrice       Decimal?  @db.Decimal(10, 2)  // original vendor price before markup
```

### CateringDetails JSON structure

```typescript
interface CateringDetails {
  eventDate: string;          // ISO date
  startTime: string;          // "11:30" (24h)
  endTime: string;            // "13:00"
  location: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  headcount?: number;
  eventName?: string;
  setupRequired: boolean;
  setupTime?: string;         // "10:30"
  setupInstructions?: string;
  takedownRequired: boolean;
  takedownTime?: string;      // "13:30"
  takedownInstructions?: string;
  specialInstructions?: string;
}
```

### No new tables

Calendar events are derived queries: quotes where `isCateringEvent = true` AND `quoteStatus` IN ('SENT', 'ACCEPTED'). No separate events table.

### Constants update

- `TAX_RATE` in `src/domains/invoice/constants.ts`: change from `0.095` to `0.0975` (actual Woodland Hills combined rate)
- Remove "CA State Tax (9.5%)" quick pick item from seed/database

---

## 2. Quote Form Changes

### Margin + Tax Controls

New control row above line items grid:

- **"Apply Margin" checkbox** + percentage input field (numeric, e.g., 15)
  - When enabled: all line items show original price as strikethrough, charged price in purple
  - Charged price = cost price × (1 + margin%)
  - Extended = charged price × quantity
- **"Apply Sales Tax" checkbox** + rate display (9.75%)
  - When enabled: each line item gets a "Taxable" checkbox (default checked)
  - Uncheck for exempt items (e.g., bottled water, cold grab-and-go)
  - If `isCateringEvent = true`, all items are forced taxable and item-level tax toggles are disabled (catering is always fully taxable per CDTFA Regulation 1603)
- **"CA Tax Rules" info button** — tooltip/popover with CDTFA Regulation 1603 summary:
  - Hot prepared food → always taxable
  - Cold food to-go (no eating establishment) → usually exempt
  - Catering (food + service) → always fully taxable
  - Carbonated beverages, candy → always taxable

### Line Items Grid Columns

When margin is OFF and tax is OFF (current behavior):
`Description | Qty | Unit Price | Extended | ×`

When margin is ON:
`Description | Qty | Unit Price (strikethrough) | Charged (purple) | Extended | ×`

When tax is ON:
Append `Tax` checkbox column

When both ON:
`Description | Qty | Unit Price | Charged | Extended | Tax | ×`

Per-item margin override: click the charged price to enter a custom margin % for that item.

### Catering Event Card

New section between quote details and line items:

- **"This is a catering event" checkbox**
  - When checked: reveals catering details card with orange accent
- **Auto-population from existing form fields:**
  - Contact name ← recipient name (from quote recipient section)
  - Contact phone ← staff extension (from staff select)
  - Contact email ← recipient email
  - Event date ← quote date
- **Fields:**
  - Event date, start time, end time
  - Location (free text)
  - Contact name, phone, email
  - Headcount (numeric)
  - Event name / purpose
  - Setup required (checkbox) → setup time, setup instructions
  - Takedown required (checkbox) → takedown time, takedown instructions
  - Special instructions (free text)

### Totals Section

Replace simple sum with breakdown:

```text
Subtotal                              $331.70
Margin (+15%)                         included
CA Sales Tax (9.75% on taxable items) $ 30.56
                                     ────────
Total                                 $362.26
```

Tax is calculated on the sum of extended prices for taxable items only, after margin is applied.

### Shared Logic

The margin + tax controls and calculations apply to both the quote form AND the invoice form. Extract into shared hooks:
- `useMarginCalculation` — manages cost price, margin %, charged price
- `useTaxCalculation` — replaces current hacky implementation, per-item taxable flag

---

## 3. Public Quote Review Page

### Catering quotes only

When a quote has `isCateringEvent = true`, the public review page (`/quotes/review/[token]`) shows required event detail fields before the approve button.

### Required fields (must fill before approving)

- Contact name
- Contact number
- Event location

### Optional fields

- Expected headcount
- Setup needed (checkbox) → "When should we arrive?" time field
- Takedown needed (checkbox) → "When should we return?" time field
- "Anything else we should know?" (free text notes)

### Data flow on approval

Customer-entered data saves to the quote's `cateringDetails` JSON field via `POST /api/quotes/public/[token]/respond`. If staff pre-filled catering details during quote creation, the customer's responses override them.

### Non-catering quotes

Unchanged — simple approve/decline flow as today.

---

## 4. Calendar System

### Full Calendar Page (`/calendar`)

- **Library:** FullCalendar React (@fullcalendar/react + @fullcalendar/daygrid + @fullcalendar/timegrid + @fullcalendar/interaction)
- **Views:** Month, Week (default), Day
- **Event source:** `GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Returns quotes where `isCateringEvent = true` AND `quoteStatus` IN ('SENT', 'ACCEPTED')
  - API returns flat objects; client-side mapping to FullCalendar format wraps extra fields in `extendedProps`
- **Event display:** Orange accent, shows time + event name + location + headcount
- **Click handler:** Navigate to `/quotes/[quoteId]` (quote detail page with catering guide)
- **Navigation:** New "Calendar" item in the sidebar/nav

### API Endpoint

```http
GET /api/calendar/events?start=2026-03-01&end=2026-03-31
```

Response:

```json
[
  {
    "id": "quote-uuid",
    "title": "Spring Planning Lunch",
    "start": "2026-03-24T11:30:00",
    "end": "2026-03-24T13:00:00",
    "location": "SSB Room 201",
    "headcount": 45,
    "quoteId": "quote-uuid",
    "setupTime": "10:30",
    "takedownTime": "13:30",
    "quoteStatus": "ACCEPTED"
  }
]
```

### Dashboard Widget ("Today's Events")

- Added to `DraggableDashboard` SORTABLE_WIDGETS array
- Shows today's catering events only, visible to all users
- Compact card per event: event name, time, location, headcount, setup/takedown tags
- Badge count in header
- "View Calendar →" link to `/calendar`
- Empty state: "No events today"
- Data source: `GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD` using today's local date for both values (e.g., `?start=2026-03-28&end=2026-03-28`)

---

## 5. Printable Catering Guide

### Location

The existing quote detail page (`/quotes/[id]`) — no new page needed.

### Behavior

When `isCateringEvent = true`, the quote detail page renders a "Catering Guide" section:
- Event name, date, time
- Location
- Contact name, phone, email
- Headcount
- Setup details (time + instructions)
- Takedown details (time + instructions)
- Special instructions
- Full line items with totals

### Print styling

`@media print` CSS:
- Hide navigation, sidebar, action buttons, notification bell
- Show only the catering guide content + line items
- Clean single-column layout suitable for handing to staff
- LAPC logo at top
- No Puppeteer PDF — browser Ctrl+P is sufficient for internal use

---

## 6. Auto-Population Chain

Data flows from creation through every downstream view:

```text
Staff Select → contact phone, department → Catering Card
Recipient Info → contact name, email → Catering Card
Quote Date → event date (default) → Catering Card
Catering Card → cateringDetails JSON → Database

Database → Calendar events (derived query)
Database → Dashboard widget (today's events)
Database → Quote detail page (catering guide section)
Database → Public quote page (pre-filled fields)

Customer Response → overrides cateringDetails → Database
Database (updated) → Calendar, Dashboard, Catering Guide (all reflect customer's data)
```

No field is entered twice. The quote is the single source of truth.

---

## 7. Files to Create/Modify

### New files

- `src/components/quote/catering-details-card.tsx` — catering event form card
- `src/components/invoice/hooks/use-margin-calculation.ts` — margin logic (shared)
- `src/components/dashboard/todays-events.tsx` — dashboard calendar widget
- `src/app/calendar/page.tsx` — full calendar page
- `src/app/api/calendar/events/route.ts` — calendar events API
- `src/domains/calendar/api-client.ts` — client-side calendar API wrapper

### Modified files

- `prisma/schema.prisma` — new fields on Invoice and InvoiceItem
- `src/domains/invoice/constants.ts` — TAX_RATE 0.095 → 0.0975
- `src/components/quote/quote-mode.tsx` — add catering card, margin/tax controls
- `src/components/quote/quote-form.ts` — update form state for new fields
- `src/components/invoice/invoice-form.tsx` — add margin/tax controls (shared logic)
- `src/components/invoice/hooks/use-tax-calculation.ts` — rewrite with per-item taxable flag
- `src/components/invoices/invoice-detail.tsx` — show margin/tax breakdown in detail view
- `src/components/quotes/quote-detail.tsx` — add catering guide section + print CSS
- `src/app/quotes/review/[token]/page.tsx` — add required catering fields for customer
- `src/app/api/quotes/public/[token]/respond/route.ts` — accept catering details on approval
- `src/domains/quote/types.ts` — add CateringDetails interface, update CreateQuoteInput
- `src/domains/quote/repository.ts` — handle cateringDetails JSON field
- `src/domains/quote/service.ts` — catering details save/update logic
- `src/components/dashboard/draggable-dashboard.tsx` — add TodaysEvents widget
- `src/components/nav.tsx` — add Calendar nav link
- `src/lib/pdf/templates/quote.ts` — show margin/tax in PDF if applicable
