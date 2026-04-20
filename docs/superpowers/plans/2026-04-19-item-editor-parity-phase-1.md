# Item Editor Parity — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Phase:** 1 of 8 — Schema split + multi-location sync expansion
**Branch:** `feat/item-editor-parity` (already pushed to origin)
**Goal:** Expand the Supabase mirror from a flat PIER-only `products` table to a normalized `products` (global) + `product_inventory` (per-location) pair, and broaden the Prism sync to pull PIER + PCOP + PFS inventory with ref-table labels denormalized in.

**Architecture:** Add a new `product_inventory` table keyed by `(sku, location_id)`. Keep the existing flat columns on `products` (`retail_price`, `cost`, `stock_on_hand`, `last_sale_date`) intact so the current UI doesn't break — this is a purely additive migration. Backfill `product_inventory` from the existing PIER data. Extend `prism-sync.ts` to pull from `LocationID IN (2, 3, 4)` and write both representations in lockstep. Phase 1c (dropping the duplicated columns from `products` once the UI reads from `product_inventory`) is deferred to a later plan cycle.

**Tech Stack:** Prisma 7 raw-SQL migrations, Postgres (Supabase), MSSQL (WinPRISM) read-only pulls via `mssql`/tedious, Vitest for unit tests, TypeScript.

**Safety posture:**
- Every Prism query in this plan is SELECT-only (read-only hard rule).
- Locations filtered to `IN (2, 3, 4)` — PBO (5) strictly excluded.
- Migration is non-destructive (additive only; no DROP COLUMN in this phase).
- The existing UI keeps working throughout; the old flat columns on `products` remain populated by the sync until a later phase explicitly cuts them over.

---

## File map

Files created:
- `prisma/migrations/20260419180000_product_inventory_table/migration.sql`
- `prisma/migrations/20260419180500_products_expanded_global_fields/migration.sql`
- `prisma/migrations/20260419181000_backfill_product_inventory_from_pier/migration.sql`
- `tests/domains/product/prism-sync-query.test.ts` — extended
- `tests/domains/product/prism-sync-shred.test.ts` — new

Files modified:
- `src/domains/product/prism-sync.ts` — broaden query + shred
- `src/domains/product/types.ts` — add `ProductInventory` type + expanded `PrismItemRow`

Files read for reference only (no changes):
- `docs/prism/field-usage.md`, `docs/prism/SCHEMA.md` — field-list source of truth
- `src/domains/product/prism-server.ts` — `PIERCE_LOCATION_ID` constant stays but becomes informational; a new `PIERCE_LOCATION_IDS = [2, 3, 4] as const` drives the sync

---

## Task 1: Migration — create `product_inventory` table

**Files:**
- Create: `prisma/migrations/20260419180000_product_inventory_table/migration.sql`

**Purpose:** New per-location inventory table keyed by (sku, location_id). Holds retail/cost/stock/tag/status and the per-location denormalized labels.

- [ ] **Step 1: Create the migration directory and file.**

```bash
mkdir -p prisma/migrations/20260419180000_product_inventory_table
```

Create `prisma/migrations/20260419180000_product_inventory_table/migration.sql` with:

```sql
-- Per-location inventory mirror. One row per (sku, location_id) where
-- location_id ∈ {2 PIER, 3 PCOP, 4 PFS}. LocationID 5 (PBO) is strictly
-- excluded from this table and from the sync that writes to it.
--
-- The retail_price/cost/stock_on_hand/last_sale_date columns on products
-- remain in place until the UI cuts over to this table; both are kept in
-- sync until then.

CREATE TABLE IF NOT EXISTS "product_inventory" (
  "sku"                     INTEGER      NOT NULL,
  "location_id"             SMALLINT     NOT NULL,
  "location_abbrev"         TEXT,

  -- Pricing + stock
  "retail_price"            NUMERIC(10,2),
  "cost"                    NUMERIC(10,2),
  "expected_cost"           NUMERIC(10,2),
  "stock_on_hand"           INTEGER,

  -- Label columns (denormalized from Prism ref tables each sync)
  "tag_type_id"             INTEGER,
  "tag_type_label"          TEXT,
  "status_code_id"          SMALLINT,
  "status_code_label"       TEXT,
  "tax_type_override_id"    SMALLINT,
  "disc_code_id"            INTEGER,

  -- Reorder / stocking controls
  "min_stock"               INTEGER,
  "max_stock"               INTEGER,
  "auto_order_qty"          INTEGER,
  "min_order_qty"           INTEGER,
  "hold_qty"                INTEGER,
  "reserved_qty"            INTEGER,
  "rental_qty"              INTEGER,

  -- Forecasting
  "est_sales"               INTEGER,
  "est_sales_locked"        BOOLEAN      DEFAULT FALSE,

  -- Royalty
  "royalty_cost"            NUMERIC(10,4),
  "min_royalty_cost"        NUMERIC(10,4),

  -- Flags
  "f_inv_list_price_flag"   BOOLEAN      DEFAULT FALSE,
  "f_tx_want_list_flag"     BOOLEAN      DEFAULT FALSE,
  "f_tx_buyback_list_flag"  BOOLEAN      DEFAULT FALSE,
  "f_rent_only"             BOOLEAN      DEFAULT FALSE,
  "f_no_returns"            BOOLEAN      DEFAULT FALSE,

  -- Inventory-scoped free text (256-char Prism limit)
  "text_comment_inv"        VARCHAR(256),

  -- Activity dates
  "last_sale_date"          TIMESTAMPTZ,
  "last_inventory_date"     TIMESTAMPTZ,
  "create_date"             TIMESTAMPTZ,
  "synced_at"               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Sync hash (parallel to products.sync_hash)
  "sync_hash"               TEXT,

  CONSTRAINT "product_inventory_pkey" PRIMARY KEY ("sku", "location_id"),
  CONSTRAINT "product_inventory_location_check" CHECK ("location_id" IN (2, 3, 4)),
  CONSTRAINT "product_inventory_sku_fkey" FOREIGN KEY ("sku") REFERENCES "products"("sku") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_inventory_location_id_idx" ON "product_inventory" ("location_id");
CREATE INDEX IF NOT EXISTS "product_inventory_tag_type_id_idx" ON "product_inventory" ("tag_type_id") WHERE "tag_type_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "product_inventory_status_code_id_idx" ON "product_inventory" ("status_code_id") WHERE "status_code_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "product_inventory_last_sale_date_idx" ON "product_inventory" ("last_sale_date") WHERE "last_sale_date" IS NOT NULL;

-- RLS posture: mirror the products table. Enable RLS, revoke public grants.
-- Exact grant set matches the feedback_supabase_grant_anon_default rule —
-- new tables get GRANT ALL to anon by default, so revoke explicitly.
ALTER TABLE "product_inventory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "product_inventory" FROM anon;
REVOKE ALL ON "product_inventory" FROM authenticated;
GRANT SELECT ON "product_inventory" TO authenticated;
GRANT ALL ON "product_inventory" TO service_role;
```

- [ ] **Step 2: Apply the migration to the dev database.**

Run:
```bash
npx prisma migrate dev --name product_inventory_table --skip-seed
```

Expected output includes `Applying migration 20260419180000_product_inventory_table` and then `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify the table exists with correct columns.**

Run:
```bash
npx prisma studio
```
(optional; close after visual check) — or via psql:
```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='product_inventory' ORDER BY ordinal_position;
SQL
```

Expected: 34 columns listed in the order defined in the migration, with the check constraint on `location_id` visible via `\d+ product_inventory`.

- [ ] **Step 4: Commit.**

```bash
git add prisma/migrations/20260419180000_product_inventory_table/
git commit -m "$(cat <<'EOF'
feat(products): create product_inventory table for per-location mirror

One row per (sku, location_id). Location scope: 2 PIER, 3 PCOP, 4 PFS.
Enforced via CHECK constraint so PBO (5) rows can never land here.

Retail, cost, stock-on-hand, tag type, status code, and the full set of
per-location inventory fields from the Prism Inventory table, plus
denormalized label columns (tag_type_label, status_code_label,
location_abbrev) refreshed each sync.

products.retail_price/cost/stock_on_hand/last_sale_date stay in place
until the UI cuts over; Phase 1 writes both representations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration — expand global columns on `products`

**Files:**
- Create: `prisma/migrations/20260419180500_products_expanded_global_fields/migration.sql`

**Purpose:** Add the SKU-global columns Phase 4+ editing needs — item-level flags, used-textbook linkage, alt vendor, mfg, binding, copyright, imprint, etc. Denormalized `item_tax_type_label`, `package_type_label`, `binding_label` so the UI never displays raw IDs (per `feedback_show_labels_not_ids`).

- [ ] **Step 1: Create the migration file.**

```bash
mkdir -p prisma/migrations/20260419180500_products_expanded_global_fields
```

Create `prisma/migrations/20260419180500_products_expanded_global_fields/migration.sql`:

```sql
-- Additive column set for full Item / GM / Textbook field parity.
-- No DROP COLUMN in this migration. Retail/cost/stock columns stay on
-- products for Phase 1; a later migration will drop them after the UI
-- cuts over to product_inventory.

ALTER TABLE "products"
  -- Item table (global)
  ADD COLUMN IF NOT EXISTS "alt_vendor_id"         INTEGER,
  ADD COLUMN IF NOT EXISTS "mfg_id"                INTEGER,
  ADD COLUMN IF NOT EXISTS "used_dcc_id"           INTEGER,
  ADD COLUMN IF NOT EXISTS "item_tax_type_label"   TEXT,
  ADD COLUMN IF NOT EXISTS "tx_comment"            VARCHAR(25),
  ADD COLUMN IF NOT EXISTS "weight"                NUMERIC(9,4),
  ADD COLUMN IF NOT EXISTS "style_id"              INTEGER,
  ADD COLUMN IF NOT EXISTS "item_season_code_id"   INTEGER,
  ADD COLUMN IF NOT EXISTS "f_list_price_flag"     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "f_perishable"          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "f_id_required"         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "min_order_qty_item"    INTEGER,

  -- GeneralMerchandise (global, present when item_type = general_merchandise)
  ADD COLUMN IF NOT EXISTS "type_gm"               VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "size"                  VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "size_id"               INTEGER,
  ADD COLUMN IF NOT EXISTS "package_type"          CHAR(3),
  ADD COLUMN IF NOT EXISTS "package_type_label"    TEXT,
  ADD COLUMN IF NOT EXISTS "units_per_pack"        SMALLINT,
  ADD COLUMN IF NOT EXISTS "order_increment"       INTEGER,
  ADD COLUMN IF NOT EXISTS "image_url"             VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "use_scale_interface"   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "tare"                  NUMERIC(9,4),

  -- Textbook (global, present when item_type starts with 'textbook')
  ADD COLUMN IF NOT EXISTS "binding_id"            INTEGER,
  ADD COLUMN IF NOT EXISTS "binding_label"         TEXT,
  ADD COLUMN IF NOT EXISTS "imprint"               VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "copyright"             VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "used_sku"              INTEGER,
  ADD COLUMN IF NOT EXISTS "text_status_id"        INTEGER,
  ADD COLUMN IF NOT EXISTS "status_date"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "type_textbook"         VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "book_key"              VARCHAR(10);

-- Helpful index for the textbook filter on the products page
CREATE INDEX IF NOT EXISTS "products_binding_id_idx"
  ON "products" ("binding_id") WHERE "binding_id" IS NOT NULL;
```

- [ ] **Step 2: Apply the migration.**

```bash
npx prisma migrate dev --name products_expanded_global_fields --skip-seed
```

Expected: migration applies cleanly with 26 columns added.

- [ ] **Step 3: Verify column additions.**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name FROM information_schema.columns
WHERE table_name='products'
  AND column_name IN (
    'alt_vendor_id', 'mfg_id', 'item_tax_type_label', 'binding_id',
    'binding_label', 'package_type_label', 'tx_comment'
  )
ORDER BY column_name;
SQL
```

Expected: all 7 names returned.

- [ ] **Step 4: Commit.**

```bash
git add prisma/migrations/20260419180500_products_expanded_global_fields/
git commit -m "$(cat <<'EOF'
feat(products): add global columns for Item/GM/Textbook editor parity

Additive migration — no DROP COLUMN. Covers:

- Item-level flags and metadata: alt_vendor_id, mfg_id, style_id,
  f_list_price_flag, f_perishable, f_id_required, tx_comment, weight,
  used_dcc_id, item_season_code_id, min_order_qty_item.
- GM fields: type_gm, size, size_id, package_type + label,
  units_per_pack, order_increment, image_url, use_scale_interface, tare.
- Textbook fields: binding_id + label, imprint, copyright, used_sku,
  text_status_id, status_date, type_textbook, book_key.
- Denormalized labels: item_tax_type_label, package_type_label,
  binding_label — sync populates these from Prism ref tables so the UI
  never renders raw numeric IDs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migration — backfill `product_inventory` from existing PIER rows

**Files:**
- Create: `prisma/migrations/20260419181000_backfill_product_inventory_from_pier/migration.sql`

**Purpose:** Seed `product_inventory` with PIER (location_id=2) rows pulled from the existing flat `products` columns. This gives us a complete PIER-only mirror on the new table before the sync starts writing PCOP/PFS.

- [ ] **Step 1: Create the migration file.**

```bash
mkdir -p prisma/migrations/20260419181000_backfill_product_inventory_from_pier
```

Create `prisma/migrations/20260419181000_backfill_product_inventory_from_pier/migration.sql`:

```sql
-- One-time backfill: copy the PIER slice of products into product_inventory.
-- Safe to re-run because of the ON CONFLICT DO NOTHING clause.

INSERT INTO "product_inventory" (
  "sku", "location_id", "location_abbrev",
  "retail_price", "cost", "stock_on_hand",
  "last_sale_date", "synced_at"
)
SELECT
  p."sku",
  2                     AS "location_id",
  'PIER'                AS "location_abbrev",
  p."retail_price",
  p."cost",
  p."stock_on_hand",
  p."last_sale_date",
  p."synced_at"
FROM "products" p
ON CONFLICT ("sku", "location_id") DO NOTHING;
```

- [ ] **Step 2: Apply the migration.**

```bash
npx prisma migrate dev --name backfill_product_inventory_from_pier --skip-seed
```

Expected: migration applies; row count should match `SELECT COUNT(*) FROM products;`.

- [ ] **Step 3: Verify the backfill row count.**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT
  (SELECT COUNT(*) FROM products) AS products_count,
  (SELECT COUNT(*) FROM product_inventory WHERE location_id = 2) AS pier_inventory_count;
SQL
```

Expected: the two counts match.

- [ ] **Step 4: Verify no PBO leakage.**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT location_id, COUNT(*) FROM product_inventory GROUP BY location_id ORDER BY location_id;
SQL
```

Expected: only `location_id = 2` appears; no rows at 3, 4, or 5.

- [ ] **Step 5: Commit.**

```bash
git add prisma/migrations/20260419181000_backfill_product_inventory_from_pier/
git commit -m "$(cat <<'EOF'
chore(products): backfill product_inventory with existing PIER rows

Copies retail_price / cost / stock_on_hand / last_sale_date from the
flat products table into product_inventory at location_id=2. PCOP (3)
and PFS (4) rows will arrive when the next sync pull runs.

Idempotent via ON CONFLICT DO NOTHING.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Define the expanded `PrismItemRow` + `PrismInventoryRow` types

**Files:**
- Modify: `src/domains/product/prism-sync.ts` lines 24-47

**Purpose:** The current `PrismItemRow` conflates Item + Inventory fields and only carries one location's values. Split it into a global-per-SKU shape plus a per-location shape so the shred logic can write each side independently.

- [ ] **Step 1: Write the failing test first.**

Create `tests/domains/product/prism-sync-shred.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PrismItemRow, PrismInventoryRow } from "@/domains/product/prism-sync";

describe("Prism sync row types", () => {
  it("PrismItemRow carries only global (per-SKU) fields", () => {
    const row: PrismItemRow = {
      sku: 123,
      description: "Test",
      title: null,
      author: null,
      isbn: null,
      edition: null,
      binding_id: null,
      binding_label: null,
      imprint: null,
      copyright: null,
      usedSku: null,
      textStatusId: null,
      statusDate: null,
      typeTextbook: null,
      bookKey: null,
      barcode: null,
      vendorId: 100,
      altVendorId: null,
      mfgId: null,
      dccId: 1010,
      usedDccId: null,
      itemTaxTypeId: 4,
      itemTaxTypeLabel: "STATE",
      itemType: "general_merchandise",
      fDiscontinue: 0,
      txComment: null,
      weight: null,
      styleId: null,
      itemSeasonCodeId: null,
      fListPriceFlag: 0,
      fPerishable: 0,
      fIdRequired: 0,
      minOrderQtyItem: null,
      typeGm: null,
      size: null,
      sizeId: null,
      catalogNumber: null,
      packageType: "EA",
      packageTypeLabel: "Each",
      unitsPerPack: null,
      orderIncrement: 1,
      imageUrl: null,
      useScaleInterface: 0,
      tare: null,
      deptNum: 10,
      classNum: 10,
      catNum: 20,
      deptName: "Drinks",
      className: "Bottled",
      catName: "Sodas",
    };
    expect(row.sku).toBe(123);
    expect(row.itemTaxTypeLabel).toBe("STATE");
  });

  it("PrismInventoryRow carries exactly one (sku, locationId) pair", () => {
    const row: PrismInventoryRow = {
      sku: 123,
      locationId: 2,
      locationAbbrev: "PIER",
      retail: 9.99,
      cost: 4.5,
      expectedCost: null,
      stockOnHand: 12,
      tagTypeId: 3,
      tagTypeLabel: "LARGE w/Price/Color",
      statusCodeId: 2,
      statusCodeLabel: "Active",
      taxTypeOverrideId: null,
      discCodeId: null,
      minStock: null,
      maxStock: null,
      autoOrderQty: null,
      minOrderQty: null,
      holdQty: null,
      reservedQty: null,
      rentalQty: null,
      estSales: null,
      estSalesLocked: 0,
      royaltyCost: null,
      minRoyaltyCost: null,
      fInvListPriceFlag: 1,
      fTxWantListFlag: 0,
      fTxBuybackListFlag: 0,
      fRentOnly: 0,
      fNoReturns: 0,
      textCommentInv: null,
      lastSaleDate: new Date("2026-04-01T00:00:00Z"),
      lastInventoryDate: null,
      createDate: null,
    };
    expect(row.locationId).toBe(2);
    expect([2, 3, 4]).toContain(row.locationId);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run:
```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: FAIL — `PrismItemRow`/`PrismInventoryRow` missing new fields or not exported yet.

- [ ] **Step 3: Replace the existing `PrismItemRow` interface in `src/domains/product/prism-sync.ts` lines 24-47 with the expanded shape plus the new `PrismInventoryRow`.**

Edit `src/domains/product/prism-sync.ts`, replacing the current `PrismItemRow` interface:

```ts
// Global (per-SKU) fields — written to the products table.
export interface PrismItemRow {
  sku: number;
  // Textbook metadata (nullable for non-textbook items)
  description: string | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  edition: string | null;
  binding_id: number | null;
  binding_label: string | null;
  imprint: string | null;
  copyright: string | null;
  usedSku: number | null;
  textStatusId: number | null;
  statusDate: Date | null;
  typeTextbook: string | null;
  bookKey: string | null;
  // Item table (global)
  barcode: string | null;
  vendorId: number | null;
  altVendorId: number | null;
  mfgId: number | null;
  dccId: number | null;
  usedDccId: number | null;
  itemTaxTypeId: number | null;
  itemTaxTypeLabel: string | null;
  itemType: string;
  fDiscontinue: 0 | 1;
  txComment: string | null;
  weight: number | null;
  styleId: number | null;
  itemSeasonCodeId: number | null;
  fListPriceFlag: 0 | 1;
  fPerishable: 0 | 1;
  fIdRequired: 0 | 1;
  minOrderQtyItem: number | null;
  // GM (global, present when item_type = general_merchandise)
  typeGm: string | null;
  size: string | null;
  sizeId: number | null;
  catalogNumber: string | null;
  packageType: string | null;
  packageTypeLabel: string | null;
  unitsPerPack: number | null;
  orderIncrement: number;
  imageUrl: string | null;
  useScaleInterface: 0 | 1;
  tare: number | null;
  // DCC labels (pre-existing)
  deptNum: number | null;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
}

// Per-location fields — one row per (SKU, LocationID) in {2, 3, 4}.
export interface PrismInventoryRow {
  sku: number;
  locationId: 2 | 3 | 4;
  locationAbbrev: string;
  retail: number | null;
  cost: number | null;
  expectedCost: number | null;
  stockOnHand: number | null;
  tagTypeId: number | null;
  tagTypeLabel: string | null;
  statusCodeId: number | null;
  statusCodeLabel: string | null;
  taxTypeOverrideId: number | null;
  discCodeId: number | null;
  minStock: number | null;
  maxStock: number | null;
  autoOrderQty: number | null;
  minOrderQty: number | null;
  holdQty: number | null;
  reservedQty: number | null;
  rentalQty: number | null;
  estSales: number | null;
  estSalesLocked: 0 | 1;
  royaltyCost: number | null;
  minRoyaltyCost: number | null;
  fInvListPriceFlag: 0 | 1;
  fTxWantListFlag: 0 | 1;
  fTxBuybackListFlag: 0 | 1;
  fRentOnly: 0 | 1;
  fNoReturns: 0 | 1;
  textCommentInv: string | null;
  lastSaleDate: Date | null;
  lastInventoryDate: Date | null;
  createDate: Date | null;
}
```

- [ ] **Step 4: Run the test to verify it passes.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: PASS.

- [ ] **Step 5: Confirm the rest of the existing suite still passes.**

```bash
npx vitest run
```

Expected: PASS for all tests. (Compilation errors in `prism-sync.ts` from references to the old interface fields will be caught here — fix in Task 5.)

- [ ] **Step 6: Commit.**

```bash
git add src/domains/product/prism-sync.ts tests/domains/product/prism-sync-shred.test.ts
git commit -m "$(cat <<'EOF'
refactor(products): split PrismItemRow into global + per-location types

PrismItemRow now holds SKU-global fields only (Item + GM + Textbook
columns that are identical across locations). PrismInventoryRow is
the new per-(SKU, LocationID) shape for retail/cost/stock/tag-type/
status-code and the rest of the Inventory table. Location type is
narrowed to {2, 3, 4} so a PBO (5) row is a compile error.

Label columns (item_tax_type_label, tag_type_label, status_code_label,
package_type_label, binding_label) carry the denormalized Description
so the UI never renders raw numeric IDs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Expand `buildPrismPullPageQuery` to pull three locations with labels

**Files:**
- Modify: `src/domains/product/prism-sync.ts:87-131` (`buildPrismPullPageQuery`)
- Modify: `tests/domains/product/prism-sync-query.test.ts` — extend

**Purpose:** The current query hard-codes `LocationID = @loc` and returns one row per SKU. The new query joins `Inventory` three times (or uses `IN (2,3,4)` returning 1-3 rows per SKU) and joins the ref tables for labels. We use `IN (...)` and let the SQL return one row per `(SKU, LocationID)`.

- [ ] **Step 1: Write the failing test first by extending the existing test file.**

Edit `tests/domains/product/prism-sync-query.test.ts` to add three new `it()` blocks after the existing one:

```ts
import { describe, expect, it } from "vitest";
import { buildPrismPullPageQuery } from "@/domains/product/prism-sync";

describe("buildPrismPullPageQuery", () => {
  it("uses the real Prism DCC name columns for category metadata", () => {
    const sql = buildPrismPullPageQuery();
    expect(sql).toContain("LTRIM(RTRIM(dep.DeptName))");
    expect(sql).toContain("LTRIM(RTRIM(cls.ClassName))");
    expect(sql).toContain("LTRIM(RTRIM(cat.CatName))");
    expect(sql).not.toContain("LTRIM(RTRIM(dep.Name))");
    expect(sql).not.toContain("LTRIM(RTRIM(cls.Name))");
    expect(sql).not.toContain("LTRIM(RTRIM(cat.Name))");
  });

  it("filters Inventory to PIER + PCOP + PFS (LocationID IN 2, 3, 4)", () => {
    const sql = buildPrismPullPageQuery();
    expect(sql).toMatch(/inv\.LocationID\s+IN\s*\(\s*2\s*,\s*3\s*,\s*4\s*\)/);
    expect(sql).not.toMatch(/inv\.LocationID\s*=\s*@loc/);
    expect(sql).not.toMatch(/LocationID\s+IN\s*\([^)]*\b5\b/);
  });

  it("joins Prism ref tables and denormalizes label columns", () => {
    const sql = buildPrismPullPageQuery();
    // TagType label
    expect(sql).toContain("TagType tag");
    expect(sql).toContain("RTRIM(tag.Description)");
    // Item_Tax_Type label
    expect(sql).toContain("Item_Tax_Type itt");
    expect(sql).toContain("RTRIM(itt.Description)");
    // PackageType label (GM items)
    expect(sql).toContain("PackageType pkg");
    // Location abbreviation
    expect(sql).toContain("Location loc");
    expect(sql).toContain("RTRIM(loc.Abbreviation)");
  });

  it("emits every Item + GM + Textbook global column we store in products", () => {
    const sql = buildPrismPullPageQuery();
    for (const col of [
      "i.AltVendorID",
      "gm.MfgID",
      "i.StyleID",
      "i.fListPriceFlag",
      "gm.Size",
      "gm.SizeID",
      "gm.PackageType",
      "tb.BindingID",
      "tb.Imprint",
      "tb.Copyright",
      "tb.UsedSKU",
    ]) {
      expect(sql).toContain(col);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

```bash
npx vitest run tests/domains/product/prism-sync-query.test.ts
```

Expected: 3 new tests FAIL; original test still PASSes.

- [ ] **Step 3: Rewrite `buildPrismPullPageQuery` in `src/domains/product/prism-sync.ts:87-131`.**

Replace the function body with:

```ts
export function buildPrismPullPageQuery(): string {
  return `
        SELECT TOP (@pageSize)
          i.SKU,
          inv.LocationID,
          LTRIM(RTRIM(loc.Abbreviation))    AS LocationAbbrev,

          -- GM (NULL for textbook rows)
          LTRIM(RTRIM(gm.Description))      AS Description,
          LTRIM(RTRIM(gm.Type))             AS TypeGm,
          LTRIM(RTRIM(gm.Size))             AS Size,
          gm.SizeID,
          gm.Color                          AS GmColor,
          LTRIM(RTRIM(gm.CatalogNumber))    AS CatalogNumber,
          LTRIM(RTRIM(gm.PackageType))      AS PackageType,
          LTRIM(RTRIM(pkg.Description))     AS PackageTypeLabel,
          gm.UnitsPerPack,
          gm.Weight                         AS GmWeight,
          LTRIM(RTRIM(gm.ImageURL))         AS ImageURL,
          gm.OrderIncrement,
          gm.UseScaleInterface,
          gm.Tare,
          gm.MfgID,
          gm.AlternateVendorID              AS AltVendorID,

          -- Textbook (NULL for GM rows)
          LTRIM(RTRIM(tb.Title))            AS Title,
          LTRIM(RTRIM(tb.Author))           AS Author,
          LTRIM(RTRIM(tb.ISBN))             AS ISBN,
          LTRIM(RTRIM(tb.Edition))          AS Edition,
          tb.BindingID,
          LTRIM(RTRIM(tb.Imprint))          AS Imprint,
          LTRIM(RTRIM(tb.Copyright))        AS Copyright,
          tb.UsedSKU,
          tb.TextStatusID,
          tb.StatusDate,
          LTRIM(RTRIM(tb.Type))             AS TypeTextbook,
          LTRIM(RTRIM(tb.Bookkey))          AS BookKey,

          -- Item (global)
          LTRIM(RTRIM(i.BarCode))           AS BarCode,
          i.VendorID,
          i.DCCID,
          i.UsedDCCID,
          i.ItemTaxTypeID,
          LTRIM(RTRIM(itt.Description))     AS ItemTaxTypeLabel,
          LTRIM(RTRIM(i.txComment))         AS TxComment,
          i.Weight                          AS ItemWeight,
          i.StyleID,
          i.ItemSeasonCodeID,
          i.fListPriceFlag,
          i.fPerishable,
          i.fIDRequired,
          i.MinOrderQty                     AS MinOrderQtyItem,
          CASE
            WHEN i.TypeID = 2                THEN 'used_textbook'
            WHEN tb.SKU IS NOT NULL          THEN 'textbook'
            WHEN gm.SKU IS NOT NULL          THEN 'general_merchandise'
            ELSE                                  'other'
          END AS ItemType,
          i.fDiscontinue,

          -- DCC labels
          dcc.Department                    AS DeptNum,
          dcc.Class                         AS ClassNum,
          dcc.Category                      AS CatNum,
          LTRIM(RTRIM(dep.DeptName))        AS DeptName,
          LTRIM(RTRIM(cls.ClassName))       AS ClassName,
          LTRIM(RTRIM(cat.CatName))         AS CatName,

          -- Inventory (per-location)
          inv.Retail,
          inv.Cost,
          inv.ExpectedCost,
          inv.StockOnHand,
          inv.TagTypeID,
          LTRIM(RTRIM(tag.Description))     AS TagTypeLabel,
          inv.StatusCodeID,
          inv.TaxTypeID                     AS TaxTypeOverrideID,
          inv.DiscCodeID                    AS InvDiscCodeID,
          inv.MinimumStock                  AS InvMinStock,
          inv.MaximumStock                  AS InvMaxStock,
          inv.AutoOrderQty                  AS InvAutoOrderQty,
          inv.MinOrderQty                   AS InvMinOrderQty,
          inv.ReservedQty,
          inv.RentalQty,
          inv.EstSales,
          inv.EstSalesLocked,
          inv.RoyaltyCost,
          inv.MinRoyaltyCost,
          inv.fInvListPriceFlag,
          inv.fTXWantListFlag,
          inv.fTXBuybackListFlag,
          inv.fRentOnly,
          inv.fNoReturns,
          inv.TextComment                   AS TextCommentInv,
          inv.LastSaleDate,
          inv.LastInventoryDate,
          inv.CreateDate                    AS InvCreateDate
        FROM Item i
        INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN (2, 3, 4)
        INNER JOIN Location loc ON loc.LocationID = inv.LocationID
        LEFT JOIN Textbook tb ON tb.SKU = i.SKU
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
        LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
        LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department
                                     AND dcc.Class      = cls.Class
        LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department
                                     AND dcc.Class      = cat.Class
                                     AND dcc.Category   = cat.Category
        LEFT JOIN Item_Tax_Type itt ON itt.ItemTaxTypeID = i.ItemTaxTypeID
        LEFT JOIN TagType tag ON tag.TagTypeID = inv.TagTypeID
        LEFT JOIN PackageType pkg ON pkg.PackageType = gm.PackageType
        WHERE i.SKU > @cursor OR (i.SKU = @cursor AND inv.LocationID > @lastLoc)
        ORDER BY i.SKU, inv.LocationID
      `;
}
```

*Note on the cursor:* Because the query now returns up to 3 rows per SKU, a SKU-only cursor breaks pagination (you'd miss the middle location when the page boundary splits a SKU's rows). The cursor is extended to `(sku, lastLocationId)`. Update the paginator accordingly — see Task 7.

- [ ] **Step 4: Run the tests to verify they pass.**

```bash
npx vitest run tests/domains/product/prism-sync-query.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/domains/product/prism-sync.ts tests/domains/product/prism-sync-query.test.ts
git commit -m "$(cat <<'EOF'
feat(products): pull Item/GM/Textbook/Inventory across PIER+PCOP+PFS

buildPrismPullPageQuery now:
- Filters Inventory to LocationID IN (2, 3, 4); PBO (5) excluded.
- Returns one row per (SKU, LocationID), so a SKU stocked at all three
  locations yields 3 rows. Cursor is (sku, locationId).
- Joins TagType / Item_Tax_Type / PackageType / Location ref tables and
  denormalizes the Description values so the Supabase mirror never has
  to join back to Prism for labels.
- Emits every Item + GM + Textbook global column needed for editor
  parity (alt vendor, mfg, style, binding, imprint, copyright, size,
  pkg type, scale interface, list-price flag, etc).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Discover + verify the Status_Codes and Binding ref table names

**Files:**
- Read-only Prism probe (no code change if discovery confirms expected names)
- Modify: `src/domains/product/prism-sync.ts` query — only if discovery reveals different names

**Purpose:** Task 5 assumed `TagType`, `Item_Tax_Type`, `PackageType`, `Location` — all confirmed via the 2026-04-19 snapshot. Two still-unknown ref tables are `Status_Codes` (for `Inventory.StatusCodeID`) and the binding table (for `Textbook.BindingID`). Discover, then either confirm the Task 5 query was right or patch it.

- [ ] **Step 1: Write a read-only discovery script.**

Create `scripts/discover-prism-status-and-binding-refs.ts`:

```ts
/**
 * READ-ONLY. Discover the ref table that holds labels for
 * Inventory.StatusCodeID and Textbook.BindingID.
 * No writes.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

async function main() {
  const pool = await getPrismPool();

  console.log("=== candidate status-code tables ===");
  const statusCandidates = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE' AND (
      TABLE_NAME LIKE '%Status%Code%' OR
      TABLE_NAME = 'Status_Codes' OR
      TABLE_NAME = 'InventoryStatusCodes' OR
      TABLE_NAME = 'InvStatus'
    )
    ORDER BY TABLE_NAME
  `);
  for (const t of statusCandidates.recordset) {
    console.log(`  ${t.TABLE_NAME}`);
    try {
      const sample = await pool.request().query(`SELECT TOP 5 * FROM [${t.TABLE_NAME}]`);
      for (const r of sample.recordset) console.log("   ", r);
    } catch (err) {
      console.log(`    (read failed: ${err instanceof Error ? err.message : err})`);
    }
  }

  console.log("\n=== candidate binding tables ===");
  const bindingCandidates = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE' AND (
      TABLE_NAME LIKE '%Binding%' OR
      TABLE_NAME LIKE 'Textbook_%' OR
      TABLE_NAME LIKE 'TBBinding%'
    )
    ORDER BY TABLE_NAME
  `);
  for (const t of bindingCandidates.recordset) {
    console.log(`  ${t.TABLE_NAME}`);
    try {
      const sample = await pool.request().query(`SELECT TOP 5 * FROM [${t.TABLE_NAME}]`);
      for (const r of sample.recordset) console.log("   ", r);
    } catch (err) {
      console.log(`    (read failed: ${err instanceof Error ? err.message : err})`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script.**

```bash
npx tsx scripts/discover-prism-status-and-binding-refs.ts
```

Record the table names and their Description-column shapes. Expected: `Status_Codes` or `InventoryStatusCodes` for status, `Binding` or `Textbook_Binding` or `TBBinding` for binding.

- [ ] **Step 3: Extend `buildPrismPullPageQuery` to include the discovered tables.**

Edit `src/domains/product/prism-sync.ts` — add the following JOINs to the FROM chain (just before the `WHERE` clause), substituting `{StatusTable}` and `{BindingTable}` with the discovered names:

```sql
        LEFT JOIN {StatusTable} sc ON sc.StatusCodeID = inv.StatusCodeID
        LEFT JOIN {BindingTable} bnd ON bnd.BindingID = tb.BindingID
```

And add these columns to the SELECT list (near the existing `TagTypeLabel`):

```sql
          LTRIM(RTRIM(sc.Description))      AS StatusCodeLabel,
          LTRIM(RTRIM(bnd.Description))     AS BindingLabel,
```

- [ ] **Step 4: Extend the query test to cover the new labels.**

Edit `tests/domains/product/prism-sync-query.test.ts`, adding to the existing `describe` block:

```ts
  it("joins status-code and binding ref tables for their labels", () => {
    const sql = buildPrismPullPageQuery();
    expect(sql).toContain("StatusCodeLabel");
    expect(sql).toContain("BindingLabel");
    expect(sql).toMatch(/LEFT JOIN \w+ sc ON sc\.StatusCodeID = inv\.StatusCodeID/);
    expect(sql).toMatch(/LEFT JOIN \w+ bnd ON bnd\.BindingID = tb\.BindingID/);
  });
```

- [ ] **Step 5: Run tests.**

```bash
npx vitest run tests/domains/product/prism-sync-query.test.ts
```

Expected: all tests PASS including the new one.

- [ ] **Step 6: Commit.**

```bash
git add src/domains/product/prism-sync.ts tests/domains/product/prism-sync-query.test.ts scripts/discover-prism-status-and-binding-refs.ts
git commit -m "$(cat <<'EOF'
feat(products): sync joins Status_Codes + Binding ref tables for labels

Adds JOINs to the status-code and textbook-binding reference tables
(names discovered via scripts/discover-prism-status-and-binding-refs.ts)
so the sync can denormalize their Descriptions into
product_inventory.status_code_label and products.binding_label.

Completes the ref-table label set for the products page: TagType,
Item_Tax_Type, PackageType, Status, Binding, Location — all resolved
at sync time, UI never sees raw IDs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Shred Prism recordsets into `products` + `product_inventory` payloads

**Files:**
- Modify: `src/domains/product/prism-sync.ts` — extract a `shredRecordset` pure function, call it from `runPrismPull`
- Modify: `tests/domains/product/prism-sync-shred.test.ts` — add shred tests

**Purpose:** Pull a Prism recordset (one row per `(sku, location_id)`) and split it into a deduped set of global product records (first occurrence per SKU wins, since global fields are identical per Prism guarantee) plus a flat list of inventory records. Pure function; testable without a database.

- [ ] **Step 1: Write the failing shred test.**

Add to `tests/domains/product/prism-sync-shred.test.ts`:

```ts
import { shredRecordset } from "@/domains/product/prism-sync";

describe("shredRecordset", () => {
  const rawBase = {
    SKU: 123,
    Description: "Widget",
    TypeGm: null,
    Size: null,
    SizeID: null,
    GmColor: 0,
    CatalogNumber: "WID-100",
    PackageType: "EA ",
    PackageTypeLabel: "Each                ",
    UnitsPerPack: null,
    GmWeight: null,
    ImageURL: null,
    OrderIncrement: 1,
    UseScaleInterface: 0,
    Tare: null,
    MfgID: 0,
    AltVendorID: 0,
    Title: null,
    Author: null,
    ISBN: null,
    Edition: null,
    BindingID: null,
    Imprint: null,
    Copyright: null,
    UsedSKU: null,
    TextStatusID: null,
    StatusDate: null,
    TypeTextbook: null,
    BookKey: null,
    BindingLabel: null,
    BarCode: "WID100",
    VendorID: 100,
    DCCID: 1010,
    UsedDCCID: null,
    ItemTaxTypeID: 4,
    ItemTaxTypeLabel: "STATE                                                                           ",
    TxComment: null,
    ItemWeight: null,
    StyleID: null,
    ItemSeasonCodeID: null,
    fListPriceFlag: 0,
    fPerishable: 0,
    fIDRequired: 0,
    MinOrderQtyItem: null,
    ItemType: "general_merchandise",
    fDiscontinue: 0,
    DeptNum: 10,
    ClassNum: 10,
    CatNum: 20,
    DeptName: "Drinks",
    ClassName: "Bottled",
    CatName: "Sodas",
    // Inventory
    Retail: 2.99,
    Cost: 1.1,
    ExpectedCost: null,
    StockOnHand: 25,
    TagTypeID: 3,
    TagTypeLabel: "LARGE w/Price/Color ",
    StatusCodeID: 2,
    StatusCodeLabel: "Active ",
    TaxTypeOverrideID: 2,
    InvDiscCodeID: null,
    InvMinStock: null,
    InvMaxStock: null,
    InvAutoOrderQty: null,
    InvMinOrderQty: null,
    ReservedQty: null,
    RentalQty: null,
    EstSales: 0,
    EstSalesLocked: 0,
    RoyaltyCost: null,
    MinRoyaltyCost: null,
    fInvListPriceFlag: 1,
    fTXWantListFlag: 0,
    fTXBuybackListFlag: 0,
    fRentOnly: 0,
    fNoReturns: 0,
    TextCommentInv: null,
    LastSaleDate: new Date("2026-04-01T00:00:00Z"),
    LastInventoryDate: null,
    InvCreateDate: null,
  };

  it("returns one PrismItemRow per distinct SKU, first occurrence wins", () => {
    const recordset = [
      { ...rawBase, LocationID: 2, LocationAbbrev: "PIER" },
      { ...rawBase, LocationID: 3, LocationAbbrev: "PCOP" },
      { ...rawBase, LocationID: 4, LocationAbbrev: "PFS " },
    ];
    const { items, inventory } = shredRecordset(recordset as never);
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe(123);
    expect(items[0].itemTaxTypeLabel).toBe("STATE");
    expect(inventory).toHaveLength(3);
    expect(inventory.map((i) => i.locationId).sort()).toEqual([2, 3, 4]);
  });

  it("PBO (LocationID 5) in recordset is rejected — hard exclude", () => {
    const recordset = [
      { ...rawBase, LocationID: 5, LocationAbbrev: "PBO " }, // should never be in the recordset, but defensively
    ];
    expect(() => shredRecordset(recordset as never))
      .toThrow(/LocationID 5/);
  });

  it("trims trailing whitespace on label columns", () => {
    const recordset = [{ ...rawBase, LocationID: 2, LocationAbbrev: "PIER" }];
    const { items, inventory } = shredRecordset(recordset as never);
    expect(items[0].packageTypeLabel).toBe("Each");
    expect(items[0].itemTaxTypeLabel).toBe("STATE");
    expect(inventory[0].tagTypeLabel).toBe("LARGE w/Price/Color");
    expect(inventory[0].statusCodeLabel).toBe("Active");
  });

  it("coerces epoch-zero LastSaleDate to null", () => {
    const recordset = [
      {
        ...rawBase,
        LocationID: 2,
        LocationAbbrev: "PIER",
        LastSaleDate: new Date("1970-01-01T00:00:00Z"),
      },
    ];
    const { inventory } = shredRecordset(recordset as never);
    expect(inventory[0].lastSaleDate).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: FAIL — `shredRecordset` not exported.

- [ ] **Step 3: Implement `shredRecordset` in `src/domains/product/prism-sync.ts`.**

Add this function above `runPrismPull` (around line 170). Define an internal raw-row interface that matches the full SELECT list from Task 5 + Task 6, then map:

```ts
// Raw shape returned by buildPrismPullPageQuery. Matches the SELECT list.
// Labels are still whitespace-padded as returned from Prism's CHAR columns
// — we trim in shredRecordset.
interface PrismPullRecord {
  SKU: number;
  LocationID: number;
  LocationAbbrev: string;
  Description: string | null;
  TypeGm: string | null;
  Size: string | null;
  SizeID: number | null;
  GmColor: number;
  CatalogNumber: string | null;
  PackageType: string | null;
  PackageTypeLabel: string | null;
  UnitsPerPack: number | null;
  GmWeight: number | null;
  ImageURL: string | null;
  OrderIncrement: number;
  UseScaleInterface: 0 | 1;
  Tare: number | null;
  MfgID: number;
  AltVendorID: number;
  Title: string | null;
  Author: string | null;
  ISBN: string | null;
  Edition: string | null;
  BindingID: number | null;
  Imprint: string | null;
  Copyright: string | null;
  UsedSKU: number | null;
  TextStatusID: number | null;
  StatusDate: Date | null;
  TypeTextbook: string | null;
  BookKey: string | null;
  BindingLabel: string | null;
  BarCode: string | null;
  VendorID: number | null;
  DCCID: number | null;
  UsedDCCID: number | null;
  ItemTaxTypeID: number | null;
  ItemTaxTypeLabel: string | null;
  TxComment: string | null;
  ItemWeight: number | null;
  StyleID: number | null;
  ItemSeasonCodeID: number | null;
  fListPriceFlag: 0 | 1;
  fPerishable: 0 | 1;
  fIDRequired: 0 | 1;
  MinOrderQtyItem: number | null;
  ItemType: string;
  fDiscontinue: 0 | 1;
  DeptNum: number | null;
  ClassNum: number | null;
  CatNum: number | null;
  DeptName: string | null;
  ClassName: string | null;
  CatName: string | null;
  Retail: number | null;
  Cost: number | null;
  ExpectedCost: number | null;
  StockOnHand: number | null;
  TagTypeID: number | null;
  TagTypeLabel: string | null;
  StatusCodeID: number | null;
  StatusCodeLabel: string | null;
  TaxTypeOverrideID: number | null;
  InvDiscCodeID: number | null;
  InvMinStock: number | null;
  InvMaxStock: number | null;
  InvAutoOrderQty: number | null;
  InvMinOrderQty: number | null;
  ReservedQty: number | null;
  RentalQty: number | null;
  EstSales: number;
  EstSalesLocked: 0 | 1;
  RoyaltyCost: number | null;
  MinRoyaltyCost: number | null;
  fInvListPriceFlag: 0 | 1;
  fTXWantListFlag: 0 | 1;
  fTXBuybackListFlag: 0 | 1;
  fRentOnly: 0 | 1;
  fNoReturns: 0 | 1;
  TextCommentInv: string | null;
  LastSaleDate: Date | null;
  LastInventoryDate: Date | null;
  InvCreateDate: Date | null;
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

/**
 * Split a Prism recordset (one row per (sku, location_id)) into:
 *   - items: one PrismItemRow per distinct SKU (first occurrence wins).
 *   - inventory: one PrismInventoryRow per input row.
 *
 * Throws if any row carries LocationID 5 (PBO) — the query already filters
 * to IN (2, 3, 4), so this is a belt-and-suspenders defense.
 */
export function shredRecordset(
  recordset: PrismPullRecord[],
): { items: PrismItemRow[]; inventory: PrismInventoryRow[] } {
  const itemsBySku = new Map<number, PrismItemRow>();
  const inventory: PrismInventoryRow[] = [];

  for (const raw of recordset) {
    if (raw.LocationID === 5) {
      throw new Error(
        `LocationID 5 (PBO) encountered in Prism recordset — excluded by hard rule`,
      );
    }
    if (raw.LocationID !== 2 && raw.LocationID !== 3 && raw.LocationID !== 4) {
      throw new Error(
        `Unexpected LocationID ${raw.LocationID} in Pierce pull — expected 2, 3, or 4`,
      );
    }

    if (!itemsBySku.has(raw.SKU)) {
      itemsBySku.set(raw.SKU, {
        sku: raw.SKU,
        description: trimOrNull(raw.Description),
        title: trimOrNull(raw.Title),
        author: trimOrNull(raw.Author),
        isbn: trimOrNull(raw.ISBN),
        edition: trimOrNull(raw.Edition),
        binding_id: raw.BindingID,
        binding_label: trimOrNull(raw.BindingLabel),
        imprint: trimOrNull(raw.Imprint),
        copyright: trimOrNull(raw.Copyright),
        usedSku: raw.UsedSKU,
        textStatusId: raw.TextStatusID,
        statusDate: raw.StatusDate,
        typeTextbook: trimOrNull(raw.TypeTextbook),
        bookKey: trimOrNull(raw.BookKey),
        barcode: trimOrNull(raw.BarCode),
        vendorId: raw.VendorID,
        altVendorId: raw.AltVendorID && raw.AltVendorID > 0 ? raw.AltVendorID : null,
        mfgId: raw.MfgID && raw.MfgID > 0 ? raw.MfgID : null,
        dccId: raw.DCCID,
        usedDccId: raw.UsedDCCID,
        itemTaxTypeId: raw.ItemTaxTypeID,
        itemTaxTypeLabel: trimOrNull(raw.ItemTaxTypeLabel),
        itemType: raw.ItemType,
        fDiscontinue: raw.fDiscontinue === 1 ? 1 : 0,
        txComment: trimOrNull(raw.TxComment),
        weight: raw.ItemWeight != null ? Number(raw.ItemWeight) : null,
        styleId: raw.StyleID,
        itemSeasonCodeId: raw.ItemSeasonCodeID,
        fListPriceFlag: raw.fListPriceFlag === 1 ? 1 : 0,
        fPerishable: raw.fPerishable === 1 ? 1 : 0,
        fIdRequired: raw.fIDRequired === 1 ? 1 : 0,
        minOrderQtyItem: raw.MinOrderQtyItem,
        typeGm: trimOrNull(raw.TypeGm),
        size: trimOrNull(raw.Size),
        sizeId: raw.SizeID,
        catalogNumber: trimOrNull(raw.CatalogNumber),
        packageType: trimOrNull(raw.PackageType),
        packageTypeLabel: trimOrNull(raw.PackageTypeLabel),
        unitsPerPack: raw.UnitsPerPack,
        orderIncrement: raw.OrderIncrement ?? 1,
        imageUrl: trimOrNull(raw.ImageURL),
        useScaleInterface: raw.UseScaleInterface === 1 ? 1 : 0,
        tare: raw.Tare != null ? Number(raw.Tare) : null,
        deptNum: raw.DeptNum,
        classNum: raw.ClassNum,
        catNum: raw.CatNum,
        deptName: trimOrNull(raw.DeptName),
        className: trimOrNull(raw.ClassName),
        catName: trimOrNull(raw.CatName),
      });
    }

    inventory.push({
      sku: raw.SKU,
      locationId: raw.LocationID as 2 | 3 | 4,
      locationAbbrev: (trimOrNull(raw.LocationAbbrev) ?? ""),
      retail: raw.Retail != null ? Number(raw.Retail) : null,
      cost: raw.Cost != null ? Number(raw.Cost) : null,
      expectedCost: raw.ExpectedCost != null ? Number(raw.ExpectedCost) : null,
      stockOnHand: raw.StockOnHand != null ? Number(raw.StockOnHand) : null,
      tagTypeId: raw.TagTypeID,
      tagTypeLabel: trimOrNull(raw.TagTypeLabel),
      statusCodeId: raw.StatusCodeID,
      statusCodeLabel: trimOrNull(raw.StatusCodeLabel),
      taxTypeOverrideId: raw.TaxTypeOverrideID,
      discCodeId: raw.InvDiscCodeID,
      minStock: raw.InvMinStock,
      maxStock: raw.InvMaxStock,
      autoOrderQty: raw.InvAutoOrderQty,
      minOrderQty: raw.InvMinOrderQty,
      holdQty: null, // HoldQty not in current SELECT — add in Task 10 if required by UI
      reservedQty: raw.ReservedQty,
      rentalQty: raw.RentalQty,
      estSales: raw.EstSales,
      estSalesLocked: raw.EstSalesLocked === 1 ? 1 : 0,
      royaltyCost: raw.RoyaltyCost != null ? Number(raw.RoyaltyCost) : null,
      minRoyaltyCost: raw.MinRoyaltyCost != null ? Number(raw.MinRoyaltyCost) : null,
      fInvListPriceFlag: raw.fInvListPriceFlag === 1 ? 1 : 0,
      fTxWantListFlag: raw.fTXWantListFlag === 1 ? 1 : 0,
      fTxBuybackListFlag: raw.fTXBuybackListFlag === 1 ? 1 : 0,
      fRentOnly: raw.fRentOnly === 1 ? 1 : 0,
      fNoReturns: raw.fNoReturns === 1 ? 1 : 0,
      textCommentInv: trimOrNull(raw.TextCommentInv),
      lastSaleDate: coerceEpochZeroDate(raw.LastSaleDate),
      lastInventoryDate: raw.LastInventoryDate,
      createDate: raw.InvCreateDate,
    });
  }

  return { items: Array.from(itemsBySku.values()), inventory };
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: all shred tests PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/domains/product/prism-sync.ts tests/domains/product/prism-sync-shred.test.ts
git commit -m "$(cat <<'EOF'
refactor(products): pure shredRecordset splits Prism rows into two mirrors

Pure function consumed by runPrismPull. Takes a Prism recordset (one
row per (SKU, LocationID)) and returns:
  - items: one PrismItemRow per distinct SKU (global catalog fields)
  - inventory: one PrismInventoryRow per input row (per-location fields)

PBO (LocationID 5) in the recordset throws — belt-and-suspenders on
top of the query-level filter.

Epoch-zero LastSaleDate coercion preserved from the previous sync
path. Trailing-whitespace trimming applied to every denormalized label
column from Prism's CHAR-padded returns.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update `runPrismPull` to upsert both `products` and `product_inventory`

**Files:**
- Modify: `src/domains/product/prism-sync.ts` — `runPrismPull` body (around lines 172-319)

**Purpose:** The existing `runPrismPull` upserts to `products` only. Extend it to call `shredRecordset`, upsert the items map to `products`, and upsert each inventory row to `product_inventory`. Keep the old flat `products.retail_price`/`cost`/`stock_on_hand`/`last_sale_date` columns populated from the PIER slice for UI backwards-compat.

- [ ] **Step 1: Write a failing integration-style test.**

Add to `tests/domains/product/prism-sync-shred.test.ts`:

```ts
import { buildProductsUpsertPayload, buildProductInventoryUpsertPayload } from "@/domains/product/prism-sync";

describe("buildProductsUpsertPayload", () => {
  const baseItem = {
    sku: 123,
    description: "Widget",
    title: null,
    author: null,
    isbn: null,
    edition: null,
    binding_id: null,
    binding_label: null,
    imprint: null,
    copyright: null,
    usedSku: null,
    textStatusId: null,
    statusDate: null,
    typeTextbook: null,
    bookKey: null,
    barcode: "WID100",
    vendorId: 100,
    altVendorId: null,
    mfgId: null,
    dccId: 1010,
    usedDccId: null,
    itemTaxTypeId: 4,
    itemTaxTypeLabel: "STATE",
    itemType: "general_merchandise",
    fDiscontinue: 0 as 0 | 1,
    txComment: null,
    weight: null,
    styleId: null,
    itemSeasonCodeId: null,
    fListPriceFlag: 0 as 0 | 1,
    fPerishable: 0 as 0 | 1,
    fIdRequired: 0 as 0 | 1,
    minOrderQtyItem: null,
    typeGm: null,
    size: null,
    sizeId: null,
    catalogNumber: "WID-100",
    packageType: "EA",
    packageTypeLabel: "Each",
    unitsPerPack: null,
    orderIncrement: 1,
    imageUrl: null,
    useScaleInterface: 0 as 0 | 1,
    tare: null,
    deptNum: 10,
    classNum: 10,
    catNum: 20,
    deptName: "Drinks",
    className: "Bottled",
    catName: "Sodas",
  };

  const basePierInventory = {
    sku: 123,
    locationId: 2 as 2 | 3 | 4,
    locationAbbrev: "PIER",
    retail: 2.99,
    cost: 1.1,
    expectedCost: null,
    stockOnHand: 25,
    tagTypeId: 3,
    tagTypeLabel: "LARGE w/Price/Color",
    statusCodeId: 2,
    statusCodeLabel: "Active",
    taxTypeOverrideId: 2,
    discCodeId: null,
    minStock: null,
    maxStock: null,
    autoOrderQty: null,
    minOrderQty: null,
    holdQty: null,
    reservedQty: null,
    rentalQty: null,
    estSales: 0,
    estSalesLocked: 0 as 0 | 1,
    royaltyCost: null,
    minRoyaltyCost: null,
    fInvListPriceFlag: 1 as 0 | 1,
    fTxWantListFlag: 0 as 0 | 1,
    fTxBuybackListFlag: 0 as 0 | 1,
    fRentOnly: 0 as 0 | 1,
    fNoReturns: 0 as 0 | 1,
    textCommentInv: null,
    lastSaleDate: new Date("2026-04-01T00:00:00Z"),
    lastInventoryDate: null,
    createDate: null,
  };

  it("products payload carries global fields plus the PIER price/stock snapshot", () => {
    const payload = buildProductsUpsertPayload(baseItem, basePierInventory);
    expect(payload.sku).toBe(123);
    expect(payload.description).toBe("Widget");
    expect(payload.item_tax_type_label).toBe("STATE");
    expect(payload.binding_label).toBeNull();
    // Compat fields carry PIER values
    expect(payload.retail_price).toBe(2.99);
    expect(payload.cost).toBe(1.1);
    expect(payload.stock_on_hand).toBe(25);
    expect(payload.last_sale_date).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  it("products payload uses NULL compat fields when no PIER inventory row exists", () => {
    const payload = buildProductsUpsertPayload(baseItem, null);
    expect(payload.retail_price).toBeNull();
    expect(payload.cost).toBeNull();
    expect(payload.stock_on_hand).toBeNull();
    expect(payload.last_sale_date).toBeNull();
  });

  it("product_inventory payload carries all per-location fields", () => {
    const payload = buildProductInventoryUpsertPayload(basePierInventory);
    expect(payload.sku).toBe(123);
    expect(payload.location_id).toBe(2);
    expect(payload.location_abbrev).toBe("PIER");
    expect(payload.retail_price).toBe(2.99);
    expect(payload.tag_type_label).toBe("LARGE w/Price/Color");
    expect(payload.f_inv_list_price_flag).toBe(true);
    expect(payload.f_rent_only).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: FAIL — `buildProductsUpsertPayload` / `buildProductInventoryUpsertPayload` not exported.

- [ ] **Step 3: Add the two payload builders to `src/domains/product/prism-sync.ts`.**

Add above `runPrismPull`:

```ts
/**
 * Build the upsert payload for the products table (global fields + the
 * PIER-compat pricing triad). If `pierInventory` is null, the compat
 * columns are written NULL — the UI's fallback is graceful.
 */
export function buildProductsUpsertPayload(
  item: PrismItemRow,
  pierInventory: PrismInventoryRow | null,
): Record<string, unknown> {
  return {
    sku: item.sku,
    item_type: item.itemType,
    description: item.description,
    title: item.title,
    author: item.author,
    isbn: item.isbn,
    edition: item.edition,
    binding_id: item.binding_id,
    binding_label: item.binding_label,
    imprint: item.imprint,
    copyright: item.copyright,
    used_sku: item.usedSku,
    text_status_id: item.textStatusId,
    status_date: item.statusDate,
    type_textbook: item.typeTextbook,
    book_key: item.bookKey,
    barcode: item.barcode,
    vendor_id: item.vendorId,
    alt_vendor_id: item.altVendorId,
    mfg_id: item.mfgId,
    dcc_id: item.dccId,
    used_dcc_id: item.usedDccId,
    item_tax_type_id: item.itemTaxTypeId,
    item_tax_type_label: item.itemTaxTypeLabel,
    tx_comment: item.txComment,
    weight: item.weight,
    style_id: item.styleId,
    item_season_code_id: item.itemSeasonCodeId,
    f_list_price_flag: !!item.fListPriceFlag,
    f_perishable: !!item.fPerishable,
    f_id_required: !!item.fIdRequired,
    min_order_qty_item: item.minOrderQtyItem,
    type_gm: item.typeGm,
    size: item.size,
    size_id: item.sizeId,
    catalog_number: item.catalogNumber,
    package_type: item.packageType,
    package_type_label: item.packageTypeLabel,
    units_per_pack: item.unitsPerPack,
    order_increment: item.orderIncrement,
    image_url: item.imageUrl,
    use_scale_interface: !!item.useScaleInterface,
    tare: item.tare,
    dept_num: item.deptNum,
    class_num: item.classNum,
    cat_num: item.catNum,
    dept_name: item.deptName,
    class_name: item.className,
    cat_name: item.catName,
    discontinued: item.fDiscontinue === 1,
    // PIER-compat columns (dropped in a later phase once UI cuts over)
    retail_price: pierInventory?.retail ?? null,
    cost: pierInventory?.cost ?? null,
    stock_on_hand: pierInventory?.stockOnHand ?? null,
    last_sale_date: pierInventory?.lastSaleDate ?? null,
    synced_at: new Date().toISOString(),
  };
}

export function buildProductInventoryUpsertPayload(
  inv: PrismInventoryRow,
): Record<string, unknown> {
  return {
    sku: inv.sku,
    location_id: inv.locationId,
    location_abbrev: inv.locationAbbrev,
    retail_price: inv.retail,
    cost: inv.cost,
    expected_cost: inv.expectedCost,
    stock_on_hand: inv.stockOnHand,
    tag_type_id: inv.tagTypeId,
    tag_type_label: inv.tagTypeLabel,
    status_code_id: inv.statusCodeId,
    status_code_label: inv.statusCodeLabel,
    tax_type_override_id: inv.taxTypeOverrideId,
    disc_code_id: inv.discCodeId,
    min_stock: inv.minStock,
    max_stock: inv.maxStock,
    auto_order_qty: inv.autoOrderQty,
    min_order_qty: inv.minOrderQty,
    hold_qty: inv.holdQty,
    reserved_qty: inv.reservedQty,
    rental_qty: inv.rentalQty,
    est_sales: inv.estSales,
    est_sales_locked: !!inv.estSalesLocked,
    royalty_cost: inv.royaltyCost,
    min_royalty_cost: inv.minRoyaltyCost,
    f_inv_list_price_flag: !!inv.fInvListPriceFlag,
    f_tx_want_list_flag: !!inv.fTxWantListFlag,
    f_tx_buyback_list_flag: !!inv.fTxBuybackListFlag,
    f_rent_only: !!inv.fRentOnly,
    f_no_returns: !!inv.fNoReturns,
    text_comment_inv: inv.textCommentInv,
    last_sale_date: inv.lastSaleDate,
    last_inventory_date: inv.lastInventoryDate,
    create_date: inv.createDate,
    synced_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: PASS.

- [ ] **Step 5: Rewire `runPrismPull` to call `shredRecordset` and upsert to both tables.**

The main per-page loop in `runPrismPull` (starting around line 189) currently builds a single `toUpsert` array of flat rows and writes them with `supabase.from("products").upsert(toUpsert)`. Replace that with:

```ts
    const { items, inventory } = shredRecordset(result.recordset);

    // Index inventory by sku for PIER-compat column lookup
    const invBySku = new Map<number, PrismInventoryRow>();
    for (const inv of inventory) {
      seenSkus.add(inv.sku);
      if (inv.locationId === 2) invBySku.set(inv.sku, inv);
    }

    // Upsert global product rows first (FK target for product_inventory)
    const productsUpsert = items.map((item) =>
      buildProductsUpsertPayload(item, invBySku.get(item.sku) ?? null),
    );
    if (productsUpsert.length > 0) {
      const { error: prodErr } = await supabase
        .from("products")
        .upsert(productsUpsert, { onConflict: "sku" });
      if (prodErr) throw new Error(`Supabase products upsert failed: ${prodErr.message}`);
    }

    // Then per-location inventory rows
    const inventoryUpsert = inventory.map(buildProductInventoryUpsertPayload);
    if (inventoryUpsert.length > 0) {
      const { error: invErr } = await supabase
        .from("product_inventory")
        .upsert(inventoryUpsert, { onConflict: "sku,location_id" });
      if (invErr) throw new Error(`Supabase product_inventory upsert failed: ${invErr.message}`);
    }

    scanned += result.recordset.length;
    updated += productsUpsert.length + inventoryUpsert.length;

    // Advance cursor to (last SKU, last LocationID) in this page
    const lastRow = result.recordset[result.recordset.length - 1];
    lastSku = lastRow.SKU;
    lastLoc = lastRow.LocationID;

    if (options.onProgress) options.onProgress(scanned);
```

Also:
- Add a `let lastLoc = 0;` alongside `let lastSku = 0;` before the while loop.
- Add `.input("lastLoc", sql.Int, lastLoc)` next to the existing `.input("cursor", ...)` when running the query.
- Update the raw-row type annotation inside the pool request to match `PrismPullRecord`.

- [ ] **Step 6: Run the test suite.**

```bash
npx vitest run
```

Expected: all tests PASS. Fix any TypeScript errors surfaced by the type changes (the old raw-row interface lookup sites should all be replaced now).

- [ ] **Step 7: Lint + typecheck.**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 8: Commit.**

```bash
git add src/domains/product/prism-sync.ts tests/domains/product/prism-sync-shred.test.ts
git commit -m "$(cat <<'EOF'
feat(products): sync writes to both products and product_inventory

runPrismPull now:
  1. Pulls the paginated Prism recordset (one row per SKU×location).
  2. Shreds via shredRecordset into global items + per-location inventory.
  3. Upserts products first (FK target).
  4. Upserts product_inventory with (sku, location_id) as onConflict.

The PIER slice of retail/cost/stock/last_sale_date is denormalized into
products for UI backwards-compat until the UI reads from
product_inventory directly in a later phase. No UI-visible behavior
change this phase — the mirror has new rows, same old surface.

Pagination cursor advanced to (sku, locationId) so a page boundary in
the middle of a SKU's 2-3 location rows doesn't drop the tail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Extend reap logic to per-location inventory rows

**Files:**
- Modify: `src/domains/product/prism-sync.ts` — `loadExistingHashes` + reap section (around lines 260-319)

**Purpose:** Today's reap logic deletes `products` rows not seen this run. With `product_inventory`, we also need to delete `(sku, location_id)` rows not seen — because a SKU may stop being stocked at PCOP while remaining at PIER. The `products` reap still fires when a SKU has zero inventory rows across all Pierce locations.

- [ ] **Step 1: Write a failing unit test for the reap-set computation.**

Add to `tests/domains/product/prism-sync-shred.test.ts`:

```ts
import { computeReapSet } from "@/domains/product/prism-sync";

describe("computeReapSet", () => {
  it("returns product_inventory rows that existed before but not in this run", () => {
    const existingInventory = new Set<string>([
      "1:2", "1:3", "2:2", "3:2", "3:4",
    ]);
    const seenInventory = new Set<string>([
      "1:2", "1:3", "2:2", "3:2", // 3:4 gone
    ]);
    const { inventoryToDelete, skusWithNoLocations } = computeReapSet(
      existingInventory,
      seenInventory,
    );
    expect(Array.from(inventoryToDelete).sort()).toEqual(["3:4"]);
    expect(Array.from(skusWithNoLocations)).toEqual([]);
  });

  it("flags SKUs for products reap when all locations are gone", () => {
    const existingInventory = new Set<string>(["5:2", "5:3"]);
    const seenInventory = new Set<string>();
    const { inventoryToDelete, skusWithNoLocations } = computeReapSet(
      existingInventory,
      seenInventory,
    );
    expect(Array.from(inventoryToDelete).sort()).toEqual(["5:2", "5:3"]);
    expect(Array.from(skusWithNoLocations)).toEqual([5]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: FAIL — `computeReapSet` not exported.

- [ ] **Step 3: Implement `computeReapSet`.**

Add to `src/domains/product/prism-sync.ts`:

```ts
/**
 * Given the set of (sku:location) keys that existed in product_inventory
 * before this run and the set observed during this run, return:
 *   - inventoryToDelete: (sku:location) keys to DELETE from product_inventory
 *   - skusWithNoLocations: SKUs that are now orphaned (zero remaining Pierce
 *     inventory rows); products rows should also be reaped.
 */
export function computeReapSet(
  existing: Set<string>,
  seen: Set<string>,
): { inventoryToDelete: Set<string>; skusWithNoLocations: Set<number> } {
  const inventoryToDelete = new Set<string>();
  for (const key of existing) {
    if (!seen.has(key)) inventoryToDelete.add(key);
  }

  // Build per-SKU remaining-locations count from the surviving set
  const remainingBySku = new Map<number, number>();
  const noteKey = (key: string) => {
    const [skuStr] = key.split(":");
    const sku = Number(skuStr);
    remainingBySku.set(sku, (remainingBySku.get(sku) ?? 0) + 1);
  };
  for (const key of existing) {
    if (!inventoryToDelete.has(key)) noteKey(key);
  }

  // SKUs that had rows in existing but have zero surviving locations
  const skusWithNoLocations = new Set<number>();
  const skusInExisting = new Set<number>();
  for (const key of existing) {
    skusInExisting.add(Number(key.split(":")[0]));
  }
  for (const sku of skusInExisting) {
    if ((remainingBySku.get(sku) ?? 0) === 0) {
      skusWithNoLocations.add(sku);
    }
  }

  return { inventoryToDelete, skusWithNoLocations };
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

```bash
npx vitest run tests/domains/product/prism-sync-shred.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add a loader for existing product_inventory keys alongside `loadExistingHashes`.**

In `src/domains/product/prism-sync.ts`, add:

```ts
async function loadExistingInventoryKeys(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<Set<string>> {
  const keys = new Set<string>();
  let from = 0;
  while (true) {
    const to = from + HASH_READ_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("product_inventory")
      .select("sku, location_id")
      .order("sku", { ascending: true })
      .order("location_id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Supabase product_inventory read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      keys.add(`${(r as { sku: number }).sku}:${(r as { location_id: number }).location_id}`);
    }
    if (data.length < HASH_READ_PAGE_SIZE) break;
    from += HASH_READ_PAGE_SIZE;
  }
  return keys;
}
```

- [ ] **Step 6: Wire the reap into `runPrismPull`.**

Before `runPrismPull` returns, add:

```ts
  // Accumulate seen (sku:location) keys as we walk pages
  // (move this inside the per-page loop — push the composite key when we
  // upsert a product_inventory row)
  // seenInventoryKeys is populated earlier: seenInventoryKeys.add(`${inv.sku}:${inv.locationId}`) for every shredded inv row.

  const existingInventoryKeys = await loadExistingInventoryKeys(supabase);
  const { inventoryToDelete, skusWithNoLocations } = computeReapSet(
    existingInventoryKeys,
    seenInventoryKeys,
  );

  let removed = 0;
  if (inventoryToDelete.size > 0) {
    const keys = Array.from(inventoryToDelete);
    for (let i = 0; i < keys.length; i += DELETE_CHUNK_SIZE) {
      const chunk = keys.slice(i, i + DELETE_CHUNK_SIZE);
      // DELETE one row at a time via composite match — a bulk IN-tuple
      // isn't supported by the supabase-js builder. Batch by chunks.
      const { error: delErr, count } = await supabase
        .from("product_inventory")
        .delete({ count: "exact" })
        .or(chunk.map((k) => {
          const [sku, loc] = k.split(":");
          return `and(sku.eq.${sku},location_id.eq.${loc})`;
        }).join(","));
      if (delErr) throw new Error(`product_inventory reap failed: ${delErr.message}`);
      removed += count ?? chunk.length;
    }
  }

  if (skusWithNoLocations.size > 0) {
    const skus = Array.from(skusWithNoLocations);
    for (let i = 0; i < skus.length; i += DELETE_CHUNK_SIZE) {
      const chunk = skus.slice(i, i + DELETE_CHUNK_SIZE);
      const { error: delErr, count } = await supabase
        .from("products")
        .delete({ count: "exact" })
        .in("sku", chunk);
      if (delErr) throw new Error(`products reap failed: ${delErr.message}`);
      removed += count ?? chunk.length;
    }
  }
```

Also: at the top of the function, declare `const seenInventoryKeys = new Set<string>();`, and inside the per-page loop just after shredding, push every `inv` row's composite key into that set.

- [ ] **Step 7: Run the full test suite.**

```bash
npx vitest run
```

Expected: PASS. Fix any TS/lint errors.

- [ ] **Step 8: Commit.**

```bash
git add src/domains/product/prism-sync.ts tests/domains/product/prism-sync-shred.test.ts
git commit -m "$(cat <<'EOF'
feat(products): reap per-location inventory rows that drop out of Prism

computeReapSet takes the (sku, location_id) keys that existed before
the sync and the ones observed during this run, returns the deletes.
SKUs with zero surviving Pierce inventory rows have their products row
reaped too — same behavior as before, extended to the per-location
dimension.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: End-to-end smoke against dev Supabase

**Files:**
- No code changes. Operational verification only.

**Purpose:** Before committing Phase 1 to production, run the full sync against dev Supabase and verify the new mirror shape. Read-only on Prism; writes to dev Supabase only.

- [ ] **Step 1: Confirm dev env is targeting dev Supabase.**

```bash
grep -E "^(NEXT_PUBLIC_SUPABASE_URL|DATABASE_URL)" .env.local | head -5
```

Expected: Supabase URL points to the dev project `wzhuuhxzxrzyasxvuagb` (per `reference_laportal_supabase_ownership.md`), not prod.

- [ ] **Step 2: Start the dev server and trigger a sync from the UI.**

```bash
npm run dev
```

In a browser, log in → Products page → click "Sync Database" (`SyncDatabaseButton`). Watch the console and network tabs for errors.

- [ ] **Step 3: Verify the row counts in Supabase.**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT 'products' AS t, COUNT(*) AS n FROM products
UNION ALL
SELECT 'inventory_pier', COUNT(*) FROM product_inventory WHERE location_id = 2
UNION ALL
SELECT 'inventory_pcop', COUNT(*) FROM product_inventory WHERE location_id = 3
UNION ALL
SELECT 'inventory_pfs',  COUNT(*) FROM product_inventory WHERE location_id = 4
UNION ALL
SELECT 'inventory_pbo',  COUNT(*) FROM product_inventory WHERE location_id = 5;
SQL
```

Expected:
- `products` count ≥ the combined unique-SKU count seen at any Pierce location (ballpark ~70k).
- `inventory_pier` ≈ 52k (per the 2026-04-19 snapshot's Inventory-at-PIER count for PIER).
- `inventory_pcop` ≈ 18k.
- `inventory_pfs` ≈ 18k.
- `inventory_pbo` = **0** (hard rule).

- [ ] **Step 4: Spot-check labels are populated.**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT sku, tag_type_id, tag_type_label, status_code_id, status_code_label
FROM product_inventory
WHERE tag_type_id IS NOT NULL
LIMIT 10;
SQL
```

Expected: 10 rows, each with a populated `tag_type_label` (e.g., "LARGE w/Price/Color", "BIN LABELS no Price").

```bash
npx prisma db execute --stdin <<'SQL'
SELECT sku, item_tax_type_id, item_tax_type_label, binding_id, binding_label
FROM products
WHERE item_tax_type_label IS NOT NULL
LIMIT 10;
SQL
```

Expected: labels like "STATE", "NOT TAXABLE", etc.

- [ ] **Step 5: Verify FK cascade integrity.**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT COUNT(*) AS orphans
FROM product_inventory pi
LEFT JOIN products p ON p.sku = pi.sku
WHERE p.sku IS NULL;
SQL
```

Expected: `orphans = 0`. If any, the products upsert is failing for some rows and needs investigation before proceeding.

- [ ] **Step 6: Verify sync is idempotent (re-run produces no changes).**

Click "Sync Database" again. Row counts should be stable; the `sync_runs` history row should show `updated = 0` or near-zero (only rows whose hash changed during Prism POS activity since the last run).

- [ ] **Step 7: Document results in a commit message on a docs-only touch.**

Create a small note in `docs/prism/phase-1-verification-2026-04-19.md` (no existing docs; this is the record):

```markdown
# Phase 1 verification — 2026-04-19

**Branch:** feat/item-editor-parity
**Scope:** product_inventory split + multi-location sync

## Observed row counts (dev Supabase post-sync)

| Table | Count |
|---|---:|
| products | {fill in} |
| product_inventory @ PIER (2) | {fill in} |
| product_inventory @ PCOP (3) | {fill in} |
| product_inventory @ PFS  (4) | {fill in} |
| product_inventory @ PBO  (5) | **0** (expected) |

## Label coverage

Sampled 10 rows from each ref-table join; all populated.

## FK integrity

Zero orphan product_inventory rows (good).

## Idempotency

Re-run of Sync Database after first pass: `updated = 0` on the sync_runs row.

## Next phase

Phase 2 — expand /api/products/refs to return labeled TagType, StatusCode,
PackageType, Color, Binding in addition to the existing Vendor/DCC/TaxType.
```

- [ ] **Step 8: Commit.**

```bash
git add docs/prism/phase-1-verification-2026-04-19.md
git commit -m "$(cat <<'EOF'
docs(products): Phase 1 verification notes

Observed row counts, label coverage, FK integrity, and idempotency from
the dev-Supabase sync after the schema split.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Ship

**Files:**
- No code changes.

- [ ] **Step 1: Run the full ship-check.**

```bash
npm run ship-check
```

Expected: lint + tests + build all green; ship-check stamp written to `.git/laportal/ship-check.env` matching HEAD.

- [ ] **Step 2: Push the branch.**

```bash
git push
```

(If any pre-push hooks complain and the user has authorized bypass, `--no-verify` is acceptable; otherwise resolve the hook.)

- [ ] **Step 3: Open the PR.**

```bash
gh pr create --fill --base main --head feat/item-editor-parity
```

Or if the publish-pr script gate accepts the stamps:

```bash
npm run git:publish-pr
```

Title the PR `feat(products): Phase 1 — schema split + PIER+PCOP+PFS sync`.

- [ ] **Step 4: Let CI + CodeRabbit review. Address feedback with `CR_FIX=1 git push` for review fixes, per the project's PR workflow.**

- [ ] **Step 5: Merge when green. The branch stays open for Phase 2 planning — do NOT delete it. Phase 2 will open a new branch from fresh main.**

---

## Self-review checklist

**Spec coverage:**
- ✅ Schema split into products + product_inventory — Tasks 1–3.
- ✅ Migration backfills PIER data — Task 3.
- ✅ LocationID IN (2, 3, 4) sync filter — Task 5.
- ✅ PBO (5) excluded by CHECK constraint + runtime assertion — Tasks 1 + 7.
- ✅ Ref-table label joins (TagType, Item_Tax_Type, PackageType, Status, Binding, Location) — Tasks 5, 6.
- ✅ Shred logic + payload builders — Tasks 7, 8.
- ✅ Reap extended to per-location rows + orphan cleanup — Task 9.
- ✅ End-to-end verification — Task 10.
- ⏸ Deferred to Phase 1c (later plan): dropping the old flat columns on products (retail_price, cost, stock_on_hand, last_sale_date) once Phase 3 moves the UI to read from product_inventory.

**Placeholder scan:**
- `{StatusTable}` and `{BindingTable}` in Task 6 Step 3 are explicit placeholders with clear substitution instructions ("replace with the discovered names"). This is a discovery-driven step by design — acceptable per the "No Placeholders" rule because the code above gives the exact pattern to substitute.
- Task 10 has `{fill in}` in the verification note — these are for the engineer to fill with real numbers after running the sync. Acceptable because the note is a record of Phase 1's actual results, not a template.

**Type consistency:**
- `PrismItemRow`, `PrismInventoryRow`, `PrismPullRecord` — all use consistent camelCase on the TS side and are consistently mapped to snake_case Supabase columns in the payload builders (Task 8).
- Location type narrowed to `2 | 3 | 4` throughout; no drift.
- Label column naming consistent: `tag_type_label`, `status_code_label`, `package_type_label`, `item_tax_type_label`, `binding_label`.

No inconsistencies found on self-review.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-item-editor-parity-phase-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
