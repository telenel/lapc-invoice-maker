/**
 * READ-ONLY, one-time fill-rate analysis.
 *
 * Measures, for every editable column on Item / GeneralMerchandise / Textbook /
 * Inventory, what fraction of Pierce rows actually have a value there. This
 * snapshot becomes the source of truth for which fields belong on the primary
 * tab of the Pierce-centric item editor vs behind a "Show advanced" toggle.
 *
 * Scope:
 *   - Pierce locations: LocationID IN (2 PIER, 3 PCOP, 4 PFS). PBO (5) excluded.
 *   - GM universe: SKUs that exist in GeneralMerchandise AND have an Inventory
 *     row at any Pierce location.
 *   - Textbook-active universe: SKUs in Textbook AND at least one Pierce
 *     Inventory row with LastSaleDate >= 18 months ago. ("Currently adopted or
 *     recently sold" — Marcos's direction. No adoption-table dependency.)
 *   - Inventory rows: scoped to Pierce LocationIDs only. Measured per row
 *     (so a SKU stocked at all three locations contributes three rows).
 *
 * Output:
 *   - docs/prism/field-usage-snapshot-2026-04-19.json (raw counts)
 *   - docs/prism/field-usage.md (ranked markdown tables)
 *
 * Safety: SELECT-only. No writes, no DDL, no procs. ~30s runtime.
 *
 * Usage: npx tsx scripts/analyze-prism-field-usage.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

const PIERCE_LOCS = "2, 3, 4";
const TEXTBOOK_ACTIVE_MONTHS = 18;

// ---------- Column definitions ----------
// For each column: the SQL expression that returns 1 when "populated" and 0
// otherwise. Semantics vary by column type — numeric 0 vs null-or-zero vs
// trimmed string length, etc.

interface ColumnSpec {
  table: string;
  column: string;
  populatedExpr: string; // SQL that evaluates to 1 when populated, else 0
  // Tag to group in output. Kept short.
  kind: "id" | "str" | "money" | "int" | "flag" | "date" | "decimal";
}

// Table aliases used in FROM clauses: Item=i, GeneralMerchandise=g, Textbook=t, Inventory=inv.
// Every column reference in populatedExpr is qualified to avoid ambiguity on
// columns that appear on multiple tables (e.g., Weight on Item & GM & Textbook).
const ITEM_COLS: ColumnSpec[] = [
  { table: "Item", column: "BarCode", populatedExpr: "CASE WHEN i.BarCode IS NOT NULL AND LEN(LTRIM(RTRIM(i.BarCode))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Item", column: "VendorID", populatedExpr: "CASE WHEN i.VendorID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "DCCID", populatedExpr: "CASE WHEN i.DCCID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "UsedDCCID", populatedExpr: "CASE WHEN i.UsedDCCID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "TypeID_isUsed", populatedExpr: "CASE WHEN i.TypeID = 2 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Item", column: "MinOrderQty", populatedExpr: "CASE WHEN i.MinOrderQty > 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Item", column: "txComment", populatedExpr: "CASE WHEN i.txComment IS NOT NULL AND LEN(LTRIM(RTRIM(i.txComment))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Item", column: "fListPriceFlag", populatedExpr: "CASE WHEN i.fListPriceFlag = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Item", column: "fDiscontinue", populatedExpr: "CASE WHEN i.fDiscontinue = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Item", column: "DiscCodeID", populatedExpr: "CASE WHEN i.DiscCodeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "Weight", populatedExpr: "CASE WHEN i.Weight IS NOT NULL AND i.Weight > 0 THEN 1 ELSE 0 END", kind: "decimal" },
  { table: "Item", column: "ItemTaxTypeID", populatedExpr: "CASE WHEN i.ItemTaxTypeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "StyleID", populatedExpr: "CASE WHEN i.StyleID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "ItemSeasonCodeID", populatedExpr: "CASE WHEN i.ItemSeasonCodeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Item", column: "fPerishable", populatedExpr: "CASE WHEN i.fPerishable = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Item", column: "fIDRequired", populatedExpr: "CASE WHEN i.fIDRequired = 1 THEN 1 ELSE 0 END", kind: "flag" },
];

const GM_COLS: ColumnSpec[] = [
  { table: "GeneralMerchandise", column: "AlternateVendorID", populatedExpr: "CASE WHEN g.AlternateVendorID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "GeneralMerchandise", column: "MfgID_distinctFromVendor", populatedExpr: "CASE WHEN g.MfgID > 0 AND g.MfgID <> i.VendorID THEN 1 ELSE 0 END", kind: "id" },
  { table: "GeneralMerchandise", column: "Description", populatedExpr: "CASE WHEN g.Description IS NOT NULL AND LEN(LTRIM(RTRIM(g.Description))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "GeneralMerchandise", column: "Type", populatedExpr: "CASE WHEN g.Type IS NOT NULL AND LEN(LTRIM(RTRIM(g.Type))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "GeneralMerchandise", column: "Color", populatedExpr: "CASE WHEN g.Color > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "GeneralMerchandise", column: "Size", populatedExpr: "CASE WHEN g.Size IS NOT NULL AND LEN(LTRIM(RTRIM(g.Size))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "GeneralMerchandise", column: "SizeID", populatedExpr: "CASE WHEN g.SizeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "GeneralMerchandise", column: "CatalogNumber", populatedExpr: "CASE WHEN g.CatalogNumber IS NOT NULL AND LEN(LTRIM(RTRIM(g.CatalogNumber))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "GeneralMerchandise", column: "PackageType", populatedExpr: "CASE WHEN g.PackageType IS NOT NULL AND LEN(LTRIM(RTRIM(g.PackageType))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "GeneralMerchandise", column: "UnitsPerPack_gt1", populatedExpr: "CASE WHEN g.UnitsPerPack > 1 THEN 1 ELSE 0 END", kind: "int" },
  { table: "GeneralMerchandise", column: "Weight", populatedExpr: "CASE WHEN g.Weight IS NOT NULL AND g.Weight > 0 THEN 1 ELSE 0 END", kind: "decimal" },
  { table: "GeneralMerchandise", column: "ImageURL", populatedExpr: "CASE WHEN g.ImageURL IS NOT NULL AND LEN(LTRIM(RTRIM(g.ImageURL))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "GeneralMerchandise", column: "OrderIncrement_gt1", populatedExpr: "CASE WHEN g.OrderIncrement > 1 THEN 1 ELSE 0 END", kind: "int" },
  { table: "GeneralMerchandise", column: "UseScaleInterface", populatedExpr: "CASE WHEN g.UseScaleInterface = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "GeneralMerchandise", column: "Tare", populatedExpr: "CASE WHEN g.Tare IS NOT NULL AND g.Tare > 0 THEN 1 ELSE 0 END", kind: "decimal" },
];

const TEXTBOOK_COLS: ColumnSpec[] = [
  { table: "Textbook", column: "BindingID", populatedExpr: "CASE WHEN t.BindingID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Textbook", column: "UsedSKU", populatedExpr: "CASE WHEN t.UsedSKU > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Textbook", column: "TextStatusID", populatedExpr: "CASE WHEN t.TextStatusID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Textbook", column: "StatusDate", populatedExpr: "CASE WHEN t.StatusDate IS NOT NULL THEN 1 ELSE 0 END", kind: "date" },
  { table: "Textbook", column: "Author", populatedExpr: "CASE WHEN t.Author IS NOT NULL AND LEN(LTRIM(RTRIM(t.Author))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Title", populatedExpr: "CASE WHEN t.Title IS NOT NULL AND LEN(LTRIM(RTRIM(t.Title))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "ISBN", populatedExpr: "CASE WHEN t.ISBN IS NOT NULL AND LEN(LTRIM(RTRIM(t.ISBN))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Imprint", populatedExpr: "CASE WHEN t.Imprint IS NOT NULL AND LEN(LTRIM(RTRIM(t.Imprint))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Edition", populatedExpr: "CASE WHEN t.Edition IS NOT NULL AND LEN(LTRIM(RTRIM(t.Edition))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Copyright", populatedExpr: "CASE WHEN t.Copyright IS NOT NULL AND LEN(LTRIM(RTRIM(t.Copyright))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Type", populatedExpr: "CASE WHEN t.Type IS NOT NULL AND LEN(LTRIM(RTRIM(t.Type))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Bookkey", populatedExpr: "CASE WHEN t.Bookkey IS NOT NULL AND LEN(LTRIM(RTRIM(t.Bookkey))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Textbook", column: "Weight", populatedExpr: "CASE WHEN t.Weight IS NOT NULL AND t.Weight > 0 THEN 1 ELSE 0 END", kind: "decimal" },
  { table: "Textbook", column: "ImageURL", populatedExpr: "CASE WHEN t.ImageURL IS NOT NULL AND LEN(LTRIM(RTRIM(t.ImageURL))) > 0 THEN 1 ELSE 0 END", kind: "str" },
];

const INVENTORY_COLS: ColumnSpec[] = [
  { table: "Inventory", column: "Retail", populatedExpr: "CASE WHEN inv.Retail IS NOT NULL AND inv.Retail > 0 THEN 1 ELSE 0 END", kind: "money" },
  { table: "Inventory", column: "Cost", populatedExpr: "CASE WHEN inv.Cost IS NOT NULL AND inv.Cost > 0 THEN 1 ELSE 0 END", kind: "money" },
  { table: "Inventory", column: "ExpectedCost", populatedExpr: "CASE WHEN inv.ExpectedCost IS NOT NULL AND inv.ExpectedCost > 0 THEN 1 ELSE 0 END", kind: "money" },
  { table: "Inventory", column: "StockOnHand_nonzero", populatedExpr: "CASE WHEN inv.StockOnHand IS NOT NULL AND inv.StockOnHand <> 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "MaximumStock", populatedExpr: "CASE WHEN inv.MaximumStock IS NOT NULL AND inv.MaximumStock > 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "MinimumStock", populatedExpr: "CASE WHEN inv.MinimumStock IS NOT NULL AND inv.MinimumStock > 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "AutoOrderQty", populatedExpr: "CASE WHEN inv.AutoOrderQty IS NOT NULL AND inv.AutoOrderQty > 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "MinOrderQty", populatedExpr: "CASE WHEN inv.MinOrderQty IS NOT NULL AND inv.MinOrderQty > 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "TaxTypeID", populatedExpr: "CASE WHEN inv.TaxTypeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Inventory", column: "TagTypeID", populatedExpr: "CASE WHEN inv.TagTypeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Inventory", column: "DiscCodeID", populatedExpr: "CASE WHEN inv.DiscCodeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Inventory", column: "StatusCodeID", populatedExpr: "CASE WHEN inv.StatusCodeID > 0 THEN 1 ELSE 0 END", kind: "id" },
  { table: "Inventory", column: "ReservedQty", populatedExpr: "CASE WHEN inv.ReservedQty IS NOT NULL AND inv.ReservedQty <> 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "RentalQty", populatedExpr: "CASE WHEN inv.RentalQty IS NOT NULL AND inv.RentalQty <> 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "RoyaltyCost", populatedExpr: "CASE WHEN inv.RoyaltyCost IS NOT NULL AND inv.RoyaltyCost > 0 THEN 1 ELSE 0 END", kind: "money" },
  { table: "Inventory", column: "MinRoyaltyCost", populatedExpr: "CASE WHEN inv.MinRoyaltyCost IS NOT NULL AND inv.MinRoyaltyCost > 0 THEN 1 ELSE 0 END", kind: "money" },
  { table: "Inventory", column: "EstSales_nonzero", populatedExpr: "CASE WHEN inv.EstSales <> 0 THEN 1 ELSE 0 END", kind: "int" },
  { table: "Inventory", column: "EstSalesLocked", populatedExpr: "CASE WHEN inv.EstSalesLocked = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Inventory", column: "fTXWantListFlag", populatedExpr: "CASE WHEN inv.fTXWantListFlag = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Inventory", column: "fTXBuybackListFlag", populatedExpr: "CASE WHEN inv.fTXBuybackListFlag = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Inventory", column: "fInvListPriceFlag", populatedExpr: "CASE WHEN inv.fInvListPriceFlag = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Inventory", column: "fRentOnly", populatedExpr: "CASE WHEN inv.fRentOnly = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Inventory", column: "fNoReturns", populatedExpr: "CASE WHEN inv.fNoReturns = 1 THEN 1 ELSE 0 END", kind: "flag" },
  { table: "Inventory", column: "TextComment", populatedExpr: "CASE WHEN inv.TextComment IS NOT NULL AND LEN(LTRIM(RTRIM(inv.TextComment))) > 0 THEN 1 ELSE 0 END", kind: "str" },
  { table: "Inventory", column: "LastSaleDate", populatedExpr: "CASE WHEN inv.LastSaleDate IS NOT NULL THEN 1 ELSE 0 END", kind: "date" },
];

function buildAggregateSql(alias: string, cols: ColumnSpec[]): string {
  const parts = cols.map(
    (c, idx) => `  SUM(${c.populatedExpr}) AS c${idx}`,
  );
  return `${parts.join(",\n")}`;
}

interface FieldResult {
  table: string;
  column: string;
  kind: string;
  populated: number;
  total: number;
  pct: number;
}

async function measure(
  pool: Awaited<ReturnType<typeof getPrismPool>>,
  label: string,
  fromClause: string,
  cols: ColumnSpec[],
): Promise<{ total: number; results: FieldResult[] }> {
  const aggregates = buildAggregateSql("x", cols);
  const sqlText = `
    SELECT COUNT(*) AS total_rows,
    ${aggregates}
    ${fromClause}
  `;
  const r = await pool.request().query(sqlText);
  const row = r.recordset[0] as Record<string, number>;
  const total = row.total_rows ?? 0;
  const results: FieldResult[] = cols.map((c, idx) => {
    const populated = row[`c${idx}`] ?? 0;
    return {
      table: c.table,
      column: c.column,
      kind: c.kind,
      populated,
      total,
      pct: total === 0 ? 0 : (populated / total) * 100,
    };
  });
  console.log(`\n== ${label} (n=${total.toLocaleString()}) ==`);
  results
    .slice()
    .sort((a, b) => b.pct - a.pct)
    .forEach((f) => {
      const bar = "█".repeat(Math.round(f.pct / 5));
      console.log(
        `  ${f.pct.toFixed(1).padStart(5)}%  ${bar.padEnd(20)}  ${f.table}.${f.column}  (${f.populated.toLocaleString()}/${total.toLocaleString()})`,
      );
    });
  return { total, results };
}

async function main() {
  const pool = await getPrismPool();
  console.log("Connecting to Prism (read-only)…");

  // Scope definitions as reusable FROM clauses
  const gmFromItem = `
    FROM Item i
    INNER JOIN GeneralMerchandise g ON g.SKU = i.SKU
    WHERE EXISTS (
      SELECT 1 FROM Inventory inv
      WHERE inv.SKU = i.SKU AND inv.LocationID IN (${PIERCE_LOCS})
    )
  `;
  const gmFromGm = `
    FROM GeneralMerchandise g
    INNER JOIN Item i ON i.SKU = g.SKU
    WHERE EXISTS (
      SELECT 1 FROM Inventory inv
      WHERE inv.SKU = g.SKU AND inv.LocationID IN (${PIERCE_LOCS})
    )
  `;
  const txActiveFromItem = `
    FROM Item i
    INNER JOIN Textbook t ON t.SKU = i.SKU
    WHERE EXISTS (
      SELECT 1 FROM Inventory inv
      WHERE inv.SKU = i.SKU
        AND inv.LocationID IN (${PIERCE_LOCS})
        AND inv.LastSaleDate >= DATEADD(month, -${TEXTBOOK_ACTIVE_MONTHS}, GETDATE())
    )
  `;
  const txActiveFromTextbook = `
    FROM Textbook t
    INNER JOIN Item i ON i.SKU = t.SKU
    WHERE EXISTS (
      SELECT 1 FROM Inventory inv
      WHERE inv.SKU = t.SKU
        AND inv.LocationID IN (${PIERCE_LOCS})
        AND inv.LastSaleDate >= DATEADD(month, -${TEXTBOOK_ACTIVE_MONTHS}, GETDATE())
    )
  `;
  const invFromGmPierce = `
    FROM Inventory inv
    WHERE inv.LocationID IN (${PIERCE_LOCS})
      AND EXISTS (SELECT 1 FROM GeneralMerchandise g WHERE g.SKU = inv.SKU)
  `;
  const invFromTxActivePierce = `
    FROM Inventory inv
    WHERE inv.LocationID IN (${PIERCE_LOCS})
      AND EXISTS (
        SELECT 1 FROM Textbook t WHERE t.SKU = inv.SKU
      )
      AND EXISTS (
        SELECT 1 FROM Inventory inv2
        WHERE inv2.SKU = inv.SKU
          AND inv2.LocationID IN (${PIERCE_LOCS})
          AND inv2.LastSaleDate >= DATEADD(month, -${TEXTBOOK_ACTIVE_MONTHS}, GETDATE())
      )
  `;

  const snapshot: Record<string, { total: number; results: FieldResult[] }> = {};

  snapshot["gm_item_fields"] = await measure(
    pool,
    "Item fields, GM universe (SKUs in GeneralMerchandise with Pierce inventory)",
    gmFromItem,
    ITEM_COLS,
  );
  snapshot["gm_gm_fields"] = await measure(
    pool,
    "GeneralMerchandise fields, GM universe",
    gmFromGm,
    GM_COLS,
  );
  snapshot["gm_inventory_fields"] = await measure(
    pool,
    "Inventory rows, GM items at Pierce locations",
    invFromGmPierce,
    INVENTORY_COLS,
  );

  snapshot["tx_item_fields"] = await measure(
    pool,
    `Item fields, active Textbook universe (sold at Pierce within ${TEXTBOOK_ACTIVE_MONTHS} months)`,
    txActiveFromItem,
    ITEM_COLS,
  );
  snapshot["tx_textbook_fields"] = await measure(
    pool,
    "Textbook fields, active Textbook universe",
    txActiveFromTextbook,
    TEXTBOOK_COLS,
  );
  snapshot["tx_inventory_fields"] = await measure(
    pool,
    "Inventory rows, active textbooks at Pierce locations",
    invFromTxActivePierce,
    INVENTORY_COLS,
  );

  // Write JSON snapshot
  const outDir = path.resolve(process.cwd(), "docs/prism");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "field-usage-snapshot-2026-04-19.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    scope: {
      pierceLocations: [2, 3, 4],
      textbookActiveWindow: `${TEXTBOOK_ACTIVE_MONTHS} months`,
    },
    snapshot,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${jsonPath}`);

  // Write human-readable markdown
  const mdPath = path.join(outDir, "field-usage.md");
  const md: string[] = [
    "# Prism field-usage snapshot",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Scope: Pierce locations (LocationID IN 2, 3, 4). PBO excluded. Textbook "active" = sold at any Pierce location within the last ${TEXTBOOK_ACTIVE_MONTHS} months.`,
    "",
    "Each table is sorted by % populated. Populated rules per column kind:",
    "",
    "- `str` — non-null AND trimmed length > 0",
    "- `id`  — > 0 (non-null)",
    "- `money` / `decimal` — non-null AND > 0",
    "- `int` — non-null AND > 0 (or `<> 0` for stock-on-hand / reservations)",
    "- `flag` — set to 1",
    "- `date` — non-null",
    "",
  ];
  for (const [key, section] of Object.entries(snapshot)) {
    md.push(`## ${key} (n=${section.total.toLocaleString()})`, "");
    md.push("| % | Column | Populated | Total |");
    md.push("|---:|---|---:|---:|");
    for (const f of section.results.slice().sort((a, b) => b.pct - a.pct)) {
      md.push(
        `| ${f.pct.toFixed(1)}% | \`${f.table}.${f.column}\` (${f.kind}) | ${f.populated.toLocaleString()} | ${f.total.toLocaleString()} |`,
      );
    }
    md.push("");
  }
  fs.writeFileSync(mdPath, md.join("\n"));
  console.log(`Wrote ${mdPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
