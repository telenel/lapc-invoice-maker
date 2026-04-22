import { describe, expect, it } from "vitest";
import {
  computeEffectivePredicate,
  type QuickPickSectionPredicateSource,
} from "@/domains/quick-pick-sections/filters";

function buildSection(
  overrides: Partial<QuickPickSectionPredicateSource> = {},
): QuickPickSectionPredicateSource {
  return {
    descriptionLike: null,
    dccIds: [],
    vendorIds: [],
    itemType: null,
    explicitSkus: [],
    includeDiscontinued: false,
    ...overrides,
  };
}

describe("computeEffectivePredicate", () => {
  it("builds a description ILIKE predicate", () => {
    const result = computeEffectivePredicate(buildSection({ descriptionLike: "CT %" }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [
        {
          description: {
            like: "CT %",
            mode: "insensitive",
          },
        },
      ],
      discontinued: false,
    });
    expect(result.buildSql()).toEqual({
      sql: "((pwd.description ILIKE $1)) AND (pwd.discontinued IS NULL OR pwd.discontinued = false)",
      params: ["CT %"],
    });
  });

  it("builds a DCC predicate", () => {
    const result = computeEffectivePredicate(buildSection({ dccIds: [7, 11] }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [{ dcc_id: { in: [7, 11] } }],
      discontinued: false,
    });
    expect(result.buildSql()).toEqual({
      sql: "((pwd.dcc_id = ANY($1))) AND (pwd.discontinued IS NULL OR pwd.discontinued = false)",
      params: [[7, 11]],
    });
  });

  it("builds a vendor predicate", () => {
    const result = computeEffectivePredicate(buildSection({ vendorIds: [101, 202] }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [{ vendor_id: { in: [101, 202] } }],
      discontinued: false,
    });
    expect(result.buildSql()).toEqual({
      sql: "((pwd.vendor_id = ANY($1))) AND (pwd.discontinued IS NULL OR pwd.discontinued = false)",
      params: [[101, 202]],
    });
  });

  it("builds an item type predicate", () => {
    const result = computeEffectivePredicate(buildSection({ itemType: "general_merchandise" }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [{ item_type: "general_merchandise" }],
      discontinued: false,
    });
    expect(result.buildSql()).toEqual({
      sql: "((pwd.item_type = $1)) AND (pwd.discontinued IS NULL OR pwd.discontinued = false)",
      params: ["general_merchandise"],
    });
  });

  it("builds an explicit SKU predicate", () => {
    const result = computeEffectivePredicate(buildSection({ explicitSkus: [2501, 2502] }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [{ sku: { in: [2501, 2502] } }],
      discontinued: false,
    });
    expect(result.buildSql()).toEqual({
      sql: "((pwd.sku = ANY($1))) AND (pwd.discontinued IS NULL OR pwd.discontinued = false)",
      params: [[2501, 2502]],
    });
  });

  it("combines every populated filter with OR semantics", () => {
    const result = computeEffectivePredicate(buildSection({
      descriptionLike: "CT %",
      dccIds: [7],
      vendorIds: [101],
      itemType: "general_merchandise",
      explicitSkus: [2501],
    }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [
        {
          description: {
            like: "CT %",
            mode: "insensitive",
          },
        },
        { dcc_id: { in: [7] } },
        { vendor_id: { in: [101] } },
        { item_type: "general_merchandise" },
        { sku: { in: [2501] } },
      ],
      discontinued: false,
    });
    expect(result.buildSql({ paramOffset: 3 })).toEqual({
      sql: "((pwd.description ILIKE $4) OR (pwd.dcc_id = ANY($5)) OR (pwd.vendor_id = ANY($6)) OR (pwd.item_type = $7) OR (pwd.sku = ANY($8))) AND (pwd.discontinued IS NULL OR pwd.discontinued = false)",
      params: ["CT %", [7], [101], "general_merchandise", [2501]],
    });
  });

  it("returns a match-none predicate for an empty section", () => {
    const result = computeEffectivePredicate(buildSection());

    expect(result.isEmpty).toBe(true);
    expect(result.prismaWhere).toEqual({
      sku: { in: [] },
    });
    expect(result.buildSql()).toEqual({
      sql: "FALSE",
      params: [],
    });
  });

  it("omits the discontinued filter when includeDiscontinued is true", () => {
    const result = computeEffectivePredicate(buildSection({
      explicitSkus: [2501],
      includeDiscontinued: true,
    }));

    expect(result.isEmpty).toBe(false);
    expect(result.prismaWhere).toEqual({
      OR: [{ sku: { in: [2501] } }],
    });
    expect(result.buildSql({ tableAlias: "products" })).toEqual({
      sql: "(products.sku = ANY($1))",
      params: [[2501]],
    });
  });
});
