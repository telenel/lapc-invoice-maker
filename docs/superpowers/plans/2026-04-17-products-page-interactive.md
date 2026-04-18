# Products Page Interactive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/products` into a workspace with 22 one-click deterministic presets, user-saved views, DCC + stock + Prism EstSales columns, and a Pierce-assurance badge.

**Architecture:** Extend the Prism → Supabase pull sync to also carry DCC names + `Inventory_EstSales` fields. Extend the `products` mirror with new nullable columns. Extend `saved_searches` to hold both system presets and user views, plus their column preferences. Surface it all via new UI components on the products page; filtering is still client-side via the existing `searchProducts` function against Supabase (PostgREST).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma 7 + Supabase Postgres, `mssql` (Prism), `zod`, shadcn/ui, Tailwind, Vitest, Playwright.

**Design spec:** `docs/superpowers/specs/2026-04-17-products-page-interactive-design.md`. Read before starting. This plan implements it.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `prisma/migrations/<TS>_products_dcc_and_est_sales/migration.sql` | Adds dept/class/cat nums + names and EstSales columns to `products`; creates helper indexes. |
| `prisma/migrations/<TS>_saved_searches_presets_schema/migration.sql` | Adds `description`, `column_preferences`, `slug`, `preset_group`, `sort_order` + partial unique indexes to `saved_searches`. Backfills legacy bulk-edit rows. |
| `prisma/migrations/<TS>_seed_products_page_presets/migration.sql` | Inserts the 22 system presets with `ON CONFLICT (slug) DO UPDATE`. |
| `src/domains/product/presets.ts` | Typed constant describing the 22 system presets (used by seed generator + fallback). |
| `src/domains/product/view-serializer.ts` | Pure: `serializeFiltersToUrl`, `parseFiltersFromParams`, `applyPreset`. |
| `src/domains/product/views-api.ts` | Client helpers: `listViews`, `saveView`, `deleteView`. |
| `src/app/api/products/views/route.ts` | `GET` + `POST` handlers. |
| `src/app/api/products/views/[id]/route.ts` | `DELETE` handler. |
| `src/app/api/products/dcc-list/route.ts` | `GET` handler. |
| `src/components/products/saved-views-bar.tsx` | Chip row with system presets + user views + "+ Save View". |
| `src/components/products/save-view-dialog.tsx` | Name + description dialog for POSTing a user view. |
| `src/components/products/delete-view-dialog.tsx` | Confirm modal for deleting a user view. |
| `src/components/products/column-visibility-toggle.tsx` | Popover with column checklist. |
| `src/components/products/dcc-picker.tsx` | Typeahead combobox for DCC numeric/name lookup. |
| `src/components/products/pierce-assurance-badge.tsx` | Sync-status dot + a11y text. |
| `src/components/products/product-filters-extended.tsx` | New sub-sections: Stock, DCC, Data Quality, Activity, Margin. |
| `tests/domains/product/view-serializer.test.ts` | Unit tests for filter ↔ URL ↔ preset merge. |
| `tests/domains/product/presets-predicates.test.ts` | Each of the 22 presets evaluated against a fixture. |
| `tests/domains/product/margin-bucketing.test.ts` | Margin computation including retail=0. |
| `tests/app/api/products-views-route.test.ts` | Views API auth + CRUD. |
| `tests/app/api/products-dcc-list-route.test.ts` | DCC list API. |
| `tests/e2e/products-interactive.spec.ts` | Playwright E2E: preset click + save view + keyboard nav. |
| `scripts/test-prism-sync-dcc-estsales.ts` | Live Prism: verify the new columns populate correctly. |

### Modified files

| Path | What changes |
|---|---|
| `prisma/schema.prisma` | Add `description`, `columnPreferences`, `slug`, `presetGroup`, `sortOrder` to `SavedSearch`. |
| `src/domains/product/types.ts` | Extend `Product` with new columns; extend `ProductFilters` with the 10 new filter keys; add `SavedView`, `ColumnPreferences`, `PresetGroup` types. |
| `src/domains/product/constants.ts` | Extend `EMPTY_FILTERS` with defaults for new keys; add `OPTIONAL_COLUMNS`, `DEFAULT_COLUMN_SET`, `PRESET_GROUPS`. |
| `src/domains/product/queries.ts` | Extend `searchProducts` to translate the new filter keys. |
| `src/domains/product/prism-sync.ts` | Extend SELECT with DCC joins + `Inventory_EstSales` subquery; extend `PrismItemRow`, `hashRow`, upsert payload. |
| `src/components/products/product-filters.tsx` | Embed the new extended sub-sections. |
| `src/components/products/product-table.tsx` | Add optional columns: Stock, DCC, Est. sales, Margin %, Days since sale, Updated. Gate visibility on `visibleColumns` prop. |
| `src/app/products/page.tsx` | Wire `SavedViewsBar`, `ColumnVisibilityToggle`, `PierceAssuranceBadge`; carry `visibleColumns` state with `localStorage` + preset-override semantics. |
| `scripts/test-prism-sync-classification.ts` | Extend assertions for the new columns (supplements the dedicated script above). |

---

## Tech context (read before Task 1)

- **Repo root:** `C:\Users\MONTALMA2\code\laportal` (Git Bash; forward slashes in paths).
- **Branch:** `feat/products-interactive` (already created at `6b551f0` holding the spec commit).
- **Prisma migration command:** Raw SQL migration under `prisma/migrations/<TS>_<name>/migration.sql`. The `products` table is NOT in `schema.prisma` (it's admin-client-only) — only `saved_searches` has a Prisma model. `SavedSearch` model updates go in `schema.prisma`; `products` DDL is raw SQL only. Run `npx prisma generate` after editing `schema.prisma` (no `migrate dev` from LACCD — prod applies on deploy).
- **Migration timestamp format:** 14-digit UTC `YYYYMMDDHHMMSS`. Use `date -u +%Y%m%d%H%M%S` to generate; pick once per migration, not per task.
- **Vitest:** `npm test -- <path>` runs one file, non-watch. `npm test` runs all.
- **Ship-check:** `npm run ship-check` must stay green before push. Requires clean tree.
- **Auth wrappers:** `withAuth` (any authenticated user), `withAdmin` (admin-only). Imported from `@/domains/shared/auth`. Views API uses `withAuth`; seed/DDL is migration-time.
- **Client queries:** `searchProducts` in `src/domains/product/queries.ts` runs CLIENT-SIDE via the Supabase browser client + PostgREST (not through a Next.js route). The filter translator lives there.
- **Commit style:** Conventional commits with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- **Do NOT** push to remote or run ship-check unless the step explicitly says to.
- **Do NOT** weaken Pierce-only scoping. `Inventory_EstSales` subquery uses `LocationID = 2`.

---

## Phase A — Schema migrations (products mirror + saved_searches)

### Task 1: Products mirror columns migration

**Files:**
- Create: `prisma/migrations/<TS>_products_dcc_and_est_sales/migration.sql`

- [ ] **Step 1: Generate timestamp**

Run: `date -u +%Y%m%d%H%M%S`
Capture the output (e.g. `20260417230000`). Use it as `<TS>` below. Create the directory `prisma/migrations/<TS>_products_dcc_and_est_sales/`.

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/<TS>_products_dcc_and_est_sales/migration.sql` with:

```sql
-- Add DCC classification (numeric triple + names) and Inventory_EstSales-derived
-- velocity estimates to the products mirror. All columns nullable so sync can
-- backfill incrementally and rows with no classification degrade cleanly.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "dept_num"           SMALLINT,
  ADD COLUMN IF NOT EXISTS "class_num"          SMALLINT,
  ADD COLUMN IF NOT EXISTS "cat_num"            SMALLINT,
  ADD COLUMN IF NOT EXISTS "dept_name"          TEXT,
  ADD COLUMN IF NOT EXISTS "class_name"         TEXT,
  ADD COLUMN IF NOT EXISTS "cat_name"           TEXT,
  ADD COLUMN IF NOT EXISTS "one_year_sales"     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "look_back_sales"    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "sales_to_avg_ratio" NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS "est_sales_calc"     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "est_sales_prev"     NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS products_dcc_num_idx
  ON "products" ("dept_num", "class_num", "cat_num");

CREATE INDEX IF NOT EXISTS products_est_sales_calc_idx
  ON "products" ("est_sales_calc");
```

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/<TS>_products_dcc_and_est_sales/
git commit -m "$(cat <<'EOF'
feat(products): add DCC and EstSales columns to mirror

Adds nullable classification triple (dept/class/cat nums + names) and
Prism-derived velocity fields (one_year_sales, look_back_sales,
sales_to_avg_ratio, est_sales_calc, est_sales_prev). Indexes on the
DCC triple and est_sales_calc for preset filtering + column sort.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: saved_searches extension migration

**Files:**
- Create: `prisma/migrations/<TS>_saved_searches_presets_schema/migration.sql`

- [ ] **Step 1: Generate new timestamp**

Run: `date -u +%Y%m%d%H%M%S`. Capture as `<TS>`; it MUST be later than Task 1's timestamp.

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/<TS>_saved_searches_presets_schema/migration.sql` with:

```sql
-- Extend saved_searches so one table holds both system presets (is_system=true)
-- and per-user saved views (is_system=false). Add slug for stable URL refs on
-- system presets, preset_group for UI bucketing, sort_order for display order,
-- column_preferences to bundle which columns a preset reveals, and description
-- for user-facing help text.

ALTER TABLE "saved_searches"
  ADD COLUMN IF NOT EXISTS "description"         TEXT,
  ADD COLUMN IF NOT EXISTS "column_preferences"  JSONB,
  ADD COLUMN IF NOT EXISTS "slug"                TEXT,
  ADD COLUMN IF NOT EXISTS "preset_group"        TEXT,
  ADD COLUMN IF NOT EXISTS "sort_order"          SMALLINT;

-- Stable slug identity for system presets (partial index; user views have NULL).
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_slug_unique
  ON "saved_searches" ("slug") WHERE "slug" IS NOT NULL;

-- Per-user view names must be unique for that user. System rows (owner NULL)
-- are excluded from this constraint by the partial predicate.
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_owner_name_unique
  ON "saved_searches" ("owner_user_id", "name") WHERE "owner_user_id" IS NOT NULL;

-- Backfill the four legacy bulk-edit rows seeded by migration
-- 20260417000002. They belong to the bulk-edit workspace, not the products
-- page, so scope them with preset_group='legacy-bulk-edit' and give each a
-- deterministic slug so the unique index holds going forward.
UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-textbooks'
WHERE "is_system" = true AND "name" = 'All textbooks' AND "slug" IS NULL;

UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-no-barcode'
WHERE "is_system" = true AND "name" = 'Items without barcode' AND "slug" IS NULL;

UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-vendor-21'
WHERE "is_system" = true AND "name" = 'Items from vendor 21 (PENS ETC)' AND "slug" IS NULL;

UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-gm-under-5'
WHERE "is_system" = true AND "name" = 'General Merchandise — under $5' AND "slug" IS NULL;
```

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/<TS>_saved_searches_presets_schema/
git commit -m "$(cat <<'EOF'
feat(products): extend saved_searches for system presets + user views

Adds slug, preset_group, sort_order, column_preferences, description
columns. Partial unique indexes on slug (system presets) and
(owner_user_id, name) (user views). Backfills legacy bulk-edit rows
with preset_group='legacy-bulk-edit' so the products page view API can
scope them out cleanly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update Prisma schema for SavedSearch

**Files:**
- Modify: `prisma/schema.prisma` (SavedSearch model, lines 661–673)

- [ ] **Step 1: Add the new fields**

Edit the `SavedSearch` model to match the new columns. Replace the existing block (currently lines 661–673) with:

```prisma
model SavedSearch {
  id                 String    @id @default(uuid())
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  ownerUserId        String?   @map("owner_user_id")
  name               String
  filter             Json
  isSystem           Boolean   @default(false) @map("is_system")
  description        String?
  columnPreferences  Json?     @map("column_preferences")
  slug               String?
  presetGroup        String?   @map("preset_group")
  sortOrder          Int?      @map("sort_order") @db.SmallInt

  owner         User?     @relation(fields: [ownerUserId], references: [id])

  @@index([ownerUserId, name])
  @@map("saved_searches")
}
```

- [ ] **Step 2: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client` in output, no errors.

- [ ] **Step 3: Verify the generated types include the new fields**

Run: `grep -l columnPreferences src/generated/prisma/models/SavedSearch.ts`
Expected: the file path is printed (grep found the field).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/generated/prisma/
git commit -m "$(cat <<'EOF'
chore(prisma): regenerate client for SavedSearch preset fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Prism sync extensions

### Task 4: Extend PrismItemRow and hashRow

**Files:**
- Modify: `src/domains/product/prism-sync.ts`

- [ ] **Step 1: Extend `PrismItemRow` interface**

Locate the `PrismItemRow` interface (starts around line 24). Append the new fields at the end of the interface, keeping existing fields unchanged:

```ts
  deptNum: number | null;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
  oneYearSales: number | null;
  lookBackSales: number | null;
  salesToAvgRatio: number | null;
  estSalesCalc: number | null;
  estSalesPrev: number | null;
```

- [ ] **Step 2: Extend `hashRow` to include new fields**

In the `hashRow` function (starts at line 43), append these entries to the `canonical` array before `r.lastSaleDate?.toISOString() ?? ""`:

```ts
    r.deptNum ?? 0,
    r.classNum ?? 0,
    r.catNum ?? 0,
    r.deptName ?? "",
    r.className ?? "",
    r.catName ?? "",
    r.oneYearSales ?? 0,
    r.lookBackSales ?? 0,
    r.salesToAvgRatio ?? 0,
    r.estSalesCalc ?? 0,
    r.estSalesPrev ?? 0,
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/prism-sync.ts
git commit -m "$(cat <<'EOF'
feat(products): extend PrismItemRow shape for DCC + EstSales

Pure type + hash changes; SQL read and upsert payload still emit the
original shape until the next task wires them up. Keeps diff bisectable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Extend the Prism SELECT + upsert payload

**Files:**
- Modify: `src/domains/product/prism-sync.ts`

- [ ] **Step 1: Extend the typed SELECT record type**

Inside `runPrismPull`, the `.query<{ SKU: number; ... LastSaleDate: Date | null; }>(...)` generic lists the columns. Append the new column types after `LastSaleDate`:

```ts
          DeptNum: number | null;
          ClassNum: number | null;
          CatNum: number | null;
          DeptName: string | null;
          ClassName: string | null;
          CatName: string | null;
          OneYearSales: number | null;
          LookBackSales: number | null;
          SalesToAvgRatio: number | null;
          EstSalesCalc: number | null;
          EstSalesPrev: number | null;
```

- [ ] **Step 2: Extend the SQL query**

Replace the SQL string in `.query<...>(\`...\`)` with the extended form. Insert the new SELECT columns just before `i.fDiscontinue,` and add the new JOINs right before `WHERE i.SKU > @cursor`:

```sql
SELECT TOP (@pageSize)
  i.SKU,
  LTRIM(RTRIM(gm.Description)) AS Description,
  LTRIM(RTRIM(tb.Title))       AS Title,
  LTRIM(RTRIM(tb.Author))      AS Author,
  LTRIM(RTRIM(tb.ISBN))        AS ISBN,
  LTRIM(RTRIM(tb.Edition))     AS Edition,
  LTRIM(RTRIM(i.BarCode))      AS BarCode,
  i.VendorID,
  i.DCCID,
  i.ItemTaxTypeID,
  CASE
    WHEN i.TypeID = 2                THEN 'used_textbook'
    WHEN tb.SKU IS NOT NULL          THEN 'textbook'
    WHEN gm.SKU IS NOT NULL          THEN 'general_merchandise'
    ELSE                                  'other'
  END AS ItemType,
  dcc.Department                AS DeptNum,
  dcc.Class                     AS ClassNum,
  dcc.Category                  AS CatNum,
  LTRIM(RTRIM(dep.Name))        AS DeptName,
  LTRIM(RTRIM(cls.Name))        AS ClassName,
  LTRIM(RTRIM(cat.Name))        AS CatName,
  i.fDiscontinue,
  inv.Retail,
  inv.Cost,
  inv.StockOnHand,
  inv.LastSaleDate,
  es.OneYearSales               AS OneYearSales,
  es.LookBackSales              AS LookBackSales,
  es.SalesToAvgSalesRatio       AS SalesToAvgRatio,
  es.EstSalesCalc               AS EstSalesCalc,
  esPrev.EstSalesCalc           AS EstSalesPrev
FROM Item i
INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
LEFT JOIN Textbook tb ON tb.SKU = i.SKU
LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department
                             AND dcc.Class      = cls.Class
LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department
                             AND dcc.Class      = cat.Class
                             AND dcc.Category   = cat.Category
LEFT JOIN (
  SELECT es.SKU, es.OneYearSales, es.LookBackSales,
         es.SalesToAvgSalesRatio, es.EstSalesCalc,
         ROW_NUMBER() OVER (PARTITION BY es.SKU
                            ORDER BY es.CalculationDate DESC) AS rn
  FROM Inventory_EstSales es
  WHERE es.LocationID = @loc
) es     ON es.SKU = i.SKU     AND es.rn = 1
LEFT JOIN (
  SELECT es.SKU, es.EstSalesCalc,
         ROW_NUMBER() OVER (PARTITION BY es.SKU
                            ORDER BY es.CalculationDate DESC) AS rn
  FROM Inventory_EstSales es
  WHERE es.LocationID = @loc
) esPrev ON esPrev.SKU = i.SKU AND esPrev.rn = 2
WHERE i.SKU > @cursor
ORDER BY i.SKU
```

- [ ] **Step 2: Extend row mapping**

In the `for (const raw of result.recordset)` block, after the existing field assignments inside `const row: PrismItemRow = { ... }`, append:

```ts
        deptNum: raw.DeptNum,
        classNum: raw.ClassNum,
        catNum: raw.CatNum,
        deptName: raw.DeptName && raw.DeptName.length > 0 ? raw.DeptName : null,
        className: raw.ClassName && raw.ClassName.length > 0 ? raw.ClassName : null,
        catName: raw.CatName && raw.CatName.length > 0 ? raw.CatName : null,
        oneYearSales: raw.OneYearSales != null ? Number(raw.OneYearSales) : null,
        lookBackSales: raw.LookBackSales != null ? Number(raw.LookBackSales) : null,
        salesToAvgRatio: raw.SalesToAvgRatio != null ? Number(raw.SalesToAvgRatio) : null,
        estSalesCalc: raw.EstSalesCalc != null ? Number(raw.EstSalesCalc) : null,
        estSalesPrev: raw.EstSalesPrev != null ? Number(raw.EstSalesPrev) : null,
```

- [ ] **Step 3: Extend the upsert payload**

In the `toUpsert.push({ ... })` block, append after `last_sale_date: ...`:

```ts
        dept_num: row.deptNum,
        class_num: row.classNum,
        cat_num: row.catNum,
        dept_name: row.deptName,
        class_name: row.className,
        cat_name: row.catName,
        one_year_sales: row.oneYearSales,
        look_back_sales: row.lookBackSales,
        sales_to_avg_ratio: row.salesToAvgRatio,
        est_sales_calc: row.estSalesCalc,
        est_sales_prev: row.estSalesPrev,
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/prism-sync.ts
git commit -m "$(cat <<'EOF'
feat(products): sync DCC names and Inventory_EstSales into mirror

SELECT now joins DeptClassCat + DCC_Department/Class/Category and
Inventory_EstSales (most-recent + second-most-recent per SKU at
Pierce LocationID=2). Upsert carries the new columns so the mirror
reflects classification and velocity estimates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Live Prism sync verification script

**Files:**
- Create: `scripts/test-prism-sync-dcc-estsales.ts`

- [ ] **Step 1: Write the verification script**

Create `scripts/test-prism-sync-dcc-estsales.ts` with:

```ts
/**
 * Verifies the DCC + Inventory_EstSales extensions of the prism-sync pull.
 * Picks a known Pierce-stocked SKU, runs a single-row sync, asserts the new
 * columns populate. Safe to re-run.
 */
import "dotenv/config";
import { getPrismPool } from "../src/lib/prism";
import { getSupabaseAdminClient } from "../src/lib/supabase/admin";

const SAMPLE_SKU = Number(process.env.SAMPLE_SKU ?? "0");

async function main(): Promise<void> {
  if (!SAMPLE_SKU) {
    throw new Error("Set SAMPLE_SKU to a known Pierce-stocked SKU before running.");
  }

  const pool = await getPrismPool();
  const prism = await pool.request().input("sku", SAMPLE_SKU).query<{
    Department: number | null;
    Class: number | null;
    Category: number | null;
    DeptName: string | null;
    ClassName: string | null;
    CatName: string | null;
    EstSalesCalc: number | null;
  }>(`
    SELECT
      dcc.Department, dcc.Class, dcc.Category,
      dep.Name AS DeptName, cls.Name AS ClassName, cat.Name AS CatName,
      es.EstSalesCalc
    FROM Item i
    LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
    LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
    LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department AND dcc.Class = cls.Class
    LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department AND dcc.Class = cat.Class AND dcc.Category = cat.Category
    LEFT JOIN (
      SELECT SKU, EstSalesCalc,
             ROW_NUMBER() OVER (PARTITION BY SKU ORDER BY CalculationDate DESC) AS rn
      FROM Inventory_EstSales WHERE LocationID = 2
    ) es ON es.SKU = i.SKU AND es.rn = 1
    WHERE i.SKU = @sku
  `);
  if (prism.recordset.length === 0) {
    throw new Error(`SKU ${SAMPLE_SKU} not found in Prism Item table.`);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("sku, dept_num, class_num, cat_num, dept_name, class_name, cat_name, est_sales_calc")
    .eq("sku", SAMPLE_SKU)
    .maybeSingle();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  if (!data) {
    throw new Error(`SKU ${SAMPLE_SKU} not found in Supabase products. Run a sync first.`);
  }

  const prismRow = prism.recordset[0];
  const mismatches: string[] = [];
  if (data.dept_num !== prismRow.Department) mismatches.push(`dept_num ${data.dept_num} != ${prismRow.Department}`);
  if (data.class_num !== prismRow.Class) mismatches.push(`class_num ${data.class_num} != ${prismRow.Class}`);
  if (data.cat_num !== prismRow.Category) mismatches.push(`cat_num ${data.cat_num} != ${prismRow.Category}`);
  if ((data.dept_name ?? "") !== (prismRow.DeptName?.trim() ?? "")) mismatches.push(`dept_name "${data.dept_name}" != "${prismRow.DeptName}"`);
  const prismEst = prismRow.EstSalesCalc != null ? Number(prismRow.EstSalesCalc) : null;
  const supaEst = data.est_sales_calc != null ? Number(data.est_sales_calc) : null;
  if (prismEst !== supaEst) mismatches.push(`est_sales_calc ${supaEst} != ${prismEst}`);

  if (mismatches.length > 0) {
    console.error(`FAIL for SKU ${SAMPLE_SKU}:\n  - ${mismatches.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`OK — SKU ${SAMPLE_SKU} DCC + EstSales match between Prism and Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/test-prism-sync-dcc-estsales.ts
git commit -m "$(cat <<'EOF'
test(products): add DCC + EstSales sync verification script

Runs after a sync to confirm the new columns round-trip Prism → Supabase
for a chosen SAMPLE_SKU. Used during implementation + ongoing for
regression detection; not wired into CI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Types, constants, and the preset catalog

### Task 7: Extend product types

**Files:**
- Modify: `src/domains/product/types.ts`

- [ ] **Step 1: Extend `Product`**

After line 22 (`synced_at: string;`) and before the closing `}`, add the new columns:

```ts
  dept_num: number | null;
  class_num: number | null;
  cat_num: number | null;
  dept_name: string | null;
  class_name: string | null;
  cat_name: string | null;
  one_year_sales: number | null;
  look_back_sales: number | null;
  sales_to_avg_ratio: number | null;
  est_sales_calc: number | null;
  est_sales_prev: number | null;
  discontinued: boolean | null;
```

- [ ] **Step 2: Extend `ProductFilters`**

After line 47 (`page: number;`) but before the closing `}`, add:

```ts
  // Stock
  minStock: string;
  maxStock: string;
  // Classification
  deptNum: string;
  classNum: string;
  catNum: string;
  // Data quality
  missingBarcode: boolean;
  missingIsbn: boolean;
  missingTitle: boolean;
  retailBelowCost: boolean;
  zeroPrice: boolean;
  // Pricing / margin
  minMargin: string;
  maxMargin: string;
  // Activity
  lastSaleWithin: "" | "30d" | "90d" | "365d";
  lastSaleNever: boolean;
  lastSaleOlderThan: "" | "2y" | "5y";
  editedWithin: "" | "7d";
  editedSinceSync: boolean;
  // Status
  discontinued: "" | "yes" | "no";
  itemType: "" | "textbook" | "used_textbook" | "general_merchandise" | "supplies" | "other";
```

- [ ] **Step 3: Add view + column preference types**

Append at the end of the file:

```ts
export type PresetGroup =
  | "dead-weight"
  | "movers"
  | "data-quality"
  | "pricing"
  | "recent-activity"
  | "textbook";

export interface ColumnPreferences {
  visible: string[];
}

export interface SavedView {
  id: string;
  name: string;
  description: string | null;
  filter: Partial<ProductFilters>;
  columnPreferences: ColumnPreferences | null;
  isSystem: boolean;
  slug: string | null;
  presetGroup: PresetGroup | null;
  sortOrder: number | null;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/types.ts
git commit -m "$(cat <<'EOF'
feat(products): extend types for DCC, EstSales, views, and presets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Extend constants

**Files:**
- Modify: `src/domains/product/constants.ts`

- [ ] **Step 1: Extend `EMPTY_FILTERS`**

Replace the `EMPTY_FILTERS` block with:

```ts
export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  tab: "textbooks",
  minPrice: "",
  maxPrice: "",
  vendorId: "",
  hasBarcode: false,
  lastSaleDateFrom: "",
  lastSaleDateTo: "",
  author: "",
  hasIsbn: false,
  edition: "",
  catalogNumber: "",
  productType: "",
  sortBy: "sku",
  sortDir: "asc",
  page: 1,
  // New in feat/products-interactive
  minStock: "",
  maxStock: "",
  deptNum: "",
  classNum: "",
  catNum: "",
  missingBarcode: false,
  missingIsbn: false,
  missingTitle: false,
  retailBelowCost: false,
  zeroPrice: false,
  minMargin: "",
  maxMargin: "",
  lastSaleWithin: "",
  lastSaleNever: false,
  lastSaleOlderThan: "",
  editedWithin: "",
  editedSinceSync: false,
  discontinued: "",
  itemType: "",
};
```

- [ ] **Step 2: Add column + preset-group constants**

Append:

```ts
export const OPTIONAL_COLUMNS = [
  "stock",
  "dcc",
  "est_sales",
  "margin",
  "days_since_sale",
  "updated",
] as const;

export type OptionalColumnKey = typeof OPTIONAL_COLUMNS[number];

export const DEFAULT_COLUMN_SET: OptionalColumnKey[] = ["stock", "dcc"];

export const COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  stock: "Stock",
  dcc: "DCC",
  est_sales: "Est. annual sales",
  margin: "Margin %",
  days_since_sale: "Days since sale",
  updated: "Updated",
};

export const PRESET_GROUPS = [
  { value: "dead-weight", label: "Dead weight", icon: "💀" },
  { value: "movers", label: "Movers", icon: "📊" },
  { value: "data-quality", label: "Data", icon: "🔍" },
  { value: "pricing", label: "Pricing", icon: "💰" },
  { value: "recent-activity", label: "Recent", icon: "📝" },
  { value: "textbook", label: "Textbook", icon: "📚" },
] as const;

export const COLUMN_PREFS_STORAGE_KEY = "products:columns:v1";
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/constants.ts
git commit -m "$(cat <<'EOF'
feat(products): constants for optional columns and preset groups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Define the 22 system presets

**Files:**
- Create: `src/domains/product/presets.ts`

- [ ] **Step 1: Write the preset catalog**

Create `src/domains/product/presets.ts`:

```ts
import type { ColumnPreferences, PresetGroup, ProductFilters, SavedView } from "./types";

type PresetSeed = {
  slug: string;
  name: string;
  description: string;
  presetGroup: PresetGroup;
  sortOrder: number;
  filter: Partial<ProductFilters>;
  columnPreferences: ColumnPreferences;
};

export const SYSTEM_PRESETS: PresetSeed[] = [
  // 💀 Dead weight
  { slug: "dead-discontinued-with-stock", name: "Discontinued with stock", description: "Items marked discontinued that still have stock on hand.",
    presetGroup: "dead-weight", sortOrder: 10,
    filter: { discontinued: "yes", minStock: "1" },
    columnPreferences: { visible: ["stock", "updated"] } },
  { slug: "dead-never-sold", name: "Never sold", description: "Items with no recorded last-sale date at Pierce.",
    presetGroup: "dead-weight", sortOrder: 20,
    filter: { lastSaleNever: true },
    columnPreferences: { visible: ["stock", "est_sales", "updated"] } },
  { slug: "dead-no-sales-2y", name: "No sales in 2 years", description: "Last sold more than 2 years ago.",
    presetGroup: "dead-weight", sortOrder: 30,
    filter: { lastSaleOlderThan: "2y" },
    columnPreferences: { visible: ["days_since_sale", "stock"] } },
  { slug: "dead-no-sales-5y", name: "No sales in 5 years", description: "Last sold more than 5 years ago.",
    presetGroup: "dead-weight", sortOrder: 40,
    filter: { lastSaleOlderThan: "5y" },
    columnPreferences: { visible: ["days_since_sale", "stock"] } },
  { slug: "dead-zero-stock-never-sold", name: "Zero stock + never sold", description: "No stock AND never sold — strongest dead-weight signal.",
    presetGroup: "dead-weight", sortOrder: 50,
    filter: { maxStock: "0", lastSaleNever: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "dead-discontinued", name: "Discontinued", description: "All discontinued items (active or zero stock).",
    presetGroup: "dead-weight", sortOrder: 60,
    filter: { discontinued: "yes" },
    columnPreferences: { visible: ["stock", "updated"] } },

  // 📊 Movers
  { slug: "movers-last-30d", name: "Sold in last 30 days", description: "Items with a sale in the trailing 30 days.",
    presetGroup: "movers", sortOrder: 10,
    filter: { lastSaleWithin: "30d" },
    columnPreferences: { visible: ["est_sales", "stock"] } },
  { slug: "movers-last-90d", name: "Sold in last 90 days", description: "Items with a sale in the trailing 90 days.",
    presetGroup: "movers", sortOrder: 20,
    filter: { lastSaleWithin: "90d" },
    columnPreferences: { visible: ["est_sales", "stock"] } },
  { slug: "movers-proven-sellers", name: "Proven sellers", description: "Sold in 90 days, still active, still have stock. Weak velocity proxy until PR #2 ships real time-series data.",
    presetGroup: "movers", sortOrder: 30,
    filter: { lastSaleWithin: "90d", discontinued: "no", minStock: "1" },
    columnPreferences: { visible: ["est_sales", "stock", "margin"] } },

  // 🔍 Data quality
  { slug: "data-missing-barcode", name: "Missing barcode", description: "Items with no barcode on file.",
    presetGroup: "data-quality", sortOrder: 10,
    filter: { missingBarcode: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-missing-isbn-textbook", name: "Missing ISBN (textbooks)", description: "Textbooks with no ISBN.",
    presetGroup: "data-quality", sortOrder: 20,
    filter: { tab: "textbooks", missingIsbn: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-missing-title-or-description", name: "Missing description or title", description: "Textbooks without a title, or general merchandise without a description.",
    presetGroup: "data-quality", sortOrder: 30,
    filter: { missingTitle: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-retail-below-cost", name: "Retail < cost", description: "Retail price lower than cost. Usually a data entry error.",
    presetGroup: "data-quality", sortOrder: 40,
    filter: { retailBelowCost: true },
    columnPreferences: { visible: ["margin", "updated"] } },
  { slug: "data-zero-price", name: "Retail or cost = 0", description: "Retail or cost is exactly zero.",
    presetGroup: "data-quality", sortOrder: 50,
    filter: { zeroPrice: true },
    columnPreferences: { visible: ["updated"] } },

  // 💰 Pricing
  { slug: "pricing-gm-under-5", name: "GM under $5", description: "General merchandise priced under $5.",
    presetGroup: "pricing", sortOrder: 10,
    filter: { tab: "merchandise", maxPrice: "5" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-gm-over-50", name: "GM over $50", description: "General merchandise priced over $50.",
    presetGroup: "pricing", sortOrder: 20,
    filter: { tab: "merchandise", minPrice: "50" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-textbooks-over-100", name: "Textbooks over $100", description: "Textbooks priced over $100.",
    presetGroup: "pricing", sortOrder: 30,
    filter: { tab: "textbooks", minPrice: "100" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-high-margin", name: "High margin", description: "Margin above 40%.",
    presetGroup: "pricing", sortOrder: 40,
    filter: { minMargin: "0.4" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-thin-margin", name: "Thin margin", description: "Margin below 10%.",
    presetGroup: "pricing", sortOrder: 50,
    filter: { maxMargin: "0.1" },
    columnPreferences: { visible: ["margin", "est_sales"] } },

  // 📝 Recent activity
  { slug: "recent-edited-7d", name: "Edited in last 7 days", description: "Items modified in the past week.",
    presetGroup: "recent-activity", sortOrder: 10,
    filter: { editedWithin: "7d" },
    columnPreferences: { visible: ["updated"] } },
  { slug: "recent-edited-since-sync", name: "Edited since last sync", description: "Items whose row was touched after the mirror was last refreshed.",
    presetGroup: "recent-activity", sortOrder: 20,
    filter: { editedSinceSync: true },
    columnPreferences: { visible: ["updated"] } },

  // 📚 Textbook
  { slug: "textbook-used-only", name: "Used textbooks only", description: "Only used-copy textbook SKUs.",
    presetGroup: "textbook", sortOrder: 10,
    filter: { itemType: "used_textbook" },
    columnPreferences: { visible: ["est_sales"] } },
];

export function presetSeedToSavedView(seed: PresetSeed): SavedView {
  return {
    id: seed.slug,
    name: seed.name,
    description: seed.description,
    filter: seed.filter,
    columnPreferences: seed.columnPreferences,
    isSystem: true,
    slug: seed.slug,
    presetGroup: seed.presetGroup,
    sortOrder: seed.sortOrder,
  };
}

export const SYSTEM_PRESET_VIEWS: SavedView[] = SYSTEM_PRESETS.map(presetSeedToSavedView);
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/presets.ts
git commit -m "$(cat <<'EOF'
feat(products): define 22 system preset catalog

Typed source-of-truth for system presets across 6 groups (dead weight,
movers, data quality, pricing, recent activity, textbook). Re-used by
the seed migration generator and by the client fallback when the
views API is unreachable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Seed migration for the 22 system presets

**Files:**
- Create: `prisma/migrations/<TS>_seed_products_page_presets/migration.sql`

- [ ] **Step 1: Generate migration SQL from presets.ts**

Translate each entry in `SYSTEM_PRESETS` into an `INSERT ... ON CONFLICT (slug) DO UPDATE` statement. Generate the file with this shape (one statement per preset, 22 statements total). Example of the first two rows — use the same pattern for every preset:

```sql
-- Seed 22 products-page system presets. ON CONFLICT (slug) DO UPDATE so
-- re-running the migration refreshes preset definitions without duplicates.

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Discontinued with stock',
   '{"discontinued":"yes","minStock":"1"}'::jsonb, true,
   'Items marked discontinued that still have stock on hand.',
   '{"visible":["stock","updated"]}'::jsonb,
   'dead-discontinued-with-stock', 'dead-weight', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Never sold',
   '{"lastSaleNever":true}'::jsonb, true,
   'Items with no recorded last-sale date at Pierce.',
   '{"visible":["stock","est_sales","updated"]}'::jsonb,
   'dead-never-sold', 'dead-weight', 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
```

Continue with the remaining 20 presets. Follow the same statement shape. Source-of-truth for each preset's `filter`, `column_preferences`, `slug`, `preset_group`, `sort_order`, `name`, `description` is `src/domains/product/presets.ts` from Task 9.

- [ ] **Step 2: Verify count**

Run: `grep -c "INSERT INTO saved_searches" prisma/migrations/<TS>_seed_products_page_presets/migration.sql`
Expected: `22`

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/<TS>_seed_products_page_presets/
git commit -m "$(cat <<'EOF'
feat(products): seed 22 system presets into saved_searches

Idempotent ON CONFLICT (slug) DO UPDATE so preset definitions can
evolve through migrations. Source of truth is
src/domains/product/presets.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — Filter translator + URL serializer

### Task 11: Extend `searchProducts` with new filter keys

**Files:**
- Modify: `src/domains/product/queries.ts`
- Test: `tests/domains/product/search-products-filters.test.ts` (new, minimal scaffolding — full coverage deferred to `view-serializer.test.ts` where the URL roundtrip lives)

- [ ] **Step 1: Add filter branches to `searchProducts`**

In `src/domains/product/queries.ts`, after the existing `if (filters.lastSaleDateTo) { ... }` block and before the `if (filters.tab === "textbooks")` block, insert:

```ts
  // Stock range
  if (filters.minStock !== "") {
    query = query.gte("stock_on_hand", Number(filters.minStock));
  }
  if (filters.maxStock !== "") {
    query = query.lte("stock_on_hand", Number(filters.maxStock));
  }

  // Classification (deptNum -> classNum -> catNum, each narrows the prior)
  if (filters.deptNum !== "") {
    query = query.eq("dept_num", Number(filters.deptNum));
  }
  if (filters.classNum !== "") {
    query = query.eq("class_num", Number(filters.classNum));
  }
  if (filters.catNum !== "") {
    query = query.eq("cat_num", Number(filters.catNum));
  }

  // Data quality
  if (filters.missingBarcode) {
    query = query.is("barcode", null);
  }
  if (filters.missingIsbn) {
    query = query.is("isbn", null);
  }
  if (filters.missingTitle) {
    // Textbook rows with no title OR merchandise rows with no description.
    query = query.or("and(item_type.in.(textbook,used_textbook),title.is.null),and(item_type.eq.general_merchandise,description.is.null)");
  }
  if (filters.retailBelowCost) {
    query = query.filter("retail_price", "lt", "cost");
  }
  if (filters.zeroPrice) {
    query = query.or("retail_price.eq.0,cost.eq.0");
  }

  // Margin range (computed client-side via a view would be better long-term;
  // for now approximate with (retail - cost) using Supabase's filter on computed
  // expression — fall back to client-side filter for rows missing retail).
  if (filters.minMargin !== "" || filters.maxMargin !== "") {
    // Supabase/PostgREST can't filter on computed expressions directly, so for
    // high/thin margin we rely on a Postgres view created in this migration
    // phase OR filter client-side. For MVP we filter on the server by issuing
    // a zero-margin proxy: `retail > cost` when minMargin > 0, and apply
    // exact bounds client-side after fetch.
    if (filters.minMargin !== "" && Number(filters.minMargin) > 0) {
      query = query.filter("retail_price", "gt", "cost");
    }
  }

  // Activity: last-sale windows
  if (filters.lastSaleWithin !== "") {
    const now = new Date();
    const days = filters.lastSaleWithin === "30d" ? 30 : filters.lastSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("last_sale_date", threshold);
  }
  if (filters.lastSaleNever) {
    query = query.is("last_sale_date", null);
  }
  if (filters.lastSaleOlderThan !== "") {
    const years = filters.lastSaleOlderThan === "2y" ? 2 : 5;
    const threshold = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt("last_sale_date", threshold);
  }

  // Activity: edited
  if (filters.editedWithin === "7d") {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("updated_at", threshold);
  }
  if (filters.editedSinceSync) {
    query = query.filter("updated_at", "gt", "synced_at");
  }

  // Status
  if (filters.discontinued === "yes") {
    query = query.eq("discontinued", true);
  } else if (filters.discontinued === "no") {
    query = query.or("discontinued.is.null,discontinued.eq.false");
  }
  if (filters.itemType !== "") {
    query = query.eq("item_type", filters.itemType);
  }
```

- [ ] **Step 2: Apply client-side margin bound post-fetch**

After the `const { data, count, error } = await query;` line, and before the return, add:

```ts
  let products = (data ?? []) as Product[];

  // Margin bound is applied client-side because PostgREST can't filter on a
  // computed expression. Server-side retail>cost already cut zero/negative
  // cases when minMargin>0.
  if (filters.minMargin !== "" || filters.maxMargin !== "") {
    const min = filters.minMargin === "" ? -Infinity : Number(filters.minMargin);
    const max = filters.maxMargin === "" ? Infinity : Number(filters.maxMargin);
    products = products.filter((p) => {
      if (p.retail_price <= 0) return false;
      const margin = (p.retail_price - p.cost) / p.retail_price;
      return margin >= min && margin <= max;
    });
  }
```

Then replace the `return { products: (data ?? []) as Product[], ... }` block with:

```ts
  return {
    products,
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
```

Note: applying the bound client-side means the reported `total` is the pre-margin-bound count. This is a known MVP tradeoff — the spec accepts it since high/thin margin is a coarse filter.

- [ ] **Step 3: Write the minimum smoke test**

Create `tests/domains/product/search-products-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";

// The full filter ↔ URL roundtrip lives in view-serializer.test.ts
// (Task 12). This file exists to guard against accidental filter-key
// renames by asserting EMPTY_FILTERS includes every new key.
import { EMPTY_FILTERS } from "@/domains/product/constants";

describe("EMPTY_FILTERS", () => {
  it.each([
    "minStock", "maxStock", "deptNum", "classNum", "catNum",
    "missingBarcode", "missingIsbn", "missingTitle",
    "retailBelowCost", "zeroPrice",
    "minMargin", "maxMargin",
    "lastSaleWithin", "lastSaleNever", "lastSaleOlderThan",
    "editedWithin", "editedSinceSync",
    "discontinued", "itemType",
  ])("includes new filter key: %s", (key) => {
    expect(key in EMPTY_FILTERS).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -- tests/domains/product/search-products-filters.test.ts`
Expected: 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/queries.ts tests/domains/product/search-products-filters.test.ts
git commit -m "$(cat <<'EOF'
feat(products): extend searchProducts with new filter keys

Server-side PostgREST filters for stock, DCC triple, data-quality
flags, activity windows, discontinued, and itemType. Margin bound
applied client-side after fetch (PostgREST can't filter on computed
retail-cost expressions). Known tradeoff: total count is pre-margin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Filter ↔ URL serializer + preset application (TDD)

**Files:**
- Create: `src/domains/product/view-serializer.ts`
- Test: `tests/domains/product/view-serializer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domains/product/view-serializer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import type { ProductFilters } from "@/domains/product/types";
import {
  applyPreset,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
} from "@/domains/product/view-serializer";

function makeParams(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

describe("serializeFiltersToSearchParams", () => {
  it("emits only non-default keys", () => {
    const filters: ProductFilters = { ...EMPTY_FILTERS, tab: "merchandise", minPrice: "5" };
    const params = serializeFiltersToSearchParams(filters);
    expect(params.get("tab")).toBe("merchandise");
    expect(params.get("minPrice")).toBe("5");
    expect(params.get("search")).toBeNull();
    expect(params.get("page")).toBeNull();
  });

  it("includes view param when explicitly passed", () => {
    const filters: ProductFilters = { ...EMPTY_FILTERS };
    const params = serializeFiltersToSearchParams(filters, { view: "dead-never-sold" });
    expect(params.get("view")).toBe("dead-never-sold");
  });
});

describe("parseFiltersFromSearchParams", () => {
  it("is the inverse of serialize for non-default keys", () => {
    const filters: ProductFilters = { ...EMPTY_FILTERS, tab: "merchandise", minStock: "1", discontinued: "yes" };
    const roundtripped = parseFiltersFromSearchParams(serializeFiltersToSearchParams(filters));
    expect(roundtripped).toEqual(filters);
  });

  it("coerces boolean keys from 'true'/'false'", () => {
    const out = parseFiltersFromSearchParams(makeParams({ missingBarcode: "true", lastSaleNever: "true" }));
    expect(out.missingBarcode).toBe(true);
    expect(out.lastSaleNever).toBe(true);
  });

  it("drops invalid numeric values silently", () => {
    const out = parseFiltersFromSearchParams(makeParams({ minStock: "NaN", maxStock: "abc" }));
    expect(out.minStock).toBe("");
    expect(out.maxStock).toBe("");
  });

  it("ignores unknown keys without throwing", () => {
    const out = parseFiltersFromSearchParams(makeParams({ tab: "merchandise", garbage: "???" }));
    expect(out.tab).toBe("merchandise");
  });
});

describe("applyPreset", () => {
  it("returns the preset filter merged over defaults and preserves empty keys", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-never-sold")!;
    const result = applyPreset(preset);
    expect(result.filters.lastSaleNever).toBe(true);
    expect(result.filters.tab).toBe(EMPTY_FILTERS.tab);
  });

  it("returns the preset column preferences", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-discontinued-with-stock")!;
    const result = applyPreset(preset);
    expect(result.visibleColumns).toEqual(["stock", "updated"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/domains/product/view-serializer.test.ts`
Expected: FAIL — `Cannot find module '@/domains/product/view-serializer'`.

- [ ] **Step 3: Implement `view-serializer.ts`**

Create `src/domains/product/view-serializer.ts`:

```ts
import { EMPTY_FILTERS } from "./constants";
import type {
  OptionalColumnKey,
  ProductFilters,
  ProductTab,
  SavedView,
} from "./types";
import { OPTIONAL_COLUMNS } from "./constants";

const BOOL_KEYS: (keyof ProductFilters)[] = [
  "hasBarcode", "hasIsbn",
  "missingBarcode", "missingIsbn", "missingTitle",
  "retailBelowCost", "zeroPrice",
  "lastSaleNever", "editedSinceSync",
];

const NUMERIC_STRING_KEYS: (keyof ProductFilters)[] = [
  "minPrice", "maxPrice", "vendorId",
  "minStock", "maxStock",
  "deptNum", "classNum", "catNum",
  "minMargin", "maxMargin",
];

const TEXT_KEYS: (keyof ProductFilters)[] = [
  "search", "author", "edition", "catalogNumber", "productType",
  "lastSaleDateFrom", "lastSaleDateTo",
];

const ENUM_KEYS: { [K in keyof ProductFilters]?: readonly ProductFilters[K][] } = {
  tab: ["textbooks", "merchandise"],
  sortDir: ["asc", "desc"],
  lastSaleWithin: ["", "30d", "90d", "365d"],
  lastSaleOlderThan: ["", "2y", "5y"],
  editedWithin: ["", "7d"],
  discontinued: ["", "yes", "no"],
  itemType: ["", "textbook", "used_textbook", "general_merchandise", "supplies", "other"],
};

function coerceNumericString(raw: string): string {
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return raw;
}

export function parseFiltersFromSearchParams(params: URLSearchParams): ProductFilters {
  const out: ProductFilters = { ...EMPTY_FILTERS };

  const rawTab = params.get("tab");
  if (rawTab === "textbooks" || rawTab === "merchandise") {
    out.tab = rawTab as ProductTab;
  }

  for (const key of BOOL_KEYS) {
    const v = params.get(key);
    if (v === "true") (out as Record<string, unknown>)[key] = true;
  }

  for (const key of NUMERIC_STRING_KEYS) {
    const v = params.get(key);
    if (v !== null) (out as Record<string, unknown>)[key] = coerceNumericString(v);
  }

  for (const key of TEXT_KEYS) {
    const v = params.get(key);
    if (v !== null) (out as Record<string, unknown>)[key] = v;
  }

  for (const [key, allowed] of Object.entries(ENUM_KEYS)) {
    const v = params.get(key);
    if (v !== null && (allowed as readonly string[]).includes(v)) {
      (out as Record<string, unknown>)[key] = v;
    }
  }

  // Log unknown keys once per parse so schema drift is visible in console
  // without throwing. EMPTY_FILTERS is the allow-list.
  const known = new Set<string>([...Object.keys(EMPTY_FILTERS), "view"]);
  for (const key of params.keys()) {
    if (!known.has(key) && typeof console !== "undefined") {
      console.warn(`[products filter] ignoring unknown key: ${key}`);
    }
  }

  const sortBy = params.get("sortBy");
  if (sortBy) out.sortBy = sortBy;

  const page = Number(params.get("page") ?? "1");
  out.page = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  return out;
}

export function serializeFiltersToSearchParams(
  filters: ProductFilters,
  extras: { view?: string } = {},
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    const def = (EMPTY_FILTERS as Record<string, unknown>)[key];
    if (value === def) continue;
    if (value === "" || value === false || value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  if (extras.view) params.set("view", extras.view);
  return params;
}

export interface AppliedPreset {
  filters: ProductFilters;
  visibleColumns: OptionalColumnKey[] | null;
}

export function applyPreset(view: SavedView): AppliedPreset {
  const filters: ProductFilters = { ...EMPTY_FILTERS, ...view.filter } as ProductFilters;
  let visibleColumns: OptionalColumnKey[] | null = null;
  if (view.columnPreferences) {
    visibleColumns = view.columnPreferences.visible.filter(
      (k): k is OptionalColumnKey => (OPTIONAL_COLUMNS as readonly string[]).includes(k),
    );
  }
  return { filters, visibleColumns };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/domains/product/view-serializer.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/view-serializer.ts tests/domains/product/view-serializer.test.ts
git commit -m "$(cat <<'EOF'
feat(products): filter-URL serializer and applyPreset merge

Pure functions: serializeFiltersToSearchParams, parseFiltersFromSearchParams
(drops unknown + invalid), and applyPreset which merges the preset's
partial filter over EMPTY_FILTERS and filters column keys against the
OPTIONAL_COLUMNS whitelist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Preset-predicate fixture tests

**Files:**
- Create: `tests/domains/product/presets-predicates.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/domains/product/presets-predicates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyPreset } from "@/domains/product/view-serializer";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import type { Product, ProductFilters } from "@/domains/product/types";

// Minimal fixture covering each preset's decision surface.
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const years = (y: number) => new Date(now.getTime() - y * 365 * 86400000).toISOString();
const base = (p: Partial<Product>): Product => ({
  sku: 0, barcode: null, item_type: "general_merchandise", description: "x", author: null,
  title: null, isbn: null, edition: null, retail_price: 10, cost: 5, stock_on_hand: 10,
  catalog_number: null, vendor_id: 1, dcc_id: 1, product_type: null, color_id: 0,
  created_at: null, updated_at: daysAgo(30), last_sale_date: daysAgo(30),
  synced_at: daysAgo(30), dept_num: null, class_num: null, cat_num: null,
  dept_name: null, class_name: null, cat_name: null, one_year_sales: null,
  look_back_sales: null, sales_to_avg_ratio: null, est_sales_calc: null,
  est_sales_prev: null, discontinued: false,
  ...p,
});

const fixtures: Product[] = [
  base({ sku: 1, description: "Sold recently", last_sale_date: daysAgo(5) }),
  base({ sku: 2, description: "Never sold", last_sale_date: null }),
  base({ sku: 3, description: "Discontinued with stock", discontinued: true, stock_on_hand: 5 }),
  base({ sku: 4, description: "Discontinued zero stock", discontinued: true, stock_on_hand: 0, last_sale_date: null }),
  base({ sku: 5, description: "No barcode", barcode: null }),
  base({ sku: 6, description: "Has barcode", barcode: "12345" }),
  base({ sku: 7, item_type: "textbook", title: null, isbn: null, description: null }),
  base({ sku: 8, item_type: "textbook", title: "T", isbn: "978", description: null }),
  base({ sku: 9, description: "Negative margin", retail_price: 5, cost: 10 }),
  base({ sku: 10, description: "Zero retail", retail_price: 0 }),
  base({ sku: 11, description: "Old sale", last_sale_date: years(3) }),
  base({ sku: 12, description: "Very old", last_sale_date: years(6) }),
  base({ sku: 13, description: "Expensive textbook", item_type: "textbook", title: "Big", retail_price: 150, cost: 50 }),
  base({ sku: 14, description: "Cheap merch", retail_price: 3, cost: 1 }),
  base({ sku: 15, description: "Thin margin", retail_price: 100, cost: 95 }),
  base({ sku: 16, description: "High margin", retail_price: 100, cost: 20 }),
  base({ sku: 17, description: "Recently edited", updated_at: daysAgo(2) }),
  base({ sku: 18, description: "Edited post-sync", updated_at: daysAgo(1), synced_at: daysAgo(5) }),
  base({ sku: 19, item_type: "used_textbook", description: "Used copy" }),
];

function matchesFilter(p: Product, f: ProductFilters): boolean {
  // Minimal mirror of searchProducts' predicate logic — only the keys that
  // system presets actually use. Kept in sync with queries.ts.
  if (f.tab === "textbooks" && !["textbook", "used_textbook"].includes(p.item_type)) return false;
  if (f.tab === "merchandise" && !["general_merchandise", "supplies", "other"].includes(p.item_type)) return false;
  if (f.minPrice !== "" && p.retail_price < Number(f.minPrice)) return false;
  if (f.maxPrice !== "" && p.retail_price > Number(f.maxPrice)) return false;
  if (f.minStock !== "" && (p.stock_on_hand ?? 0) < Number(f.minStock)) return false;
  if (f.maxStock !== "" && (p.stock_on_hand ?? 0) > Number(f.maxStock)) return false;
  if (f.missingBarcode && p.barcode !== null) return false;
  if (f.missingIsbn && p.isbn !== null) return false;
  if (f.missingTitle) {
    const isTb = ["textbook", "used_textbook"].includes(p.item_type);
    const isGm = p.item_type === "general_merchandise";
    const missing = (isTb && p.title === null) || (isGm && p.description === null);
    if (!missing) return false;
  }
  if (f.retailBelowCost && !(p.retail_price < p.cost)) return false;
  if (f.zeroPrice && !(p.retail_price === 0 || p.cost === 0)) return false;
  if (f.lastSaleNever && p.last_sale_date !== null) return false;
  if (f.lastSaleWithin !== "") {
    const days = f.lastSaleWithin === "30d" ? 30 : f.lastSaleWithin === "90d" ? 90 : 365;
    if (!p.last_sale_date) return false;
    if (new Date(p.last_sale_date).getTime() < now.getTime() - days * 86400000) return false;
  }
  if (f.lastSaleOlderThan !== "") {
    const y = f.lastSaleOlderThan === "2y" ? 2 : 5;
    if (!p.last_sale_date) return false;
    if (new Date(p.last_sale_date).getTime() >= now.getTime() - y * 365 * 86400000) return false;
  }
  if (f.editedWithin === "7d") {
    if (new Date(p.updated_at).getTime() < now.getTime() - 7 * 86400000) return false;
  }
  if (f.editedSinceSync) {
    if (new Date(p.updated_at).getTime() <= new Date(p.synced_at).getTime()) return false;
  }
  if (f.discontinued === "yes" && !p.discontinued) return false;
  if (f.discontinued === "no" && p.discontinued) return false;
  if (f.itemType !== "" && p.item_type !== f.itemType) return false;
  if (f.minMargin !== "" || f.maxMargin !== "") {
    if (p.retail_price <= 0) return false;
    const m = (p.retail_price - p.cost) / p.retail_price;
    if (f.minMargin !== "" && m < Number(f.minMargin)) return false;
    if (f.maxMargin !== "" && m > Number(f.maxMargin)) return false;
  }
  return true;
}

describe.each(SYSTEM_PRESET_VIEWS)("preset $slug", (preset) => {
  it("runs cleanly over the fixture and returns deterministic set", () => {
    const { filters } = applyPreset(preset);
    const matched = fixtures.filter((p) => matchesFilter(p, filters)).map((p) => p.sku).sort((a, b) => a - b);
    expect(Array.isArray(matched)).toBe(true);
    expect(matched).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to generate snapshots**

Run: `npm test -- tests/domains/product/presets-predicates.test.ts -u`
Expected: 22 passes, 22 snapshots written.

- [ ] **Step 3: Run again without `-u` to confirm stability**

Run: `npm test -- tests/domains/product/presets-predicates.test.ts`
Expected: 22 passes, no snapshot drift.

- [ ] **Step 4: Commit**

```bash
git add tests/domains/product/presets-predicates.test.ts tests/domains/product/__snapshots__/
git commit -m "$(cat <<'EOF'
test(products): snapshot the 22 presets against a shared fixture

Guards against accidental semantic drift when preset filter payloads or
searchProducts logic change. Uses a local matchesFilter mirror of
searchProducts' predicates to keep the test independent of Supabase.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase E — API endpoints

### Task 14: Views API — GET + POST

**Files:**
- Create: `src/app/api/products/views/route.ts`
- Test: `tests/app/api/products-views-route.test.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/views/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PresetGroup, SavedView } from "@/domains/product/types";

export const dynamic = "force-dynamic";

const PRODUCTS_PAGE_GROUPS: PresetGroup[] = [
  "dead-weight", "movers", "data-quality", "pricing", "recent-activity", "textbook",
];

const postBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  filter: z.record(z.unknown()),
  columnPreferences: z.object({ visible: z.array(z.string()).max(24) }).optional().nullable(),
});

function rowToView(row: Record<string, unknown>): SavedView {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    filter: (row.filter as SavedView["filter"]) ?? {},
    columnPreferences: (row.column_preferences as SavedView["columnPreferences"]) ?? null,
    isSystem: (row.is_system as boolean) ?? false,
    slug: (row.slug as string) ?? null,
    presetGroup: (row.preset_group as PresetGroup) ?? null,
    sortOrder: (row.sort_order as number) ?? null,
  };
}

export const GET = withAuth(async (_req, session) => {
  const supabase = getSupabaseAdminClient();
  const userId = (session.user as { id?: string }).id;

  const [systemRes, mineRes] = await Promise.all([
    supabase
      .from("saved_searches")
      .select("id, name, description, filter, column_preferences, is_system, slug, preset_group, sort_order")
      .eq("is_system", true)
      .in("preset_group", PRODUCTS_PAGE_GROUPS)
      .order("preset_group", { ascending: true })
      .order("sort_order", { ascending: true }),
    userId
      ? supabase
          .from("saved_searches")
          .select("id, name, description, filter, column_preferences, is_system, slug, preset_group, sort_order")
          .eq("is_system", false)
          .eq("owner_user_id", userId)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (systemRes.error) {
    return NextResponse.json({ error: systemRes.error.message }, { status: 500 });
  }
  if (mineRes.error) {
    return NextResponse.json({ error: mineRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    system: (systemRes.data ?? []).map(rowToView),
    mine: (mineRes.data ?? []).map(rowToView),
  });
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Session missing user id" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      owner_user_id: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      filter: parsed.data.filter,
      column_preferences: parsed.data.columnPreferences ?? null,
      is_system: false,
    })
    .select("id, name, description, filter, column_preferences, is_system, slug, preset_group, sort_order")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `A view named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rowToView(data), { status: 201 });
});
```

- [ ] **Step 2: Write the route tests**

Create `tests/app/api/products-views-route.test.ts` with tests that mock `getServerSession` + `getSupabaseAdminClient` to exercise: unauthorized 401, GET returning `{system, mine}` filtered to products-page groups, POST success, POST 409 on 23505, POST 400 on invalid body. Follow the mock patterns in `tests/app/api/admin-user-route.test.ts` (copy its `vi.mock` scaffolding).

Skeleton:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn() }));

import { getServerSession } from "next-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET, POST } from "@/app/api/products/views/route";

beforeEach(() => { vi.clearAllMocks(); });

describe("GET /api/products/views", () => {
  it("401 when no session", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://x/api/products/views"));
    expect(res.status).toBe(401);
  });

  it("returns system + mine", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const sys = [{ id: "s1", name: "Never sold", filter: {}, column_preferences: null, is_system: true, slug: "dead-never-sold", preset_group: "dead-weight", sort_order: 20 }];
    const mine = [{ id: "m1", name: "Mine", filter: { tab: "textbooks" }, column_preferences: null, is_system: false, slug: null, preset_group: null, sort_order: null }];
    const chain = (data: unknown) => ({ select: () => ({ eq: () => ({ in: () => ({ order: () => ({ order: () => Promise.resolve({ data, error: null }) }) }), order: () => Promise.resolve({ data, error: null }) }) });
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: (table: string) => chain(table === "saved_searches" ? sys : []),
    });
    // Simpler: spy on the two awaited promises via a queued mock.
    const from = vi.fn()
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ in: () => ({ order: () => ({ order: () => Promise.resolve({ data: sys, error: null }) }) }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: mine, error: null }) }) }) }) });
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const res = await GET(new NextRequest("http://x/api/products/views"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.system[0].slug).toBe("dead-never-sold");
    expect(body.mine[0].name).toBe("Mine");
  });
});

describe("POST /api/products/views", () => {
  it("201 on valid body", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const single = vi.fn().mockResolvedValue({ data: { id: "v1", name: "N", filter: {}, column_preferences: null, is_system: false, slug: null, preset_group: null, sort_order: null }, error: null });
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ insert: () => ({ select: () => ({ single }) }) }),
    });
    const req = new NextRequest("http://x/api/products/views", { method: "POST", body: JSON.stringify({ name: "N", filter: {} }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("409 on duplicate name", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "dup" } });
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ insert: () => ({ select: () => ({ single }) }) }),
    });
    const req = new NextRequest("http://x/api/products/views", { method: "POST", body: JSON.stringify({ name: "N", filter: {} }) });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("400 on invalid body", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const req = new NextRequest("http://x/api/products/views", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- tests/app/api/products-views-route.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/products/views/route.ts tests/app/api/products-views-route.test.ts
git commit -m "$(cat <<'EOF'
feat(products): add views GET+POST API

GET returns system presets (filtered to products-page preset groups)
alongside the caller's user views. POST creates a user view scoped to
session user. 409 on (owner_user_id, name) duplicate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Views API — DELETE

**Files:**
- Create: `src/app/api/products/views/[id]/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/views/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(async (_req, session, ctx) => {
  const params = await ctx?.params;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Session missing user id" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", userId)
    .eq("is_system", false)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "View not found or not deletable" }, { status: 404 });

  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 2: Extend the route test file**

Append to `tests/app/api/products-views-route.test.ts`:

```ts
import { DELETE } from "@/app/api/products/views/[id]/route";

describe("DELETE /api/products/views/:id", () => {
  it("404 when not owned", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ delete: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle }) }) }) }) }) }),
    });
    const res = await DELETE(new NextRequest("http://x"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- tests/app/api/products-views-route.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/products/views/[id]/route.ts tests/app/api/products-views-route.test.ts
git commit -m "$(cat <<'EOF'
feat(products): views DELETE restricted to owner + user-created rows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: DCC list API

**Files:**
- Create: `src/app/api/products/dcc-list/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/dcc-list/route.ts`:

```ts
import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface DccEntry {
  deptNum: number;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
}

export const GET = withAuth(async () => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("dept_num, class_num, cat_num, dept_name, class_name, cat_name")
    .not("dept_num", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const items: DccEntry[] = [];
  for (const row of data ?? []) {
    const r = row as { dept_num: number; class_num: number | null; cat_num: number | null; dept_name: string | null; class_name: string | null; cat_name: string | null };
    const key = `${r.dept_num}.${r.class_num ?? ""}.${r.cat_num ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      deptNum: r.dept_num,
      classNum: r.class_num,
      catNum: r.cat_num,
      deptName: r.dept_name,
      className: r.class_name,
      catName: r.cat_name,
    });
  }
  items.sort((a, b) =>
    a.deptNum - b.deptNum ||
    (a.classNum ?? 0) - (b.classNum ?? 0) ||
    (a.catNum ?? 0) - (b.catNum ?? 0),
  );

  return NextResponse.json({ items }, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
});
```

- [ ] **Step 2: Write a smoke test**

Create `tests/app/api/products-dcc-list-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn() }));

import { getServerSession } from "next-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/products/dcc-list/route";

beforeEach(() => { vi.clearAllMocks(); });

describe("GET /api/products/dcc-list", () => {
  it("dedupes and sorts DCC entries", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const rows = [
      { dept_num: 10, class_num: 20, cat_num: 1, dept_name: "A", class_name: "B", cat_name: "C" },
      { dept_num: 10, class_num: 20, cat_num: 1, dept_name: "A", class_name: "B", cat_name: "C" },
      { dept_num: 5, class_num: 1, cat_num: null, dept_name: "X", class_name: "Y", cat_name: null },
    ];
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ select: () => ({ not: () => Promise.resolve({ data: rows, error: null }) }) }),
    });

    const res = await GET(new NextRequest("http://x/api/products/dcc-list"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].deptNum).toBe(5);
    expect(body.items[1].deptNum).toBe(10);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/app/api/products-dcc-list-route.test.ts`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/products/dcc-list/route.ts tests/app/api/products-dcc-list-route.test.ts
git commit -m "$(cat <<'EOF'
feat(products): DCC list API for typeahead

Deduped + sorted distinct (dept_num, class_num, cat_num) triples with
names, served from the Supabase mirror with 1-hour private cache.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Client helpers for views + DCC list

**Files:**
- Create: `src/domains/product/views-api.ts`

- [ ] **Step 1: Write the helper module**

Create `src/domains/product/views-api.ts`:

```ts
import type { ColumnPreferences, SavedView } from "./types";

interface ListResponse {
  system: SavedView[];
  mine: SavedView[];
}

export async function listViews(): Promise<ListResponse> {
  const res = await fetch("/api/products/views", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/products/views → ${res.status}`);
  return (await res.json()) as ListResponse;
}

export interface SaveViewInput {
  name: string;
  description?: string | null;
  filter: Record<string, unknown>;
  columnPreferences?: ColumnPreferences | null;
}

export async function saveView(input: SaveViewInput): Promise<SavedView> {
  const res = await fetch("/api/products/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body.error as string) ?? "Duplicate view name");
  }
  if (!res.ok) throw new Error(`POST /api/products/views → ${res.status}`);
  return (await res.json()) as SavedView;
}

export async function deleteView(id: string): Promise<void> {
  const res = await fetch(`/api/products/views/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/products/views/${id} → ${res.status}`);
}

export interface DccListItem {
  deptNum: number;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
}

let dccCache: Promise<DccListItem[]> | null = null;

export function loadDccList(): Promise<DccListItem[]> {
  if (!dccCache) {
    dccCache = fetch("/api/products/dcc-list")
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/products/dcc-list → ${r.status}`);
        return r.json();
      })
      .then((body: { items: DccListItem[] }) => body.items)
      .catch((e) => {
        dccCache = null; // allow retry next call
        throw e;
      });
  }
  return dccCache;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/views-api.ts
git commit -m "$(cat <<'EOF'
feat(products): client helpers for views + DCC list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase F — Core UI: SavedViewsBar + dialogs + column toggle

### Task 18: SavedViewsBar component

**Files:**
- Create: `src/components/products/saved-views-bar.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/products/saved-views-bar.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRESET_GROUPS } from "@/domains/product/constants";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { listViews } from "@/domains/product/views-api";
import type { PresetGroup, SavedView } from "@/domains/product/types";

interface Props {
  activeSlug: string | null;
  activeId: string | null;
  onPresetClick: (view: SavedView) => void;
  onSaveClick: () => void;
  onDeleteClick: (view: SavedView) => void;
}

export function SavedViewsBar({ activeSlug, activeId, onPresetClick, onSaveClick, onDeleteClick }: Props) {
  const [system, setSystem] = useState<SavedView[]>(SYSTEM_PRESET_VIEWS);
  const [mine, setMine] = useState<SavedView[]>([]);
  const [fellBack, setFellBack] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let cancelled = false;
    listViews()
      .then((r) => {
        if (cancelled) return;
        if (r.system.length > 0) setSystem(r.system);
        setMine(r.mine);
      })
      .catch(() => {
        if (!cancelled) setFellBack(true);
      });
    return () => { cancelled = true; };
  }, []);

  const byGroup = new Map<PresetGroup, SavedView[]>();
  for (const v of system) {
    if (!v.presetGroup) continue;
    const arr = byGroup.get(v.presetGroup as PresetGroup) ?? [];
    arr.push(v);
    byGroup.set(v.presetGroup as PresetGroup, arr);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLOListElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const chips = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-view-chip]") ?? []);
    const idx = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    const next = e.key === "ArrowRight" ? (idx + 1) % chips.length : (idx - 1 + chips.length) % chips.length;
    chips[next]?.focus();
    e.preventDefault();
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved views">
      <ol
        ref={listRef}
        onKeyDown={handleKeyDown}
        className="flex flex-wrap items-center gap-1.5"
      >
        {PRESET_GROUPS.map(({ value, label, icon }) => {
          const items = byGroup.get(value) ?? [];
          if (items.length === 0) return null;
          return (
            <li key={value} className="flex items-center gap-1.5 border-r border-border pr-2 last:border-r-0">
              <span className="text-xs font-medium text-muted-foreground select-none" aria-hidden>
                {icon} {label}
              </span>
              {items.map((v) => (
                <ViewChip
                  key={v.id}
                  view={v}
                  active={activeSlug === v.slug}
                  onClick={() => onPresetClick(v)}
                />
              ))}
            </li>
          );
        })}

        {mine.length > 0 && (
          <li className="flex items-center gap-1.5 pl-2">
            <span className="text-xs font-medium text-muted-foreground select-none" aria-hidden>
              My views
            </span>
            {mine.map((v) => (
              <UserChip
                key={v.id}
                view={v}
                active={activeId === v.id}
                onClick={() => onPresetClick(v)}
                onDelete={() => onDeleteClick(v)}
              />
            ))}
          </li>
        )}
      </ol>

      <Button size="sm" variant="outline" onClick={onSaveClick} className="ml-auto">
        + Save View
      </Button>

      {fellBack && (
        <p className="w-full text-xs text-muted-foreground" role="status" aria-live="polite">
          Showing system presets only — couldn&apos;t load saved views.
        </p>
      )}
    </div>
  );
}

function ViewChip({ view, active, onClick }: { view: SavedView; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-view-chip
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      {view.name}
    </button>
  );
}

function UserChip({ view, active, onClick, onDelete }: { view: SavedView; active: boolean; onClick: () => void; onDelete: () => void }) {
  return (
    <Popover>
      <span className="inline-flex items-center">
        <button
          type="button"
          data-view-chip
          aria-pressed={active}
          onClick={onClick}
          className={`rounded-l-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
          }`}
        >
          {view.name}
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`View options for ${view.name}`}
            className="rounded-r-full border border-l-0 px-1.5 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ⋯
          </button>
        </PopoverTrigger>
      </span>
      <PopoverContent align="end" className="w-40 p-1">
        <Button size="sm" variant="ghost" className="w-full justify-start text-destructive" onClick={onDelete}>
          Delete View
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/products/saved-views-bar.tsx
git commit -m "$(cat <<'EOF'
feat(products): SavedViewsBar with system presets and user views

Keyboard-navigable chip row. Arrow keys cycle focus. Falls back to
bundled SYSTEM_PRESET_VIEWS when the views API is unreachable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: SaveViewDialog and DeleteViewDialog

**Files:**
- Create: `src/components/products/save-view-dialog.tsx`
- Create: `src/components/products/delete-view-dialog.tsx`

- [ ] **Step 1: Write SaveViewDialog**

Create `src/components/products/save-view-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveView } from "@/domains/product/views-api";
import type { ColumnPreferences, ProductFilters, SavedView } from "@/domains/product/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFilters;
  columnPreferences: ColumnPreferences | null;
  onSaved: (view: SavedView) => void;
}

export function SaveViewDialog({ open, onOpenChange, filters, columnPreferences, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const view = await saveView({ name: name.trim(), description: description.trim() || null, filter: filters as unknown as Record<string, unknown>, columnPreferences });
      onSaved(view);
      onOpenChange(false);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save View</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby={error ? "view-error" : undefined}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="view-description">Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="view-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          {error && (
            <p id="view-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save View"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write DeleteViewDialog**

Create `src/components/products/delete-view-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteView } from "@/domains/product/views-api";
import type { SavedView } from "@/domains/product/types";

interface Props {
  view: SavedView | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (view: SavedView) => void;
}

export function DeleteViewDialog({ view, onOpenChange, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      await deleteView(view.id);
      onDeleted(view);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!view} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete View</DialogTitle>
        </DialogHeader>
        <p>
          Delete <strong>{view?.name}</strong>? This can&apos;t be undone.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/products/save-view-dialog.tsx src/components/products/delete-view-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(products): Save and Delete View dialogs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: ColumnVisibilityToggle

**Files:**
- Create: `src/components/products/column-visibility-toggle.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/products/column-visibility-toggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMN_LABELS, COLUMN_PREFS_STORAGE_KEY, DEFAULT_COLUMN_SET, OPTIONAL_COLUMNS } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";

interface Props {
  runtimeOverride: OptionalColumnKey[] | null;
  onUserChange: (visible: OptionalColumnKey[]) => void;
  onResetRuntime: () => void;
}

export function ColumnVisibilityToggle({ runtimeOverride, onUserChange, onResetRuntime }: Props) {
  const [base, setBase] = useState<OptionalColumnKey[]>(() => {
    if (typeof window === "undefined") return DEFAULT_COLUMN_SET;
    try {
      const raw = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY);
      if (!raw) return DEFAULT_COLUMN_SET;
      const parsed = JSON.parse(raw) as { visible?: string[] };
      if (!parsed?.visible) return DEFAULT_COLUMN_SET;
      return parsed.visible.filter((k): k is OptionalColumnKey => (OPTIONAL_COLUMNS as readonly string[]).includes(k));
    } catch {
      return DEFAULT_COLUMN_SET;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLUMN_PREFS_STORAGE_KEY, JSON.stringify({ visible: base }));
    onUserChange(base);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const active = runtimeOverride ?? base;

  function toggle(key: OptionalColumnKey) {
    const next = active.includes(key) ? active.filter((k) => k !== key) : [...active, key];
    if (runtimeOverride) {
      // Writing while override is active promotes to the new base, clearing override.
      setBase(next);
      onResetRuntime();
    } else {
      setBase(next);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Columns ▾
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <ul className="space-y-1">
          {OPTIONAL_COLUMNS.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <input
                id={`col-${key}`}
                type="checkbox"
                checked={active.includes(key)}
                onChange={() => toggle(key)}
                className="h-4 w-4"
              />
              <label htmlFor={`col-${key}`} className="text-sm cursor-pointer">
                {COLUMN_LABELS[key]}
              </label>
            </li>
          ))}
        </ul>
        {runtimeOverride && (
          <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={onResetRuntime}>
            Reset to my default
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/products/column-visibility-toggle.tsx
git commit -m "$(cat <<'EOF'
feat(products): column visibility toggle with localStorage base

Preset clicks apply a runtime override; toggling a column promotes
the runtime set to the new localStorage base.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase G — Extended filters and table

### Task 21: Extended filter sub-sections

**Files:**
- Create: `src/components/products/product-filters-extended.tsx`
- Modify: `src/components/products/product-filters.tsx`

- [ ] **Step 1: Write the extended sub-sections component**

Create `src/components/products/product-filters-extended.tsx` with controlled inputs for each new key on `ProductFilters`. Follow the shape of the existing `ProductFiltersBar` — same props (`filters`, `onChange`) and same styling. Include:

- Stock: `<input type="number" inputMode="numeric">` for `minStock` and `maxStock`, label `htmlFor` attached.
- DCC: render a placeholder slot for the `DccPicker` (actual wiring in Task 23). For MVP accept a free-text numeric input on `deptNum`/`classNum`/`catNum`.
- Data Quality: five checkboxes for `missingBarcode`, `missingIsbn`, `missingTitle`, `retailBelowCost`, `zeroPrice`, labels attached.
- Margin: two `<input type="number" step="0.01" inputMode="decimal">` for `minMargin`/`maxMargin`.
- Activity: two `<select>` elements for `lastSaleWithin` and `editedWithin`; a checkbox each for `lastSaleNever`/`editedSinceSync`; a `<select>` for `lastSaleOlderThan`.
- Status: `<select>` for `discontinued` with options "", "yes", "no".

Each `onChange` emits a partial filter update via the `onChange(patch)` prop.

- [ ] **Step 2: Embed the extended sub-section**

In `src/components/products/product-filters.tsx`, import the new component and render it inside the existing filter panel (typically wrapped by a collapsible). Pass through `filters` and `onChange`.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/product-filters-extended.tsx src/components/products/product-filters.tsx
git commit -m "$(cat <<'EOF'
feat(products): extended filter panel sub-sections

Stock, DCC (numeric for now), Data Quality, Margin, Activity, Status.
DccPicker typeahead wiring lands in a later task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Extended product table columns

**Files:**
- Modify: `src/components/products/product-table.tsx`

- [ ] **Step 1: Add `visibleColumns` prop**

Add `visibleColumns: OptionalColumnKey[]` to the component's Props interface. Thread it from `page.tsx` (Task 24).

- [ ] **Step 2: Add the optional column cells**

Inside the table row render, add conditional columns gated on `visibleColumns.includes(key)`:

- `stock`: `<td className="text-right tabular-nums">{product.stock_on_hand ?? "—"}</td>`
- `dcc`: two-row cell described in spec — monospace numeric prefix and name path with `truncate` + title tooltip:
  ```tsx
  <td className="min-w-0 max-w-[16ch]">
    {product.dept_num != null && (
      <>
        <div className="font-mono text-xs tabular-nums" translate="no">
          {product.dept_num}.{product.class_num ?? ""}.{product.cat_num ?? ""}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={[product.dept_name, product.class_name, product.cat_name].filter(Boolean).join(" › ")}>
          {[product.dept_name, product.class_name, product.cat_name].filter(Boolean).join(" › ") || "—"}
        </div>
      </>
    )}
  </td>
  ```
- `est_sales`: currency with trend arrow
  ```tsx
  <td className="text-right tabular-nums">
    {product.est_sales_calc != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(product.est_sales_calc) : "—"}
    {product.est_sales_prev != null && product.est_sales_calc != null && (
      <span className="ml-1 text-xs text-muted-foreground" aria-label={product.est_sales_calc > product.est_sales_prev ? "rising" : product.est_sales_calc < product.est_sales_prev ? "falling" : "flat"}>
        {product.est_sales_calc > product.est_sales_prev ? "▲" : product.est_sales_calc < product.est_sales_prev ? "▼" : "="}
      </span>
    )}
  </td>
  ```
- `margin`:
  ```tsx
  <td className={`text-right tabular-nums ${product.retail_price > 0 && (product.retail_price - product.cost) / product.retail_price < 0.1 ? "text-destructive" : ""}`}>
    {product.retail_price > 0 ? new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format((product.retail_price - product.cost) / product.retail_price) : "—"}
  </td>
  ```
- `days_since_sale`: compute `(Date.now() - new Date(product.last_sale_date).getTime()) / 86_400_000` floor, or "Never" when null.
- `updated`: `Intl.RelativeTimeFormat` value, absolute in `title` attribute:
  ```tsx
  <td className="tabular-nums" title={new Date(product.updated_at).toLocaleString()}>
    {(() => {
      const diffMs = Date.now() - new Date(product.updated_at).getTime();
      const days = Math.round(diffMs / 86_400_000);
      const fmt = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
      if (Math.abs(days) < 1) return fmt.format(-Math.round(diffMs / 3_600_000), "hour");
      return fmt.format(-days, "day");
    })()}
  </td>
  ```

Match the column order from `OPTIONAL_COLUMNS`. Update the `<thead>` to emit matching `<th>` cells conditionally.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/product-table.tsx
git commit -m "$(cat <<'EOF'
feat(products): optional columns — stock, DCC, est sales, margin, days since sale, updated

All numerics tabular-nums; DCC numeric prefix translate=\"no\". Margin
turns red under 10%. Updated uses Intl.RelativeTimeFormat with absolute
timestamp in tooltip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase H — DccPicker, Pierce badge, page wiring

### Task 23: DccPicker typeahead

**Files:**
- Create: `src/components/products/dcc-picker.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/products/dcc-picker.tsx` as a controlled combobox:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadDccList, type DccListItem } from "@/domains/product/views-api";

interface Props {
  deptNum: string;
  classNum: string;
  catNum: string;
  onChange: (patch: { deptNum?: string; classNum?: string; catNum?: string }) => void;
}

export function DccPicker({ deptNum, classNum, catNum, onChange }: Props) {
  const [items, setItems] = useState<DccListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(() => deptNumToText(deptNum, classNum, catNum));

  useEffect(() => { setQuery(deptNumToText(deptNum, classNum, catNum)); }, [deptNum, classNum, catNum]);

  useEffect(() => {
    loadDccList()
      .then(setItems)
      .catch(() => setFailed(true));
  }, []);

  const suggestions = useMemo(() => {
    if (!items || !query.trim()) return [];
    const numeric = /^[\d.]+$/.test(query);
    const q = query.toLowerCase();
    const filtered = items.filter((it) => {
      const triple = `${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}`;
      const names = [it.deptName, it.className, it.catName].filter(Boolean).join(" ").toLowerCase();
      return numeric ? triple.startsWith(query) : names.includes(q);
    });
    return filtered.slice(0, 12);
  }, [items, query]);

  function pick(it: DccListItem) {
    onChange({
      deptNum: String(it.deptNum),
      classNum: it.classNum != null ? String(it.classNum) : "",
      catNum: it.catNum != null ? String(it.catNum) : "",
    });
  }

  if (failed) {
    return (
      <div className="space-y-1">
        <Label htmlFor="dcc-fallback">DCC</Label>
        <Input
          id="dcc-fallback"
          placeholder="10.10.20"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            const parts = e.target.value.split(".");
            onChange({ deptNum: parts[0] ?? "", classNum: parts[1] ?? "", catNum: parts[2] ?? "" });
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="numeric"
        />
        <p className="text-xs text-muted-foreground">Name lookup unavailable — enter DCC as 10.10.20.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="dcc-picker">DCC</Label>
      <Input
        id="dcc-picker"
        list="dcc-picker-list"
        placeholder="10.10.20 or drinks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => {
          if (suggestions[0]) pick(suggestions[0]);
        }}
        spellCheck={false}
        autoComplete="off"
      />
      <datalist id="dcc-picker-list">
        {suggestions.map((it) => (
          <option
            key={`${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}`}
            value={`${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}`}
          >
            {[it.deptName, it.className, it.catName].filter(Boolean).join(" › ")}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function deptNumToText(deptNum: string, classNum: string, catNum: string): string {
  if (!deptNum) return "";
  return [deptNum, classNum, catNum].filter((p) => p !== "").join(".");
}
```

- [ ] **Step 2: Wire the picker into `product-filters-extended.tsx`**

Replace the numeric placeholder inputs for `deptNum/classNum/catNum` in `product-filters-extended.tsx` with `<DccPicker deptNum={filters.deptNum} classNum={filters.classNum} catNum={filters.catNum} onChange={onChange} />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/dcc-picker.tsx src/components/products/product-filters-extended.tsx
git commit -m "$(cat <<'EOF'
feat(products): DCC typeahead picker

Uses the native <datalist> element for robustness; degrades to plain
numeric input if /api/products/dcc-list fails.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: PierceAssuranceBadge

**Files:**
- Create: `src/components/products/pierce-assurance-badge.tsx`

- [ ] **Step 1: Find the existing sync status read path**

Run: `grep -rn "sync_runs" src/ --include="*.ts" --include="*.tsx" | head`
Reuse the same read helper / endpoint that `sync-database-button.tsx` already uses. If the button reads via an API route, call the same route here.

- [ ] **Step 2: Write the component**

Create `src/components/products/pierce-assurance-badge.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface SyncStatus {
  status: "ok" | "failed" | "running" | "unknown";
  finishedAt: string | null;
}

async function fetchStatus(): Promise<SyncStatus> {
  // Reuses the same read as sync-database-button — replace with the exact
  // path discovered in Step 1 (e.g. /api/sync/prism-pull?latest=1).
  const res = await fetch("/api/sync/prism-pull?latest=1");
  if (!res.ok) throw new Error(`sync status HTTP ${res.status}`);
  const body = await res.json();
  return {
    status: (body.status as SyncStatus["status"]) ?? "unknown",
    finishedAt: (body.finished_at as string) ?? (body.finishedAt as string) ?? null,
  };
}

export function PierceAssuranceBadge({ onClick }: { onClick: () => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetchStatus().then((s) => !cancelled && setStatus(s)).catch(() => !cancelled && setStatus({ status: "unknown", finishedAt: null }));
    };
    tick();
    const t = window.setInterval(tick, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  const fresh = status?.status === "ok" && status?.finishedAt && Date.now() - new Date(status.finishedAt).getTime() < 24 * 60 * 60 * 1000;
  const dotClass = fresh ? "bg-emerald-500" : "bg-amber-500";
  const srText = fresh
    ? `Pierce catalog in sync, last checked ${status?.finishedAt ? new Date(status.finishedAt).toLocaleString() : "unknown"}.`
    : `Pierce catalog sync needs attention. Last status: ${status?.status ?? "unknown"}.`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="status"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full motion-safe:animate-pulse ${dotClass}`} aria-hidden />
      <span>Pierce</span>
      <span className="sr-only">{srText}</span>
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/products/pierce-assurance-badge.tsx
git commit -m "$(cat <<'EOF'
feat(products): Pierce assurance badge

Polls latest sync_runs row every 5 minutes. Green dot when last sync
was OK within 24h, amber otherwise. Honors prefers-reduced-motion via
motion-safe:animate-pulse. Opens sync history on click.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 25: Wire everything into the products page

**Files:**
- Modify: `src/app/products/page.tsx`

- [ ] **Step 1: Add state for views, columns, and dialogs**

Add these hooks near the top of the component:

```tsx
const [activeView, setActiveView] = useState<SavedView | null>(null);
const [runtimeColumns, setRuntimeColumns] = useState<OptionalColumnKey[] | null>(null);
const [baseColumns, setBaseColumns] = useState<OptionalColumnKey[]>(DEFAULT_COLUMN_SET);
const [saveDialogOpen, setSaveDialogOpen] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);
```

- [ ] **Step 2: Add preset-click, save-click, delete-click handlers**

```tsx
function handlePresetClick(view: SavedView) {
  const { filters: next, visibleColumns } = applyPreset(view);
  setFilters(next);
  setRuntimeColumns(visibleColumns);
  setActiveView(view);
  const params = serializeFiltersToSearchParams(next, { view: view.slug ?? view.id });
  router.replace(`?${params.toString()}`, { scroll: false });
}

function handleFilterChange(patch: Partial<ProductFilters>) {
  const next = { ...filters, ...patch, page: 1 };
  setFilters(next);
  setActiveView(null);
  setRuntimeColumns(null);
  const params = serializeFiltersToSearchParams(next);
  router.replace(`?${params.toString()}`, { scroll: false });
}
```

- [ ] **Step 3: Render the new UI pieces**

Add to the JSX in this order, above the existing filters bar:

```tsx
<div className="flex items-center gap-2">
  <PierceAssuranceBadge onClick={/* open existing sync history dialog */} />
  {/* existing SyncDatabaseButton + New Item button remain in place */}
</div>

<SavedViewsBar
  activeSlug={activeView?.slug ?? null}
  activeId={activeView?.id ?? null}
  onPresetClick={handlePresetClick}
  onSaveClick={() => setSaveDialogOpen(true)}
  onDeleteClick={(v) => setDeleteTarget(v)}
/>

{/* ProductFiltersBar now receives onChange={handleFilterChange} */}

<div className="flex justify-end">
  <ColumnVisibilityToggle
    runtimeOverride={runtimeColumns}
    onUserChange={setBaseColumns}
    onResetRuntime={() => setRuntimeColumns(null)}
  />
</div>

<ProductTable
  {/* existing props */}
  visibleColumns={runtimeColumns ?? baseColumns}
/>

<SaveViewDialog
  open={saveDialogOpen}
  onOpenChange={setSaveDialogOpen}
  filters={filters}
  columnPreferences={{ visible: runtimeColumns ?? baseColumns }}
  onSaved={(v) => setActiveView(v)}
/>

<DeleteViewDialog
  view={deleteTarget}
  onOpenChange={(o) => !o && setDeleteTarget(null)}
  onDeleted={(v) => { if (activeView?.id === v.id) setActiveView(null); setDeleteTarget(null); }}
/>
```

- [ ] **Step 4: Empty-state copy when a preset returns zero rows**

When `results.total === 0` AND `activeView !== null`, render a named empty state inside the table container instead of the default "no products found":

```tsx
{total === 0 && activeView && (
  <div className="rounded-md border border-dashed p-6 text-center">
    <p className="text-sm font-medium">No items match &ldquo;{activeView.name}&rdquo;.</p>
    <p className="mt-1 text-xs text-muted-foreground">
      Try clearing the preset or widening a filter.
    </p>
    <Button size="sm" variant="outline" className="mt-3" onClick={() => handleFilterChange(EMPTY_FILTERS)}>
      Clear Preset
    </Button>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "$(cat <<'EOF'
feat(products): wire SavedViewsBar, column toggle, Pierce badge

Preset click sets filter + column override + URL view param. Filter
edit drops the view param and resets active view. URL is the single
source of truth for filter state; runtime columns live in React state.
Named empty state when a preset returns zero rows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase I — Final verification

### Task 26: E2E Playwright spec

**Files:**
- Create: `tests/e2e/products-interactive.spec.ts`

- [ ] **Step 1: Find the existing Playwright config and helpers**

Run: `ls tests/e2e/ 2>/dev/null && cat playwright.config.ts 2>/dev/null | head -30`
Expected: the repo's Playwright layout becomes visible. If no e2e infrastructure exists yet, skip this task and note it in the final hand-off — unit + route tests alone are sufficient for merge; full E2E lands in a follow-up.

If Playwright exists, write a spec that: (1) signs in as an admin seeded user, (2) navigates to `/products`, (3) clicks the "Never sold" preset chip and asserts the URL contains `view=dead-never-sold`, (4) opens the Save View dialog, enters a name, submits, reloads the page, asserts the new user chip appears, (5) navigates with Tab to the SavedViewsBar and activates a chip with Enter.

- [ ] **Step 2: Run the spec**

Run: the repo's standard Playwright command (look at `package.json` scripts — typically `npm run test:e2e`).
Expected: the spec passes end-to-end against a dev server running `npm run dev`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/products-interactive.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): preset click, save view, keyboard nav on products page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 27: Visual polish and guidelines pass

**Files:**
- Modify (as needed): `src/components/products/*.tsx`, `src/app/products/page.tsx`

- [ ] **Step 1: Invoke the `web-design-guidelines` skill**

Run the skill against `/products`. Address each flagged item. Common fixes: `font-variant-numeric: tabular-nums` on any numeric column that was missed, curly quotes in user-visible copy, `aria-live="polite"` on toasts, `spellCheck={false}` on identifier inputs, `truncate + min-w-0` on narrow text cells, ellipsis `…` in placeholders.

- [ ] **Step 2: Invoke the `frontend-design` skill**

Review `SavedViewsBar`, `DccPicker`, and extended product columns for hierarchy, spacing, and contrast. Apply polish per its recommendations.

- [ ] **Step 3: Invoke the `vercel-react-view-transitions` skill**

Wrap the `ProductTable` body in a `<ViewTransition>` and trigger a named transition on preset swap so rows cross-fade. Honor `prefers-reduced-motion` — the skill's reference covers this.

- [ ] **Step 4: Run the accessibility check**

Run axe (or the repo's equivalent e.g. `npx @axe-core/cli http://localhost:3000/products`) — zero serious/critical violations.

- [ ] **Step 5: Commit polish**

```bash
git add -u
git commit -m "$(cat <<'EOF'
polish(products): web guidelines, frontend-design, view transitions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 28: Ship-check and PR

**Files:** (no new files)

- [ ] **Step 1: Confirm clean tree**

Run: `git status --short`
Expected: empty output.

- [ ] **Step 2: Run ship-check**

Run: `npm run ship-check`
Expected: PASS. If it fails, fix the failures in new commits — never skip hooks.

- [ ] **Step 3: Open PR**

Run: `npm run git:publish-pr`
Expected: PR URL printed.

- [ ] **Step 4: Sanity check on Supabase mirror (after merge + deploy)**

After the PR merges and prod deploys, trigger a manual sync via the Sync Database button and run:

```bash
npx tsx scripts/test-prism-sync-dcc-estsales.ts
```
with `SAMPLE_SKU=<known-stocked-sku>` in `.env`. Expected: the OK message. If any field mismatches, open a follow-up issue.

---

## Follow-ups out of scope (PR #2)

These are captured in the spec and not built here:
- `ItemHistory` aggregation in 30/90/365-day windows.
- 8 velocity-driven presets (Fast movers, Rising stars, Slowing sellers, Smart reorder, Profit winners, Stockout-prone, Capital sitting, Margin bleeders).
- New mirror columns: `units_sold_30d/90d/365d`, `revenue_365d`, `cogs_365d`, `velocity_ratio`, `stock_trend`, `days_of_stock`, `stockout_events_3y`, `last_purchase_date`.
