/**
 * One-off: dump Item / Inventory / Textbook / GeneralMerchandise rows for a SKU,
 * including every date-ish column, so we can answer "when was this last touched in Prism."
 *
 * Usage: npx tsx scripts/inspect-prism-sku.ts 10000076
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  const skuArg = process.argv[2];
  if (!skuArg) {
    console.error("usage: npx tsx scripts/inspect-prism-sku.ts <sku>");
    process.exit(1);
  }
  const sku = Number(skuArg);
  const pool = await getPrismPool();

  const item = await pool
    .request()
    .input("sku", sql.Int, sku)
    .query(`
      SELECT SKU, BarCode, TypeID, VendorID, DCCID, ItemTaxTypeID,
             fDiscontinue, CreateDate, LastRecvDate, LastPODate
      FROM Item WHERE SKU = @sku
    `);

  const inv = await pool
    .request()
    .input("sku", sql.Int, sku)
    .query(`
      SELECT LocationID, Retail, Cost, StockOnHand, ReservedQty,
             CreateDate, LastSaleDate, LastInventoryDate
      FROM Inventory WHERE SKU = @sku ORDER BY LocationID
    `);

  const tb = await pool
    .request()
    .input("sku", sql.Int, sku)
    .query(`
      SELECT SKU, Title, Author, Edition, Imprint, Copyright,
             ISBN, TextStatusID, StatusDate
      FROM Textbook WHERE SKU = @sku
    `);

  const gm = await pool
    .request()
    .input("sku", sql.Int, sku)
    .query(`
      SELECT SKU, Description
      FROM GeneralMerchandise WHERE SKU = @sku
    `);

  console.log("=== Item ===");
  console.dir(item.recordset, { depth: null });
  console.log("\n=== Inventory (all locations) ===");
  console.dir(inv.recordset, { depth: null });
  console.log("\n=== Textbook ===");
  console.dir(tb.recordset, { depth: null });
  console.log("\n=== GeneralMerchandise ===");
  console.dir(gm.recordset, { depth: null });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
