import { applyTransform } from "./transform-engine";
import type {
  BulkEditSourceRow,
  BulkEditTransform,
  PreviewResult,
  PreviewWarning,
} from "./types";

/**
 * Build a full preview payload from source rows + a compound transform.
 * Aggregates per-row results into totals and batch-level warnings.
 * Pure; callers are responsible for loading the source rows.
 */
export function buildPreview(
  sourceRows: BulkEditSourceRow[],
  transform: BulkEditTransform,
): PreviewResult {
  const rows = sourceRows.map((r) => applyTransform(r, transform));

  let pricingDeltaCents = 0;
  let districtChangeCount = 0;
  for (const r of rows) {
    pricingDeltaCents += Math.round((r.after.retail - r.before.retail) * 100);
    if (r.changedFields.includes("dccId") || r.changedFields.includes("itemTaxTypeId")) {
      districtChangeCount += 1;
    }
  }

  const batchWarnings: PreviewWarning[] = [];

  // If the transform forces a single DCC but the selection spans multiple distinct
  // starting DCCs, surface that — it's often intentional (recategorization pass),
  // but worth confirming.
  if (transform.catalog.dccId !== undefined) {
    const distinctStartingDccs = new Set(sourceRows.map((r) => r.dccId));
    if (distinctStartingDccs.size > 1) {
      batchWarnings.push({
        code: "NEGATIVE_MARGIN", // reuse existing code — batch warnings don't need a new category
        message: `Selection spans multiple (${distinctStartingDccs.size}) Department/Classes and you're collapsing them into one. Review the preview carefully.`,
      });
    }
  }

  return {
    rows,
    totals: {
      rowCount: rows.length,
      pricingDeltaCents,
      districtChangeCount,
    },
    warnings: batchWarnings,
  };
}
