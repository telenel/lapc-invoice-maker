/**
 * Full Prism database inventory for capability mapping.
 *
 * Dumps tables, stored procs, views, functions, triggers, foreign keys, and
 * permission metadata into a structured JSON file. Read-only; safe to re-run.
 *
 * Output: docs/prism/raw/inventory.json
 *
 * Run from the campus machine (intranet) with .env.local configured:
 *   npx tsx scripts/discover-prism-full.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

async function main() {
  const pool = await getPrismPool();
  const out: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    server: process.env.PRISM_SERVER,
    database: process.env.PRISM_DATABASE,
  };

  console.log("Querying tables + row counts...");
  const tables = await pool.request().query<{
    schema_name: string;
    table_name: string;
    row_count: number;
    column_count: number;
    has_triggers: number;
  }>(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      ISNULL(SUM(CASE WHEN p.index_id IN (0,1) THEN p.rows END), 0) AS row_count,
      (SELECT COUNT(*) FROM sys.columns WHERE object_id = t.object_id) AS column_count,
      CASE WHEN EXISTS (SELECT 1 FROM sys.triggers WHERE parent_id = t.object_id) THEN 1 ELSE 0 END AS has_triggers
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    LEFT JOIN sys.partitions p ON p.object_id = t.object_id
    GROUP BY s.name, t.name, t.object_id
    ORDER BY t.name;
  `);
  out.tables = tables.recordset;
  console.log(`  ${tables.recordset.length} tables`);

  console.log("Querying stored procedures...");
  const procs = await pool.request().query<{
    schema_name: string;
    proc_name: string;
    param_count: number;
    is_encrypted: number;
    created: string;
    modified: string;
  }>(`
    SELECT
      s.name AS schema_name,
      p.name AS proc_name,
      (SELECT COUNT(*) FROM sys.parameters WHERE object_id = p.object_id) AS param_count,
      CAST(ISNULL(OBJECTPROPERTY(p.object_id, 'IsEncrypted'), 0) AS INT) AS is_encrypted,
      CONVERT(VARCHAR(19), p.create_date, 120) AS created,
      CONVERT(VARCHAR(19), p.modify_date, 120) AS modified
    FROM sys.procedures p
    JOIN sys.schemas s ON p.schema_id = s.schema_id
    ORDER BY p.name;
  `);
  out.procedures = procs.recordset;
  console.log(`  ${procs.recordset.length} procs`);

  console.log("Querying views...");
  const views = await pool.request().query<{
    schema_name: string;
    view_name: string;
    column_count: number;
  }>(`
    SELECT
      s.name AS schema_name,
      v.name AS view_name,
      (SELECT COUNT(*) FROM sys.columns WHERE object_id = v.object_id) AS column_count
    FROM sys.views v
    JOIN sys.schemas s ON v.schema_id = s.schema_id
    ORDER BY v.name;
  `);
  out.views = views.recordset;
  console.log(`  ${views.recordset.length} views`);

  console.log("Querying functions...");
  const funcs = await pool.request().query<{
    schema_name: string;
    fn_name: string;
    fn_type: string;
  }>(`
    SELECT
      s.name AS schema_name,
      o.name AS fn_name,
      o.type_desc AS fn_type
    FROM sys.objects o
    JOIN sys.schemas s ON o.schema_id = s.schema_id
    WHERE o.type IN ('FN','IF','TF','FS','FT')
    ORDER BY o.name;
  `);
  out.functions = funcs.recordset;
  console.log(`  ${funcs.recordset.length} functions`);

  console.log("Querying triggers...");
  const triggers = await pool.request().query<{
    trigger_name: string;
    parent_table: string;
    is_disabled: number;
    is_instead_of: number;
  }>(`
    SELECT
      t.name AS trigger_name,
      OBJECT_NAME(t.parent_id) AS parent_table,
      CAST(t.is_disabled AS INT) AS is_disabled,
      CAST(t.is_instead_of_trigger AS INT) AS is_instead_of
    FROM sys.triggers t
    WHERE t.parent_class = 1
    ORDER BY parent_table, t.name;
  `);
  out.triggers = triggers.recordset;
  console.log(`  ${triggers.recordset.length} triggers`);

  console.log("Querying foreign keys...");
  const fks = await pool.request().query<{
    fk_name: string;
    child_table: string;
    parent_table: string;
    child_cols: string;
    parent_cols: string;
  }>(`
    SELECT
      fk.name AS fk_name,
      OBJECT_NAME(fk.parent_object_id) AS child_table,
      OBJECT_NAME(fk.referenced_object_id) AS parent_table,
      STUFF((
        SELECT ',' + c.name
        FROM sys.foreign_key_columns fkc
        JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
        WHERE fkc.constraint_object_id = fk.object_id
        ORDER BY fkc.constraint_column_id
        FOR XML PATH('')
      ), 1, 1, '') AS child_cols,
      STUFF((
        SELECT ',' + c.name
        FROM sys.foreign_key_columns fkc
        JOIN sys.columns c ON c.object_id = fkc.referenced_object_id AND c.column_id = fkc.referenced_column_id
        WHERE fkc.constraint_object_id = fk.object_id
        ORDER BY fkc.constraint_column_id
        FOR XML PATH('')
      ), 1, 1, '') AS parent_cols
    FROM sys.foreign_keys fk
    ORDER BY child_table, fk.name;
  `);
  out.foreignKeys = fks.recordset;
  console.log(`  ${fks.recordset.length} foreign keys`);

  console.log("Querying indexes (unique / primary keys)...");
  const indexes = await pool.request().query<{
    table_name: string;
    index_name: string;
    is_primary_key: number;
    is_unique: number;
    columns: string;
  }>(`
    SELECT
      OBJECT_NAME(i.object_id) AS table_name,
      i.name AS index_name,
      CAST(i.is_primary_key AS INT) AS is_primary_key,
      CAST(i.is_unique AS INT) AS is_unique,
      STUFF((
        SELECT ',' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
      ), 1, 1, '') AS columns
    FROM sys.indexes i
    JOIN sys.tables t ON t.object_id = i.object_id
    WHERE i.type > 0 AND (i.is_primary_key = 1 OR i.is_unique = 1)
    ORDER BY table_name, i.index_id;
  `);
  out.uniqueIndexes = indexes.recordset;
  console.log(`  ${indexes.recordset.length} unique/primary indexes`);

  console.log("Querying pdt's effective permissions...");
  // Role memberships
  const roles = await pool.request().query<{
    principal_name: string;
    role_name: string;
  }>(`
    SELECT
      dp1.name AS principal_name,
      dp2.name AS role_name
    FROM sys.database_role_members rm
    JOIN sys.database_principals dp1 ON rm.member_principal_id = dp1.principal_id
    JOIN sys.database_principals dp2 ON rm.role_principal_id = dp2.principal_id
    WHERE dp1.name = 'pdt'
    ORDER BY role_name;
  `);
  out.pdtRoles = roles.recordset;

  const perms = await pool.request().query<{
    permission_name: string;
    state_desc: string;
    class_desc: string;
    object_name: string | null;
  }>(`
    SELECT
      permission_name,
      state_desc,
      class_desc,
      CASE
        WHEN class_desc = 'OBJECT_OR_COLUMN' THEN OBJECT_NAME(major_id)
        ELSE NULL
      END AS object_name
    FROM sys.database_permissions p
    WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID('pdt')
    ORDER BY class_desc, permission_name;
  `);
  out.pdtExplicitPermissions = perms.recordset;
  console.log(`  pdt is in ${roles.recordset.length} roles with ${perms.recordset.length} explicit permissions`);

  // Count columns per table (for later drill-down)
  console.log("Querying columns (all tables)...");
  const cols = await pool.request().query<{
    table_name: string;
    column_name: string;
    type_name: string;
    max_length: number;
    is_nullable: number;
    is_identity: number;
    is_computed: number;
    column_id: number;
  }>(`
    SELECT
      OBJECT_NAME(c.object_id) AS table_name,
      c.name AS column_name,
      TYPE_NAME(c.user_type_id) AS type_name,
      c.max_length,
      CAST(c.is_nullable AS INT) AS is_nullable,
      CAST(c.is_identity AS INT) AS is_identity,
      CAST(c.is_computed AS INT) AS is_computed,
      c.column_id
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    ORDER BY table_name, c.column_id;
  `);
  out.columns = cols.recordset;
  console.log(`  ${cols.recordset.length} columns total`);

  const outDir = path.resolve(process.cwd(), "docs/prism/raw");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "inventory.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 0));
  console.log(`\nWritten to ${outPath}`);
  console.log(`Size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
