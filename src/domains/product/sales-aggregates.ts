/**
 * Aggregate-recompute helpers. The actual SQL lives in the
 * `recompute_product_sales_aggregates()` Postgres function created by the
 * Phase A migration. The exported `buildAggregateRecomputeSql` string mirror
 * is for tests that want to assert the column set without spinning up Postgres.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function buildAggregateRecomputeSql(): string {
  // String mirror of the CREATE FUNCTION body. Kept in sync by tests —
  // any column drift will break the "includes all 14 aggregate assignments"
  // assertion and force the developer to update both.
  return `
    WITH rolled AS (
      SELECT
        sku,
        SUM(CASE WHEN process_date >= now() - interval '30 days' THEN qty ELSE 0 END)::int  AS u30,
        SUM(CASE WHEN process_date >= now() - interval '90 days' THEN qty ELSE 0 END)::int  AS u90,
        SUM(CASE WHEN process_date >= now() - interval '1 year'  THEN qty ELSE 0 END)::int  AS u1y,
        SUM(CASE WHEN process_date >= now() - interval '3 years' THEN qty ELSE 0 END)::int  AS u3y,
        SUM(qty)::int                                                                        AS ulife,
        SUM(CASE WHEN process_date >= now() - interval '30 days' THEN ext_price ELSE 0 END) AS r30,
        SUM(CASE WHEN process_date >= now() - interval '90 days' THEN ext_price ELSE 0 END) AS r90,
        SUM(CASE WHEN process_date >= now() - interval '1 year'  THEN ext_price ELSE 0 END) AS r1y,
        SUM(CASE WHEN process_date >= now() - interval '3 years' THEN ext_price ELSE 0 END) AS r3y,
        SUM(ext_price)                                                                       AS rlife,
        COUNT(DISTINCT CASE WHEN process_date >= now() - interval '1 year' THEN transaction_id END)::int AS t1y,
        COUNT(DISTINCT transaction_id)::int                                                  AS tlife,
        MIN(process_date)                                                                    AS first_sale,
        MAX(process_date)                                                                    AS last_sale
      FROM sales_transactions
      WHERE dtl_f_status <> 1
      GROUP BY sku
    )
    UPDATE products p SET
      units_sold_30d               = r.u30,
      units_sold_90d               = r.u90,
      units_sold_1y                = r.u1y,
      units_sold_3y                = r.u3y,
      units_sold_lifetime          = r.ulife,
      revenue_30d                  = r.r30,
      revenue_90d                  = r.r90,
      revenue_1y                   = r.r1y,
      revenue_3y                   = r.r3y,
      revenue_lifetime             = r.rlife,
      txns_1y                      = r.t1y,
      txns_lifetime                = r.tlife,
      first_sale_date_computed     = r.first_sale,
      last_sale_date_computed      = r.last_sale,
      sales_aggregates_computed_at = now()
    FROM rolled r
    WHERE p.sku = r.sku;
  `;
}

/**
 * Invoke the Postgres function. Returns the number of product rows updated.
 */
export async function runAggregateRecompute(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("recompute_product_sales_aggregates");
  if (error) throw new Error(`Aggregate recompute failed: ${error.message}`);
  return Number(data ?? 0);
}
