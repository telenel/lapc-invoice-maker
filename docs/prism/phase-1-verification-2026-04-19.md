# Phase 1 verification — 2026-04-19

**Branch:** feat/item-editor-parity
**Scope:** product_inventory split + multi-location sync

## Observed row counts (dev Supabase post-sync)

| Table | Count |
|---|---:|
| products | 61,395 |
| product_inventory @ PIER (2) | 61,024 |
| product_inventory @ PCOP (3) | 18,511 |
| product_inventory @ PFS  (4) | 18,103 |
| product_inventory @ PBO  (5) | **0** (expected, hard rule) |

All counts fall within expected ranges (products >= 60k; PIER 45k-70k; PCOP
and PFS each 15k-25k). PBO = 0 confirms the CHECK constraint + query filter
are both working.

## Schema fix discovered during smoke

`status_code_id` and `tax_type_override_id` were declared `SMALLINT` in the
original migration but Prism's `InventoryStatusCodes.InvStatusCodeID` can hold
32-bit values (observed: `StatusCodeID = 1246576928` in live data — a Prism
sentinel for "no status assigned"). Both columns widened to `INTEGER` via:

- Migration `20260419182000_fix_product_inventory_id_types` (added to chain)
- ALTER applied live to dev Supabase before the successful sync run

## Label coverage

Sampled 10 rows from each ref-table join; all populated.

**Inventory tag type labels (tag_type_id / tag_type_label):**
- 10000059 → "LARGE no Price"
- 10000141 → "LARGE w/Price/Date"
- 3        → "LARGE w/Price/Color"
- 10000081 → "Large w/ ISBN"

**Inventory status code labels (status_code_id / status_code_label):**
- 2 → "Active" (all 10 sampled rows)

**Item tax type labels (item_tax_type_id / item_tax_type_label):**
- 3 → "NOT TAXABLE"
- 4 → "STATE"

**Binding labels (binding_id / binding_label):**
- 15 → "PAPERBACK"
- 11 → "LOOSELEAF"
- 0  → "NONE"

## FK integrity

Zero orphan `product_inventory` rows — the products upsert wrote all FK
targets successfully before any inventory rows landed.

```sql
SELECT COUNT(*) AS orphans
FROM product_inventory pi
LEFT JOIN products p ON p.sku = pi.sku
WHERE p.sku IS NULL;
-- orphans = 0
```

## Idempotency

Run 1: scanned=97638, updated=159051, removed=0, durationMs=60679
Run 2: scanned=97638, updated=159051, removed=0, durationMs=64624

Counts stable between runs (products=61395, inventory=97638 after both runs).
Updated count on run 2 matches run 1 — expected, since Phase 1 has no
hash-compare short-circuit; every row is unconditionally upserted. The `removed`
count is 0 on both runs, confirming the reap logic found nothing stale.

## Next phase

Phase 2 — expand `/api/products/refs` to return labeled TagType, StatusCode,
PackageType, Color, Binding in addition to the existing Vendor/DCC/TaxType.
