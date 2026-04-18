/**
 * Read-only: run the NEW sync query against Prism (no Supabase writes) and
 * verify the classification distribution + Pierce scope are correct.
 */
import { config } from "dotenv";
import { getPrismPool, sql } from "../src/lib/prism";

config({ path: ".env.local" });

const PIERCE_LOCATION_ID = 2;

async function main() {
  const pool = await getPrismPool();

  // Run the exact SELECT used by the new runPrismPull, but COUNT the result.
  console.log("=== Pierce-scoped count by item_type (new classifier) ===");
  const dist = await pool.request().input("loc", sql.Int, PIERCE_LOCATION_ID).query(`
    SELECT
      CASE
        WHEN i.TypeID = 2       THEN 'used_textbook'
        WHEN tb.SKU IS NOT NULL THEN 'textbook'
        WHEN gm.SKU IS NOT NULL THEN 'general_merchandise'
        ELSE                         'other'
      END AS item_type,
      COUNT(*) AS n
    FROM Item i
    INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
    LEFT JOIN Textbook tb ON tb.SKU = i.SKU
    LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
    GROUP BY
      CASE
        WHEN i.TypeID = 2       THEN 'used_textbook'
        WHEN tb.SKU IS NOT NULL THEN 'textbook'
        WHEN gm.SKU IS NOT NULL THEN 'general_merchandise'
        ELSE                         'other'
      END
    ORDER BY n DESC
  `);
  console.table(dist.recordset);

  const total = dist.recordset.reduce((s: number, r: { n: number }) => s + r.n, 0);
  console.log(`\nTotal Pierce-stocked rows: ${total} (expected ~61,024)`);

  // Sanity check: sample each bucket so we can eyeball whether
  // drinks/sodas no longer land in 'textbook'.
  console.log("\n=== 3 sample rows per bucket ===");
  for (const r of dist.recordset) {
    const samples = await pool.request()
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .query(`
        SELECT TOP 3 i.SKU, i.TypeID,
          LTRIM(RTRIM(gm.Description)) AS GmDesc,
          LTRIM(RTRIM(tb.Author))      AS TbAuthor,
          LTRIM(RTRIM(i.BarCode))      AS BarCode,
          CASE
            WHEN i.TypeID = 2       THEN 'used_textbook'
            WHEN tb.SKU IS NOT NULL THEN 'textbook'
            WHEN gm.SKU IS NOT NULL THEN 'general_merchandise'
            ELSE                         'other'
          END AS item_type
        FROM Item i
        INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        LEFT JOIN Textbook tb ON tb.SKU = i.SKU
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        WHERE (
          CASE
            WHEN i.TypeID = 2       THEN 'used_textbook'
            WHEN tb.SKU IS NOT NULL THEN 'textbook'
            WHEN gm.SKU IS NOT NULL THEN 'general_merchandise'
            ELSE                         'other'
          END
        ) = '${r.item_type}'
        ORDER BY i.SKU DESC
      `);
    console.log(`\n${r.item_type}:`);
    console.table(samples.recordset);
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
