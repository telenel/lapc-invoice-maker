/**
 * Discovery script: dump everything we need to know about the Item /
 * GeneralMerchandise / Inventory schema and related procs before
 * designing the Edit + batch feature.
 *
 * Read-only. No writes.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

type ProcRow = { name: string };
type ParamRow = {
  parameter_id: number;
  name: string;
  type_name: string;
  max_length: number;
  is_output: boolean;
  has_default_value: boolean;
};
type ColumnRow = {
  column_id: number;
  name: string;
  type_name: string;
  max_length: number;
  is_nullable: boolean;
  is_identity: boolean;
  is_computed: boolean;
  default_definition: string | null;
};
type TriggerRow = {
  name: string;
  is_disabled: boolean;
  is_instead_of_trigger: boolean;
  parent_name: string;
};
type IndexRow = {
  index_name: string;
  is_unique: boolean;
  is_primary_key: boolean;
  columns: string;
};

async function main() {
  const pool = await getPrismPool();

  console.log("=".repeat(72));
  console.log("1. PROCS matching Item / Inventory / GM patterns");
  console.log("=".repeat(72));
  const procs = await pool.request().query<ProcRow>(`
    SELECT name
    FROM sys.procedures
    WHERE name LIKE 'P_Item%'
       OR name LIKE 'P_Inventory%'
       OR name LIKE 'P_GM%'
       OR name LIKE '%ItemUpdate%'
       OR name LIKE '%Item_Update%'
       OR name LIKE '%Item_Edit%'
       OR name LIKE '%UpdateItem%'
       OR name LIKE '%EditItem%'
    ORDER BY name
  `);
  for (const p of procs.recordset) console.log(`  ${p.name}`);

  console.log("");
  console.log("=".repeat(72));
  console.log("2. PARAMETERS for each candidate update/edit proc");
  console.log("=".repeat(72));
  const updateProcs = procs.recordset.filter(
    (p) =>
      /update/i.test(p.name) ||
      /edit/i.test(p.name) ||
      /change/i.test(p.name) ||
      /modify/i.test(p.name),
  );
  if (updateProcs.length === 0) {
    console.log("  (none found that look like update/edit procs)");
  }
  for (const p of updateProcs) {
    console.log(`\n  -- ${p.name} --`);
    const params = await pool
      .request()
      .input("proc", sql.VarChar, p.name)
      .query<ParamRow>(`
        SELECT
          p.parameter_id,
          p.name,
          TYPE_NAME(p.user_type_id) AS type_name,
          p.max_length,
          p.is_output,
          p.has_default_value
        FROM sys.parameters p
        WHERE p.object_id = OBJECT_ID(@proc)
        ORDER BY p.parameter_id
      `);
    for (const param of params.recordset) {
      console.log(
        `    ${String(param.parameter_id).padStart(2)}  ${param.name.padEnd(35)} ${param.type_name}(${param.max_length}) ${param.is_output ? "OUT " : ""}${param.has_default_value ? "default" : ""}`,
      );
    }
  }

  console.log("");
  console.log("=".repeat(72));
  console.log("3. COLUMNS on Item, GeneralMerchandise, Inventory");
  console.log("=".repeat(72));
  const tables = ["Item", "GeneralMerchandise", "Inventory"];
  for (const t of tables) {
    console.log(`\n  -- ${t} --`);
    const cols = await pool
      .request()
      .input("t", sql.VarChar, t)
      .query<ColumnRow>(`
        SELECT
          c.column_id,
          c.name,
          TYPE_NAME(c.user_type_id) AS type_name,
          c.max_length,
          c.is_nullable,
          c.is_identity,
          c.is_computed,
          dc.definition AS default_definition
        FROM sys.columns c
        LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE c.object_id = OBJECT_ID(@t)
        ORDER BY c.column_id
      `);
    for (const col of cols.recordset) {
      const flags = [
        col.is_identity ? "IDENTITY" : null,
        col.is_computed ? "COMPUTED" : null,
        col.is_nullable ? "NULL" : "NOT NULL",
        col.default_definition ? `DEFAULT ${col.default_definition}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(
        `    ${String(col.column_id).padStart(3)}  ${col.name.padEnd(28)} ${col.type_name}(${col.max_length})  ${flags}`,
      );
    }
  }

  console.log("");
  console.log("=".repeat(72));
  console.log("4. TRIGGERS on Item / GeneralMerchandise / Inventory");
  console.log("=".repeat(72));
  const triggers = await pool.request().query<TriggerRow>(`
    SELECT
      t.name,
      t.is_disabled,
      t.is_instead_of_trigger,
      OBJECT_NAME(t.parent_id) AS parent_name
    FROM sys.triggers t
    WHERE OBJECT_NAME(t.parent_id) IN ('Item', 'GeneralMerchandise', 'Inventory')
    ORDER BY parent_name, name
  `);
  for (const tr of triggers.recordset) {
    console.log(
      `  ${tr.parent_name.padEnd(22)} ${tr.name.padEnd(40)} ${tr.is_instead_of_trigger ? "INSTEAD OF" : "AFTER"} ${tr.is_disabled ? "[disabled]" : ""}`,
    );
  }

  console.log("");
  console.log("=".repeat(72));
  console.log("5. UNIQUE CONSTRAINTS / INDEXES on Item");
  console.log("=".repeat(72));
  const indexes = await pool.request().query<IndexRow>(`
    SELECT
      i.name AS index_name,
      i.is_unique,
      i.is_primary_key,
      STUFF((
        SELECT ', ' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
      ), 1, 2, '') AS columns
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('Item')
      AND i.type > 0
    ORDER BY i.is_primary_key DESC, i.is_unique DESC, i.name
  `);
  for (const idx of indexes.recordset) {
    const flags = [
      idx.is_primary_key ? "PK" : null,
      idx.is_unique ? "UNIQUE" : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `  ${(idx.index_name || "(heap)").padEnd(40)} ${flags.padEnd(10)} (${idx.columns})`,
    );
  }

  console.log("");
  console.log("=".repeat(72));
  console.log("6. fStatus / fDiscontinue values currently used in Item");
  console.log("=".repeat(72));
  const statusCounts = await pool
    .request()
    .query<{ fStatus: number | null; fDiscontinue: number | null; n: number }>(`
      SELECT fStatus, fDiscontinue, COUNT(*) AS n
      FROM Item
      GROUP BY fStatus, fDiscontinue
      ORDER BY fStatus, fDiscontinue
    `);
  for (const row of statusCounts.recordset) {
    console.log(
      `  fStatus=${String(row.fStatus).padEnd(4)} fDiscontinue=${String(row.fDiscontinue).padEnd(4)} count=${row.n}`,
    );
  }

  console.log("");
  console.log("=".repeat(72));
  console.log("Done.");
  console.log("=".repeat(72));
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
