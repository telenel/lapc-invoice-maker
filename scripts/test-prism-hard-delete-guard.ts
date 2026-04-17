/**
 * Exercises the HAS_HISTORY guard. Picks a real SKU with PO history
 * (PO_Detail is the only history table present in this Prism deployment)
 * and confirms hardDeleteItem refuses. Then verifies a fresh TEST-CLAUDE
 * item (no history) can be hard-deleted successfully.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem } from "@/domains/product/prism-server";
import { hardDeleteItem, hasTransactionHistory } from "@/domains/product/prism-delete";
import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  // Find any SKU with PO history (PO_Detail is the only candidate history
  // table present in this Prism deployment).
  const pool = await getPrismPool();
  const history = await pool.request().query<{ SKU: number }>(
    "SELECT TOP 1 SKU FROM PO_Detail",
  );
  const busySku = history.recordset[0]?.SKU;
  if (!busySku) {
    console.warn("No PO history in DB — skipping busy-SKU guard check.");
  } else {
    console.log(`Testing guard against real SKU ${busySku}...`);
    try {
      await hardDeleteItem(busySku);
      throw new Error(`Guard failed — SKU ${busySku} was deleted despite having history!`);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code !== "HAS_HISTORY") {
        throw new Error(`Expected HAS_HISTORY, got: ${err}`);
      }
      console.log(`✓ SKU ${busySku} correctly blocked with HAS_HISTORY`);
    }
  }

  // Create a fresh item, verify it has no history, hard-delete it.
  // Barcode must fit char(20). "TEST-CLAUDE-HD-" = 15 chars, stamp trimmed.
  const BARCODE = `TEST-CLAUDE-HD-${Date.now() % 100_000}`;
  if (BARCODE.length > 20) throw new Error(`Barcode too long: ${BARCODE}`);
  const created = await createGmItem({
    description: "HARD DELETE TEST",
    vendorId: 21,
    dccId: 1968650,
    barcode: BARCODE,
    retail: 1,
    cost: 0.5,
  });
  console.log(`Created SKU ${created.sku}`);

  const hist = await hasTransactionHistory([created.sku]);
  if (hist.has(created.sku)) {
    throw new Error(`Fresh item unexpectedly has history: ${created.sku}`);
  }

  await hardDeleteItem(created.sku);
  console.log(`✓ SKU ${created.sku} hard-deleted`);

  // Verify it's gone
  const check = await pool.request().input("sku", sql.Int, created.sku)
    .query<{ SKU: number }>("SELECT SKU FROM Item WHERE SKU = @sku");
  if (check.recordset.length > 0) {
    throw new Error(`SKU ${created.sku} still present after hard-delete`);
  }
  console.log("✓ row gone from Item table");

  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
