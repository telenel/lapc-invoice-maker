# UI Component Redesign — Modern SaaS Polish

**Date:** 2026-03-27
**Direction:** Modern SaaS Dashboard (Linear/Stripe/Vercel energy)
**Scope:** Component Redesign — same page structure, redesigned components
**Goal:** Make the app feel like a polished product, not a functional portal

## Design System Foundations

### Depth Model

Replace border-based card containers with shadow-based depth. Three levels:

| Level | CSS | Usage |
|-------|-----|-------|
| Subtle | `shadow-sm` (0 1px 2px) | Inputs, badges, inline elements |
| Default | `shadow` (0 1px 3px) | Cards, table containers, nav bar |
| Elevated | `shadow-md` (0 4px 6px) | Dropdowns, popovers, modals |

Cards lift to `shadow-md` on hover for interactive feedback.

### Border Radius

- Cards: `rounded-xl` (12px)
- Inline elements (badges, pills, buttons): `rounded-lg` (8px)
- Small elements (sparkline bars): `rounded-sm` (2px)

### Typography

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Page titles | 24px | Bold | No change |
| Card headers | 14px | Semibold | Down from 16px |
| Stat values | 26-28px | Extrabold | `font-variant-numeric: tabular-nums` |
| Labels | 11px | Medium | Muted color, **no uppercase**, drop tracking-wide |
| Table primary text | 13px | Semibold | Invoice # + staff name |
| Table secondary text | 11-12px | Normal | Muted color for dept, date |

### Color Adjustments

- **Primary:** LAPC red stays (`oklch(0.45 0.18 25)`)
- **Logo container:** Subtle gradient (`linear-gradient(135deg, #dc2626, #b91c1c)`)
- **Status badges** get distinct colored fills:
  - Final: green background (`#dcfce7`, text `#166534`)
  - Draft: amber background (`#fef3c7`, text `#92400e`)
  - Pending: blue background (`#dbeafe`, text `#1e40af`)
- **Remove** left-accent borders on stat cards — shadow-based depth replaces them
- **Hover states:** table rows get `bg-muted/50`, cards lift to `shadow-md`

## Component Specifications

### Navigation

**Current:** Horizontal sticky bar, uppercase tracking-wide links, bottom underline on active link, text-based right controls.

**Redesigned:**
- **Active state:** Pill background (`bg-muted rounded-lg`) instead of bottom underline
- **Link text:** Normal case, 14px medium weight — drop uppercase + letter-spacing
- **Logo:** Gradient red background on the logo square
- **Right controls:** Ghost icon buttons (`bg-muted rounded-lg`, 28px square) instead of text. Group: theme picker, help, user avatar (initials in circle)
- **Bar style:** Keep sticky `backdrop-blur` glass effect, replace `ring-1 ring-foreground/10` with `shadow` for bottom edge

### Dashboard Stats Cards

**Current:** Simple number + label with colored left border, 3-column grid.

**Redesigned (keep 3-column grid):**

1. **Invoices This Month card:**
   - Change indicator pill in top-right (e.g., "+3" in green)
   - Mini sparkline at bottom — 5-6 CSS bars showing daily distribution, last bar highlighted in primary red, others in `red-100`
   - No Recharts dependency — pure CSS/HTML bars

2. **Total This Month card:**
   - Change indicator pill (e.g., "+12%")
   - Thin gradient progress bar at bottom (`linear-gradient(90deg, #dc2626, #ef4444)`) on a muted track

3. **Pending Drafts card:**
   - Contextual pill (e.g., "Action needed" in amber)
   - Dot indicators at bottom showing count (filled amber dots for pending, muted dots for capacity)

### Tables (Invoice List, Staff, Quotes, Quick Picks)

**Current:** Standard `<table>` with separate columns for each field, border-based rows.

**Redesigned:**
- **Container:** Shadow card with rounded-xl, header row with title + "View all →" link
- **Avatar initials:** 34px rounded-lg square with muted background, staff initials in bold, left of content
- **Two-line primary cell:** Line 1: `#1042 · M. Garcia` (13px semibold). Line 2: `Sciences · Mar 25, 2026` (11px muted)
- **Amount + status:** Right-aligned. Amount on top (13px bold, tabular-nums), status badge below
- **Row hover:** `bg-muted/50` transition
- **Applies to:** Dashboard recent invoices, full invoice table, quotes table, staff table, quick picks table
- **Full invoice table:** Keeps all filter/sort/pagination — only row design changes

### Forms (Invoice/Quote Creation)

Single keyboard mode.

- **Field grouping:** Wrap related fields (staff + account code + department) in subtle shadow-sm card containers with a section label
- **Input styling:** `rounded-lg`, `shadow-sm` on focus instead of ring outline, slightly larger padding
- **Line item rows:** Row number badge on the left (matching avatar style), cleaner inline editing
- **Action buttons:** Primary actions (Save Draft, Finalize) get gradient red background. Secondary actions stay ghost/outline.

### Detail Pages (Invoice/Quote View)

- **Header:** Bold invoice number + status badge, staff name + date as subtitle. Action buttons (Edit, PDF, Delete) as icon button group, top-right.
- **Info grid:** 2-column grid of label/value pairs inside a shadow card. Labels in 11px muted, values in 13px semibold.
- **Line items:** Same redesigned table row style.
- **Signature section:** Clean shadow card with 3 signature lines, each showing name + title.

### Other Pages

- **Analytics:** Wrap each chart in shadow card with header label. Apply consistent color palette to Recharts.
- **Staff/Quick Picks:** Same table redesign with avatar initials, shadow container.
- **Login:** Centered shadow-md card, gradient red submit button.

## Dark Mode

Shadow-based depth doesn't read well on dark surfaces. Invert the model:

- **Cards:** `bg-white/5` with `border border-white/8` instead of shadows
- **Badges:** Keep colored fills, adjust opacity for dark backgrounds
- **Nav:** Glass effect stays, shift to dark backdrop
- **Sparklines + progress bars:** Same colors — they pop well on dark surfaces
- **Hover states:** `bg-white/5` instead of `bg-muted/50`

## What Stays the Same

- Page structure — same routes, same layout hierarchy, same `max-w-7xl` container
- Keyboard-mode invoice creation — gets visual polish only
- All functionality — filters, sorting, pagination, PDF generation, export
- Font choices — DM Sans + JetBrains Mono
- LAPC red brand color as primary
- Catppuccin theme variants
- UI scale feature
