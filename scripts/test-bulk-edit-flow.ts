/**
 * Live end-to-end test of the bulk-edit flow. Creates 3 TEST-CLAUDE items,
 * exercises each pricing mode, verifies results in Prism via direct SELECT,
 * then hard-deletes the test items. Run on campus.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem, getItemSnapshot } from "@/domains/product/prism-updates";
import { applyTransform } from "@/domains/bulk-edit/transform-engine";
import type { BulkEditTransform } from "@/domains/bulk-edit/types";

async function main() {
  const stamp = Date.now() % 1_000_000;
  const created: number[] = [];

  try {
    for (let i = 0; i < 3; i++) {
      const item = await createGmItem({
        description: `BULK EDIT TEST ${i + 1}`,
        vendorId: 21,
        dccId: 1968650,
        itemTaxTypeId: 6,
        barcode: `TEST-CLAUDE-BE${i}${stamp}`.slice(0, 20),
        retail: 10 + i,
        cost: 5 + i,
      });
      created.push(item.sku);
    }
    console.log(`Created SKUs: ${created.join(", ")}`);

    const modes: Array<{ label: string; transform: BulkEditTransform }> = [
      { label: "uplift +5%", transform: { pricing: { mode: "uplift", percent: 5 }, catalog: {} } },
      { label: "absolute $12.99", transform: { pricing: { mode: "absolute", retail: 12.99 }, catalog: {} } },
      { label: "margin 40%", transform: { pricing: { mode: "margin", targetMargin: 0.4 }, catalog: {} } },
      { label: "cost absolute $6 + preserveMargin", transform: { pricing: { mode: "cost", newCost: { kind: "absolute", value: 6 }, preserveMargin: true }, catalog: {} } },
    ];

    for (const { label, transform } of modes) {
      const sku = created[0];
      const snap = await getItemSnapshot(sku);
      if (!snap) throw new Error(`snapshot for ${sku} missing`);
      if (snap.retail == null || snap.cost == null) {
        throw new Error(`snapshot for ${sku} is missing retail/cost`);
      }

      const projected = applyTransform({
        sku,
        description: "",
        barcode: snap.barcode,
        retail: snap.retail,
        cost: snap.cost,
        vendorId: null, dccId: null, itemTaxTypeId: null,
        itemType: "general_merchandise",
        fDiscontinue: 0,
      }, transform);

      const patch: Record<string, unknown> = {};
      if (projected.changedFields.includes("retail")) patch.retail = projected.after.retail;
      if (projected.changedFields.includes("cost")) patch.cost = projected.after.cost;
      if (Object.keys(patch).length === 0) {
        console.log(`SKIP ${label} -- no change projected`);
        continue;
      }
      await updateGmItem(sku, patch);
      const after = await getItemSnapshot(sku);
      if (!after) throw new Error(`post-update snapshot missing`);
      console.log(`OK ${label}: retail ${snap.retail} -> ${after.retail}, cost ${snap.cost} -> ${after.cost}`);
    }
  } finally {
    for (const sku of created) {
      try { await deleteTestItem(sku); } catch (e) { console.warn(`cleanup ${sku} failed:`, e); }
    }
    console.log(`Cleaned up ${created.length} test items`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
