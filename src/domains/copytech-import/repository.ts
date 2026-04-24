import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CopyTechProductSnapshot } from "./types";

interface ProductLookupRow {
  sku: number | string | bigint;
  description: string | null;
  retail_price: unknown;
  cost: unknown;
  item_tax_type_id: number | string | null;
  discontinued: boolean | null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function findProductsBySku(
  skus: readonly number[],
): Promise<Map<number, CopyTechProductSnapshot>> {
  const uniqueSkus = Array.from(new Set(skus.filter((sku) => Number.isInteger(sku) && sku > 0)));
  if (uniqueSkus.length === 0) return new Map();

  const rows = await prisma.$queryRaw<ProductLookupRow[]>`
    SELECT sku, description, retail_price, cost, item_tax_type_id, discontinued
    FROM products
    WHERE sku IN (${Prisma.join(uniqueSkus)})
  `;

  return new Map(
    rows.map((row) => {
      const sku = Number(row.sku);
      return [
        sku,
        {
          sku,
          description: row.description,
          retailPrice: toNumber(row.retail_price),
          costPrice: toNumber(row.cost),
          itemTaxTypeId: row.item_tax_type_id == null ? null : Number(row.item_tax_type_id),
          discontinued: row.discontinued,
        },
      ] as const;
    }),
  );
}
