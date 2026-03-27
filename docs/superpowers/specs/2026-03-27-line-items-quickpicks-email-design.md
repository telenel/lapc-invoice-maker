# Line Item Autocomplete, Quick Picks Redesign & Email Button

**Date:** 2026-03-27
**Goal:** Make line item entry faster with autocomplete and a redesigned quick picks side panel with personal picks, plus add an email button for finalized invoices.

## Feature 1: Line Item Description Autocomplete

### Behavior

The description field on each line item row becomes an `InlineCombobox` (same component pattern used for staff search). As the user types, a dropdown shows matching items from two sources:

- **Saved Items** (`SavedLineItem` table) — items the user has bookmarked previously
- **Quick Pick Items** (`QuickPickItem` table) — admin-created standard items

Results are filtered by the typed text, matching against `description`. Items show description on the left, price on the right. Selecting an item auto-fills both the description and unit price fields.

### Keyboard Flow

- Type in description → dropdown appears with filtered matches
- Arrow keys navigate the dropdown
- Enter/Tab selects the highlighted item (fills description + unit price, advances focus to Qty)
- If no match selected, the typed text is kept as-is (custom description)
- Escape closes dropdown without selecting

### Data Source

Combined query: saved items (filtered by current department, ordered by `usageCount DESC`) merged with quick pick items (where `department` matches or `department === "__ALL__"`). Deduplicated by description.

## Feature 2: Quick Picks Side Panel

### Layout

Persistent column (160px) to the right of the line items area. Replaces the current collapsible `QuickPickPanel`. Always visible during line item entry.

### Sections (top to bottom)

1. **Search filter** — text input at top, filters all sections by description match
2. **Standard** — admin-managed global picks (`QuickPickItem` where admin-flagged as global). Filled muted background. Visible to all users. Admin can toggle individual items on/off.
3. **My Picks · [Department]** — user's personal picks matching the current invoice's department. Outlined border.
4. **My Picks · Other** — user's personal picks from other departments. Dashed border, muted text.

### Overflow

Panel is scrollable when items exceed the visible height. Panel height matches the line items area.

### Click Behavior

Clicking a quick pick inserts it into the first empty line item row. If no empty rows exist, a new row is added. Description and unit price are filled. Focus moves to the Qty field of that row.

## Feature 3: Personal Quick Picks (Data Model)

### New Model: `UserQuickPick`

```prisma
model UserQuickPick {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  description String
  unitPrice   Decimal  @map("unit_price") @db.Decimal(10, 2)
  department  String
  usageCount  Int      @default(0) @map("usage_count")
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, department, description])
  @@map("user_quick_picks")
}
```

### Star Button (★)

Each line item row gets a ★ button (between the extended price and the × remove button):

- **Empty star** (muted) — item is not in user's personal picks. Click to save.
- **Filled star** (amber) — item is already in user's personal picks. Click to remove.
- Star is only clickable when the row has a description and unit price.

Saving creates a `UserQuickPick` record with the current user, description, unit price, and the invoice's department.

### Admin Global Picks

The existing `QuickPickItem` model stays as-is for admin-managed global items. Admin can toggle `active` on individual items via the Quick Picks management page. Global picks appear in the "Standard" section for all users.

### Relationship to SavedLineItem

`SavedLineItem` continues to exist for the autocomplete search. `UserQuickPick` is specifically for the side panel quick-access buttons. A line item can exist in both — the star button controls `UserQuickPick`, the bookmark button (if kept) or autocomplete usage controls `SavedLineItem`.

Simplification: remove the separate `SavedLineItem` bookmark flow. The ★ star button replaces it. The autocomplete still searches both `UserQuickPick` and `QuickPickItem` tables. `SavedLineItem` can be deprecated over time — existing saved items are still searchable via autocomplete but new saves go to `UserQuickPick`.

## Feature 4: Email Button

### Location

Invoice detail page (`/invoices/[id]`), in the action buttons area (top-right). Only visible for `FINAL` status invoices.

### Behavior (Two-Step)

1. User clicks "Email" button
2. PDF is downloaded (same as "Download PDF" action)
3. `mailto:` link opens with pre-filled template (see below)
4. Toast notification: "PDF downloaded — attach it to the email"

### Email Template

**Subject:**
```
Invoice #[invoiceNumber] Ready for Processing — [department]
```

**Body:**
```
Invoice #[invoiceNumber] is ready for processing. Please find the attached invoice.

Department: [department]
Staff: [staff.name]
Account Number: [accountNumber]
Account Code: [accountCode]
Amount: [totalAmount]
Date: [date]

Thank you,
[currentUser.name]
```

All fields are populated from the invoice record. `mailto:` uses `encodeURIComponent` for proper encoding.

### No `to:` Address

The `mailto:` link opens with no recipient — the user fills in who to send it to. This avoids needing to store email recipients for invoices.

## What Stays the Same

- Keyboard navigation flow (Enter between fields, Tab to add rows)
- Quick Picks admin management page (creates global `QuickPickItem` records)
- Line item Qty/Price/Extended calculation logic
- All existing invoice creation functionality
