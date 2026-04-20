/**
 * READ-ONLY Prism reference-data snapshot.
 *
 * One-time dump of every Prism ref table laportal needs, scoped to Pierce
 * (LocationID IN 2 PIER, 3 PCOP, 4 PFS). Output committed into the repo so
 * a dev box without Prism access can still populate dropdowns and run tests.
 *
 * Covers:
 *   - Vendor master (scoped to vendors that have Pierce inventory)
 *   - DCC master (global — it's district-wide but small)
 *   - Item_Tax_Type (4 values, static)
 *   - TagType (sorted by Pierce usage count — see fill-rate snapshot)
 *   - InventoryStatusCodes (small)
 *   - PackageType (small)
 *   - Binding (small, textbook-only)
 *   - Color ref (discovered via INFORMATION_SCHEMA probe)
 *
 * Each array is sorted by Pierce usage frequency where applicable, with
 * alphabetic tiebreaker. The snapshot embeds a generatedAt timestamp so we
 * know how stale it is.
 *
 * Usage: npx tsx scripts/dump-prism-ref-snapshot.ts
 *
 * Safety: every query below is SELECT-only. No INSERT, UPDATE, DELETE, DDL,
 * or EXEC of writing procs.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

const PIERCE_LOCS = "2, 3, 4";

async function main() {
  const pool = await getPrismPool();
  console.log("=== Prism ref snapshot — read-only ===\n");

  // --- Vendors scoped to Pierce inventory ---
  console.log("Vendors (Pierce-scoped)…");
  const vendors = await pool.request().query<{ vendorId: number; name: string; pierceItems: number }>(`
    SELECT v.VendorID AS vendorId,
           LTRIM(RTRIM(v.Name)) AS name,
           COUNT(DISTINCT i.SKU) AS pierceItems
    FROM VendorMaster v
    INNER JOIN Item i ON i.VendorID = v.VendorID
    INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN (${PIERCE_LOCS})
    GROUP BY v.VendorID, LTRIM(RTRIM(v.Name))
    ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(v.Name)) ASC
  `);
  console.log(`  ${vendors.recordset.length} vendors`);

  // --- DCCs (district-wide but small, ~1000) ---
  console.log("DCCs…");
  const dccs = await pool.request().query<{
    dccId: number;
    deptNum: number;
    classNum: number;
    catNum: number;
    deptName: string | null;
    className: string | null;
    catName: string | null;
  }>(`
    SELECT d.DCCID AS dccId,
           d.Department AS deptNum,
           d.Class AS classNum,
           d.Category AS catNum,
           LTRIM(RTRIM(dep.DeptName)) AS deptName,
           LTRIM(RTRIM(cls.ClassName)) AS className,
           LTRIM(RTRIM(cat.CatName)) AS catName
    FROM DeptClassCat d
    LEFT JOIN DCC_Department dep ON d.Department = dep.Department
    LEFT JOIN DCC_Class cls ON d.Department = cls.Department AND d.Class = cls.Class
    LEFT JOIN DCC_Category cat ON d.Department = cat.Department AND d.Class = cat.Class AND d.Category = cat.Category
    WHERE d.DCCType = 3
    ORDER BY dep.DeptName, cls.ClassName, cat.CatName
  `);
  console.log(`  ${dccs.recordset.length} DCCs`);

  // --- Item_Tax_Type ---
  console.log("Item tax types…");
  const taxTypes = await pool.request().query<{ taxTypeId: number; description: string; pierceItems: number }>(`
    SELECT t.ItemTaxTypeID AS taxTypeId,
           LTRIM(RTRIM(t.Description)) AS description,
           (SELECT COUNT(DISTINCT i.SKU) FROM Item i
            INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN (${PIERCE_LOCS})
            WHERE i.ItemTaxTypeID = t.ItemTaxTypeID) AS pierceItems
    FROM Item_Tax_Type t
    ORDER BY pierceItems DESC, t.Description ASC
  `);
  console.log(`  ${taxTypes.recordset.length} tax types`);

  // --- TagType — sorted by Pierce inventory usage ---
  console.log("Tag types (Pierce-sorted)…");
  const tagTypes = await pool.request().query<{
    tagTypeId: number;
    label: string;
    subsystem: number | null;
    pierceRows: number;
  }>(`
    SELECT t.TagTypeID AS tagTypeId,
           LTRIM(RTRIM(t.Description)) AS label,
           t.Subsystem AS subsystem,
           ISNULL(c.pierceRows, 0) AS pierceRows
    FROM TagType t
    LEFT JOIN (
      SELECT inv.TagTypeID, COUNT(*) AS pierceRows
      FROM Inventory inv
      WHERE inv.LocationID IN (${PIERCE_LOCS}) AND inv.TagTypeID IS NOT NULL
      GROUP BY inv.TagTypeID
    ) c ON c.TagTypeID = t.TagTypeID
    ORDER BY ISNULL(c.pierceRows, 0) DESC, t.Description ASC
  `);
  console.log(`  ${tagTypes.recordset.length} tag types (${tagTypes.recordset.filter((r) => r.pierceRows > 0).length} in Pierce use)`);

  // --- InventoryStatusCodes ---
  console.log("Inventory status codes…");
  const statusCodes = await pool.request().query<{
    statusCodeId: number;
    label: string;
    pierceRows: number;
  }>(`
    SELECT s.InvStatusCodeID AS statusCodeId,
           LTRIM(RTRIM(s.StatusCodeName)) AS label,
           (SELECT COUNT(*) FROM Inventory inv
            WHERE inv.LocationID IN (${PIERCE_LOCS})
              AND inv.StatusCodeID = s.InvStatusCodeID) AS pierceRows
    FROM InventoryStatusCodes s
    ORDER BY pierceRows DESC, s.StatusCodeName ASC
  `);
  console.log(`  ${statusCodes.recordset.length} status codes`);

  // --- PackageType ---
  console.log("Package types…");
  const packageTypes = await pool.request().query<{
    code: string;
    label: string | null;
    defaultQty: number;
    pierceItems: number;
  }>(`
    SELECT LTRIM(RTRIM(p.PackageType)) AS code,
           LTRIM(RTRIM(p.Description)) AS label,
           p.DefaultQty AS defaultQty,
           (SELECT COUNT(DISTINCT gm.SKU) FROM GeneralMerchandise gm
            INNER JOIN Inventory inv ON inv.SKU = gm.SKU AND inv.LocationID IN (${PIERCE_LOCS})
            WHERE LTRIM(RTRIM(gm.PackageType)) = LTRIM(RTRIM(p.PackageType))) AS pierceItems
    FROM PackageType p
    ORDER BY pierceItems DESC, p.PackageType ASC
  `);
  console.log(`  ${packageTypes.recordset.length} package types`);

  // --- Binding (textbook) ---
  console.log("Bindings…");
  const bindings = await pool.request().query<{
    bindingId: number;
    label: string;
    pierceBooks: number;
  }>(`
    SELECT b.BindingID AS bindingId,
           LTRIM(RTRIM(b.Name)) AS label,
           (SELECT COUNT(DISTINCT tb.SKU) FROM Textbook tb
            INNER JOIN Inventory inv ON inv.SKU = tb.SKU AND inv.LocationID IN (${PIERCE_LOCS})
            WHERE tb.BindingID = b.BindingID) AS pierceBooks
    FROM Binding b
    ORDER BY pierceBooks DESC, b.Name ASC
  `);
  console.log(`  ${bindings.recordset.length} bindings`);

  // --- Color ref discovery ---
  console.log("Color ref table discovery…");
  const colorTables = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE'
      AND (TABLE_NAME LIKE '%Color%' OR TABLE_NAME = 'Color' OR TABLE_NAME = 'ItemColor')
    ORDER BY TABLE_NAME
  `);
  console.log(`  candidates: ${colorTables.recordset.map((t) => t.TABLE_NAME).join(", ")}`);

  type Color = { colorId: number; label: string | null; pierceItems: number };
  let colors: Color[] = [];
  let colorTableUsed: string | null = null;
  // Try the most likely candidates in order
  for (const candidate of ["Color", "ItemColor", "Item_Color", "Master_Color"]) {
    if (!colorTables.recordset.some((t) => t.TABLE_NAME.toLowerCase() === candidate.toLowerCase())) continue;
    try {
      const cols = await pool.request().query<{ COLUMN_NAME: string }>(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${candidate}' ORDER BY ORDINAL_POSITION
      `);
      const colNames = cols.recordset.map((c) => c.COLUMN_NAME);
      // Heuristics: ID column could be ColorID, Color, or first int column; label is Description/Name
      const idCol = colNames.find((n) => /^(ColorID|Color|ID)$/i.test(n));
      const labelCol = colNames.find((n) => /^(Description|Name|ColorName)$/i.test(n));
      if (!idCol || !labelCol) {
        console.log(`  ${candidate}: missing ID or label column (have ${colNames.join(", ")})`);
        continue;
      }
      const r = await pool.request().query(`
        SELECT TOP 200 c.${idCol} AS colorId,
               LTRIM(RTRIM(c.${labelCol})) AS label,
               ISNULL(usage.pierceItems, 0) AS pierceItems
        FROM [${candidate}] c
        LEFT JOIN (
          SELECT gm.Color, COUNT(DISTINCT gm.SKU) AS pierceItems
          FROM GeneralMerchandise gm
          INNER JOIN Inventory inv ON inv.SKU = gm.SKU AND inv.LocationID IN (${PIERCE_LOCS})
          GROUP BY gm.Color
        ) usage ON usage.Color = c.${idCol}
        ORDER BY ISNULL(usage.pierceItems, 0) DESC, c.${labelCol} ASC
      `);
      colors = r.recordset as Color[];
      colorTableUsed = `${candidate}(${idCol}, ${labelCol})`;
      console.log(`  ${candidate}: ${colors.length} colors returned`);
      break;
    } catch (err) {
      console.log(`  ${candidate}: query failed (${err instanceof Error ? err.message : err})`);
    }
  }
  if (colors.length === 0) {
    console.log("  WARN: no Color ref table found or queryable. Falling back to SELECT DISTINCT from GeneralMerchandise.");
    const fb = await pool.request().query<{ colorId: number; pierceItems: number }>(`
      SELECT gm.Color AS colorId, COUNT(DISTINCT gm.SKU) AS pierceItems
      FROM GeneralMerchandise gm
      INNER JOIN Inventory inv ON inv.SKU = gm.SKU AND inv.LocationID IN (${PIERCE_LOCS})
      WHERE gm.Color > 0
      GROUP BY gm.Color
      ORDER BY COUNT(DISTINCT gm.SKU) DESC
    `);
    colors = fb.recordset.map((r) => ({ colorId: r.colorId, label: null, pierceItems: r.pierceItems }));
    colorTableUsed = "FALLBACK: SELECT DISTINCT gm.Color (no labels)";
    console.log(`  fallback: ${colors.length} distinct color IDs (unlabeled)`);
  }

  // --- Write snapshot ---
  const snapshot = {
    generatedAt: new Date().toISOString(),
    scope: { pierceLocations: [2, 3, 4] },
    notes: {
      colorTableUsed,
      usageNote:
        "Arrays sorted by Pierce usage frequency (descending), alphabetic tiebreaker. Counts come from live Prism queries at generation time.",
    },
    vendors: vendors.recordset,
    dccs: dccs.recordset,
    taxTypes: taxTypes.recordset,
    tagTypes: tagTypes.recordset,
    inventoryStatusCodes: statusCodes.recordset,
    packageTypes: packageTypes.recordset,
    bindings: bindings.recordset,
    colors,
  };

  const outDir = path.resolve(process.cwd(), "docs/prism");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "ref-data-snapshot-2026-04-19.json");
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\nWrote ${outPath} (${sizeKb} KB)`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
