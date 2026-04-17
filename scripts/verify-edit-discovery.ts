/**
 * Cross-checks the CLI's edit-discovery findings against live Prism.
 * Runs the same queries the CLI probably ran, prints raw results so Marcos
 * can judge for himself.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

function header(text: string) {
  console.log(`\n=== ${text} ===`);
}

async function main() {
  const pool = await getPrismPool();

  // 1) Any item-update procs we might have missed?
  header("Q1: Procs matching Item+Update (any order)");
  const procs = await pool.request().query<{ name: string }>(`
    SELECT name FROM sys.procedures
    WHERE (name LIKE '%item%update%' OR name LIKE '%update%item%' OR name LIKE 'P_Item_%' OR name LIKE 'SP_%Item%')
    ORDER BY name
  `);
  procs.recordset.forEach(r => console.log("  " + r.name));

  // 2) Item columns — looking for fStatus vs fDiscontinue
  header("Q2: Item table columns (fStatus vs fDiscontinue)");
  const itemCols = await pool.request().query<{ name: string; is_nullable: number; system_type: string }>(`
    SELECT c.name, c.is_nullable, t.name AS system_type
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('Item')
    ORDER BY c.column_id
  `);
  itemCols.recordset.forEach(r => console.log(`  ${r.name} (${r.system_type}${r.is_nullable ? ", nullable" : ", NOT NULL"})`));

  // 3) GeneralMerchandise columns + NOT NULL check on Color / MfgID
  header("Q3: GeneralMerchandise columns");
  const gmCols = await pool.request().query<{ name: string; is_nullable: number; system_type: string }>(`
    SELECT c.name, c.is_nullable, t.name AS system_type
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('GeneralMerchandise')
    ORDER BY c.column_id
  `);
  gmCols.recordset.forEach(r => console.log(`  ${r.name} (${r.system_type}${r.is_nullable ? ", nullable" : ", NOT NULL"})`));

  // 4) Triggers on Item / GeneralMerchandise / Inventory
  header("Q4: Triggers on Item / GeneralMerchandise / Inventory");
  const triggers = await pool.request().query<{ trigger_name: string; table_name: string; type_desc: string }>(`
    SELECT t.name AS trigger_name, o.name AS table_name,
           CASE WHEN t.is_instead_of_trigger = 1 THEN 'INSTEAD OF' ELSE 'AFTER' END AS type_desc
    FROM sys.triggers t
    JOIN sys.objects o ON t.parent_id = o.object_id
    WHERE o.name IN ('Item', 'GeneralMerchandise', 'Inventory')
    ORDER BY o.name, t.name
  `);
  triggers.recordset.forEach(r => console.log(`  ${r.table_name}: ${r.trigger_name} (${r.type_desc})`));

  // 5) Unique constraints / indexes on Item.BarCode
  header("Q5: Indexes and constraints touching Item.BarCode");
  const idx = await pool.request().query<{ index_name: string; is_unique: number; is_primary_key: number; columns: string }>(`
    SELECT i.name AS index_name, i.is_unique, i.is_primary_key,
           STUFF((SELECT ', ' + c.name
                  FROM sys.index_columns ic2
                  JOIN sys.columns c ON c.column_id = ic2.column_id AND c.object_id = ic2.object_id
                  WHERE ic2.index_id = i.index_id AND ic2.object_id = i.object_id
                  ORDER BY ic2.key_ordinal
                  FOR XML PATH('')), 1, 2, '') AS columns
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('Item')
      AND EXISTS (
        SELECT 1 FROM sys.index_columns ic
        JOIN sys.columns c ON c.column_id = ic.column_id AND c.object_id = ic.object_id
        WHERE ic.index_id = i.index_id AND ic.object_id = i.object_id AND c.name = 'BarCode'
      )
  `);
  if (idx.recordset.length === 0) {
    console.log("  (no indexes touch BarCode)");
  } else {
    idx.recordset.forEach(r => console.log(`  ${r.index_name}: columns=[${r.columns}] unique=${!!r.is_unique} pk=${!!r.is_primary_key}`));
  }

  // 6) Is there a separate Textbook table?
  header("Q6: Tables matching Textbook/Book/Course (any schema)");
  const books = await pool.request().query<{ name: string; type_desc: string }>(`
    SELECT name, type_desc FROM sys.objects
    WHERE type IN ('U','V') AND (name LIKE '%Textbook%' OR name LIKE '%Book%' OR name LIKE '%Course%')
    ORDER BY name
  `);
  books.recordset.forEach(r => console.log(`  ${r.name} (${r.type_desc})`));

  // 7) Bonus — SP_MRUpdateItem / SP_POUpdateItem / SP_INVCUpdateItem params
  header("Q7: Params of SP_MRUpdateItem / SP_POUpdateItem / SP_INVCUpdateItem (to verify they're line-item level)");
  for (const name of ["SP_MRUpdateItem", "SP_POUpdateItem", "SP_INVCUpdateItem"]) {
    const params = await pool.request().input("n", sql.VarChar, name).query<{ name: string; type: string }>(`
      SELECT p.name, t.name AS type
      FROM sys.parameters p
      JOIN sys.types t ON p.user_type_id = t.user_type_id
      WHERE p.object_id = OBJECT_ID(@n)
      ORDER BY p.parameter_id
    `);
    console.log(`  ${name}: ${params.recordset.length === 0 ? "(not found)" : params.recordset.map(p => p.name).join(", ")}`);
  }

  process.exit(0);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
