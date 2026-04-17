import type {
  BulkEditSourceRow,
  BulkEditTransform,
  BulkEditValidationError,
  PreviewRow,
  PreviewWarning,
} from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apply a compound transform to a single row. Pure function.
 * Returns the projected PreviewRow including changed-field list and
 * row-level warnings. Does NOT mutate the input.
 */
export function applyTransform(
  row: BulkEditSourceRow,
  transform: BulkEditTransform,
): PreviewRow {
  const warnings: PreviewWarning[] = [];
  const changedFields: PreviewRow["changedFields"] = [];

  const before: PreviewRow["before"] = {
    retail: row.retail,
    cost: row.cost,
    dccId: row.dccId,
    itemTaxTypeId: row.itemTaxTypeId,
    barcode: row.barcode,
  };

  let afterRetail = row.retail;
  let afterCost = row.cost;

  // Pricing ---------------------------------------------------------------
  const p = transform.pricing;
  switch (p.mode) {
    case "none":
      break;

    case "uplift":
      afterRetail = round2(row.retail * (1 + p.percent / 100));
      break;

    case "absolute":
      afterRetail = round2(p.retail);
      break;

    case "margin":
      // retail = cost / (1 - margin); validated to 0 <= margin < 1 by validateTransform
      if (row.cost === 0) {
        warnings.push({
          code: "ZERO_COST_FOR_MARGIN_MODE",
          message: `SKU ${row.sku} has zero cost; margin-mode retail would be 0.`,
        });
      }
      afterRetail = round2(row.cost / (1 - p.targetMargin));
      break;

    case "cost": {
      // Resolve new cost
      const newCostVal =
        p.newCost.kind === "absolute"
          ? round2(p.newCost.value)
          : round2(row.cost * (1 + p.newCost.percent / 100));
      afterCost = newCostVal;

      if (p.preserveMargin) {
        if (row.retail === 0) {
          warnings.push({
            code: "ZERO_RETAIL_FOR_MARGIN_MODE",
            message: `SKU ${row.sku} has zero retail; cannot preserve margin (retail left unchanged).`,
          });
        } else {
          const currentMargin = 1 - row.cost / row.retail;
          if (currentMargin >= 1 || currentMargin < 0) {
            // Edge case: cost >= retail (margin <= 0). Preserving this is nonsense.
            warnings.push({
              code: "NEGATIVE_MARGIN",
              message: `SKU ${row.sku} currently has non-positive margin; recomputed retail may be unusual.`,
            });
          }
          if (currentMargin < 1) {
            afterRetail = round2(newCostVal / (1 - currentMargin));
          }
        }
      }
      break;
    }
  }

  if (afterRetail !== row.retail) changedFields.push("retail");
  if (afterCost !== row.cost) changedFields.push("cost");

  // Catalog ---------------------------------------------------------------
  let afterDccId = row.dccId;
  let afterTax = row.itemTaxTypeId;

  if (transform.catalog.dccId !== undefined && transform.catalog.dccId !== row.dccId) {
    afterDccId = transform.catalog.dccId;
    changedFields.push("dccId");
  }
  if (
    transform.catalog.itemTaxTypeId !== undefined &&
    transform.catalog.itemTaxTypeId !== row.itemTaxTypeId
  ) {
    afterTax = transform.catalog.itemTaxTypeId;
    changedFields.push("itemTaxTypeId");
  }

  // Cross-field warnings --------------------------------------------------
  if (afterRetail < afterCost) {
    warnings.push({
      code: "NEGATIVE_MARGIN",
      message: `SKU ${row.sku} would have retail $${afterRetail.toFixed(2)} < cost $${afterCost.toFixed(2)}.`,
    });
  }

  if (p.mode === "absolute" && row.retail > 0) {
    const jump = Math.abs(afterRetail - row.retail) / row.retail;
    if (jump > 0.5) {
      warnings.push({
        code: "LARGE_PRICE_JUMP",
        message: `SKU ${row.sku}: retail changes by ${(jump * 100).toFixed(0)}% (from $${row.retail.toFixed(2)} to $${afterRetail.toFixed(2)}).`,
      });
    }
  }

  if (row.fDiscontinue === 1 && changedFields.length > 0) {
    warnings.push({
      code: "DISCONTINUED_ITEM",
      message: `SKU ${row.sku} is discontinued; changes will still apply.`,
    });
  }

  return {
    sku: row.sku,
    description: row.description,
    before,
    after: {
      retail: afterRetail,
      cost: afterCost,
      dccId: afterDccId,
      itemTaxTypeId: afterTax,
      barcode: row.barcode,
    },
    changedFields,
    warnings,
  };
}

/**
 * Validate a transform spec before it's applied. Pure. Returns zero errors
 * if the spec is internally consistent and has at least one real change.
 */
export function validateTransform(t: BulkEditTransform): BulkEditValidationError[] {
  const errs: BulkEditValidationError[] = [];

  const p = t.pricing;
  switch (p.mode) {
    case "none":
      break;
    case "uplift":
      if (typeof p.percent !== "number" || !Number.isFinite(p.percent)) {
        errs.push({ code: "INVALID_PERCENT", field: "pricing.percent", message: "Percent must be a finite number" });
      }
      break;
    case "absolute":
      if (typeof p.retail !== "number" || p.retail < 0 || !Number.isFinite(p.retail)) {
        errs.push({ code: "INVALID_RETAIL", field: "pricing.retail", message: "Retail must be a non-negative number" });
      }
      break;
    case "margin":
      if (
        typeof p.targetMargin !== "number" ||
        !Number.isFinite(p.targetMargin) ||
        p.targetMargin < 0 ||
        p.targetMargin >= 1
      ) {
        errs.push({
          code: "INVALID_MARGIN",
          field: "pricing.targetMargin",
          message: "Target margin must be >= 0 and < 1 (e.g. 0.40 for 40%)",
        });
      }
      break;
    case "cost":
      if (p.newCost.kind === "absolute") {
        if (typeof p.newCost.value !== "number" || p.newCost.value < 0 || !Number.isFinite(p.newCost.value)) {
          errs.push({ code: "INVALID_COST", field: "pricing.newCost.value", message: "New cost must be non-negative" });
        }
      } else {
        if (typeof p.newCost.percent !== "number" || !Number.isFinite(p.newCost.percent)) {
          errs.push({ code: "INVALID_PERCENT", field: "pricing.newCost.percent", message: "Cost uplift percent must be a finite number" });
        }
      }
      break;
  }

  // Reject a transform that would do nothing
  const hasPricingChange = p.mode !== "none";
  const hasCatalogChange = t.catalog.dccId !== undefined || t.catalog.itemTaxTypeId !== undefined;
  if (!hasPricingChange && !hasCatalogChange) {
    errs.push({
      code: "NO_OP_TRANSFORM",
      message: "Transform has no pricing or catalog changes — nothing to apply.",
    });
  }

  return errs;
}
