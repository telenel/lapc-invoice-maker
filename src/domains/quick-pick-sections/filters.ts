import type { QuickPickSection } from "@/generated/prisma/client";

export type QuickPickSectionPredicateSource = Pick<
  QuickPickSection,
  "descriptionLike" | "dccIds" | "vendorIds" | "itemType" | "explicitSkus" | "includeDiscontinued"
>;

export interface ProductStringLikeFilter {
  like: string;
  mode: "insensitive";
}

export interface ProductIntegerListFilter {
  in: number[];
}

export type ProductPredicateClause =
  | { description: ProductStringLikeFilter }
  | { dcc_id: ProductIntegerListFilter }
  | { vendor_id: ProductIntegerListFilter }
  | { item_type: string }
  | { sku: ProductIntegerListFilter };

export interface ProductWhereInput {
  OR?: ProductPredicateClause[];
  discontinued?: false;
  sku?: ProductIntegerListFilter;
}

export interface ProductSqlFragment {
  sql: string;
  params: unknown[];
}

export interface BuildProductSqlOptions {
  tableAlias?: string;
  paramOffset?: number;
}

export interface EffectiveProductPredicate {
  isEmpty: boolean;
  prismaWhere: ProductWhereInput;
  buildSql: (options?: BuildProductSqlOptions) => ProductSqlFragment;
}

type ClauseKind = "descriptionLike" | "dccIds" | "vendorIds" | "itemType" | "explicitSkus";

interface NormalizedClause {
  kind: ClauseKind;
  value: string | number[];
  prismaClause: ProductPredicateClause;
}

function normalizeClauses(section: QuickPickSectionPredicateSource): NormalizedClause[] {
  const clauses: NormalizedClause[] = [];
  const descriptionLike = section.descriptionLike?.trim() ?? "";

  if (descriptionLike) {
    clauses.push({
      kind: "descriptionLike",
      value: descriptionLike,
      prismaClause: {
        description: {
          like: descriptionLike,
          mode: "insensitive",
        },
      },
    });
  }

  if (section.dccIds.length > 0) {
    clauses.push({
      kind: "dccIds",
      value: section.dccIds,
      prismaClause: { dcc_id: { in: section.dccIds } },
    });
  }

  if (section.vendorIds.length > 0) {
    clauses.push({
      kind: "vendorIds",
      value: section.vendorIds,
      prismaClause: { vendor_id: { in: section.vendorIds } },
    });
  }

  if (section.itemType) {
    clauses.push({
      kind: "itemType",
      value: section.itemType,
      prismaClause: { item_type: section.itemType },
    });
  }

  if (section.explicitSkus.length > 0) {
    clauses.push({
      kind: "explicitSkus",
      value: section.explicitSkus,
      prismaClause: { sku: { in: section.explicitSkus } },
    });
  }

  return clauses;
}

function buildClauseSql(
  clause: NormalizedClause,
  tableAlias: string,
  nextPlaceholder: (value: unknown) => string,
): string {
  switch (clause.kind) {
    case "descriptionLike":
      return `(${tableAlias}.description ILIKE ${nextPlaceholder(clause.value)})`;
    case "dccIds":
      return `(${tableAlias}.dcc_id = ANY(${nextPlaceholder(clause.value)}))`;
    case "vendorIds":
      return `(${tableAlias}.vendor_id = ANY(${nextPlaceholder(clause.value)}))`;
    case "itemType":
      return `(${tableAlias}.item_type = ${nextPlaceholder(clause.value)})`;
    case "explicitSkus":
      return `(${tableAlias}.sku = ANY(${nextPlaceholder(clause.value)}))`;
  }
}

export function computeEffectivePredicate(
  section: QuickPickSectionPredicateSource,
): EffectiveProductPredicate {
  const clauses = normalizeClauses(section);

  if (clauses.length === 0) {
    return {
      isEmpty: true,
      prismaWhere: {
        sku: { in: [] },
      },
      buildSql() {
        return {
          sql: "FALSE",
          params: [],
        };
      },
    };
  }

  const prismaWhere: ProductWhereInput = {
    OR: clauses.map((clause) => clause.prismaClause),
  };

  if (!section.includeDiscontinued) {
    prismaWhere.discontinued = false;
  }

  return {
    isEmpty: false,
    prismaWhere,
    buildSql(options: BuildProductSqlOptions = {}) {
      const tableAlias = options.tableAlias ?? "pwd";
      const paramOffset = options.paramOffset ?? 0;
      const params: unknown[] = [];
      const nextPlaceholder = (value: unknown) => {
        params.push(value);
        return `$${paramOffset + params.length}`;
      };
      const predicateSql = clauses
        .map((clause) => buildClauseSql(clause, tableAlias, nextPlaceholder))
        .join(" OR ");

      if (section.includeDiscontinued) {
        return {
          sql: clauses.length === 1 ? predicateSql : `(${predicateSql})`,
          params,
        };
      }

      return {
        sql: `(${predicateSql}) AND (${tableAlias}.discontinued IS NULL OR ${tableAlias}.discontinued = false)`,
        params,
      };
    },
  };
}
