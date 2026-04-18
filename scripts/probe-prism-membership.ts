/**
 * Probe Transaction_Header.MembershipID to see what's actually stored there.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

const PIERCE = 2;

async function main() {
  const pool = await getPrismPool();

  console.log("=== MembershipID distribution (Pierce, trailing 3y) ===");
  const dist = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                                                       AS Total,
      SUM(CASE WHEN MembershipID IS NULL THEN 1 ELSE 0 END)           AS NullRows,
      SUM(CASE WHEN MembershipID = 0      THEN 1 ELSE 0 END)          AS ZeroRows,
      SUM(CASE WHEN MembershipID IS NOT NULL AND MembershipID <> 0 THEN 1 ELSE 0 END) AS PopulatedRows,
      COUNT(DISTINCT MembershipID)                                    AS DistinctValues
    FROM Transaction_Header
    WHERE LocationID = @loc
      AND ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(dist.recordset);

  console.log("=== Top 10 most-used MembershipID values ===");
  const top = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 10 MembershipID, COUNT(*) AS UsageCount
    FROM Transaction_Header
    WHERE LocationID = @loc
      AND ProcessDate >= DATEADD(year, -3, GETDATE())
      AND MembershipID IS NOT NULL
      AND MembershipID <> 0
    GROUP BY MembershipID
    ORDER BY UsageCount DESC
  `);
  console.table(top.recordset);

  // Try to join to a Membership table if one exists
  const memTables = await pool.request().query(`
    SELECT name FROM sys.tables WHERE name LIKE '%ember%' ORDER BY name
  `);
  console.log("=== Tables matching %ember% ===");
  console.table(memTables.recordset);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
