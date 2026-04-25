/**
 * Aggregate-recompute helpers. Every sync recomputes all sale-active SKUs so
 * the rolling windows stay correct even when no new transactions arrive for a
 * given product and older sales age out of the 30d/90d/1y buckets.
 */
import { Client } from "pg";

const AGGREGATE_SKU_BATCH_SIZE = 500;

const SALE_ACTIVE_SKU_BATCH_SQL = `
  SELECT sku
  FROM sales_transactions
  WHERE dtl_f_status <> 1
    AND sku > $1::bigint
  GROUP BY sku
  ORDER BY sku
  LIMIT $2
`;

interface AggregateQueryResult<Row> {
  rows: Row[];
}

export interface AggregateDbClient {
  connect?(): Promise<unknown>;
  end?(): Promise<unknown>;
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<AggregateQueryResult<Row>>;
}

export function buildAggregateRecomputeSql(): string {
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
        AND sku = ANY($1::bigint[])
      GROUP BY sku
    )
    , updated AS (
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
      WHERE p.sku = r.sku
      RETURNING p.sku
    )
    SELECT COUNT(*)::int AS affected FROM updated;
  `;
}

export function buildAnalyticsRollupRefreshSql(): string[] {
  return [
    "REFRESH MATERIALIZED VIEW analytics_sales_daily",
    "REFRESH MATERIALIZED VIEW analytics_sales_hourly",
  ];
}

export async function refreshAnalyticsSalesRollups(options: {
  db?: AggregateDbClient;
} = {}): Promise<void> {
  const { db } = options;
  const ownsDb = !db;
  const client = db ?? createPgAggregateClient(getAggregateDatabaseUrl());

  if (ownsDb) {
    await client.connect?.();
  }

  try {
    for (const statement of buildAnalyticsRollupRefreshSql()) {
      await client.query(statement);
    }
  } finally {
    if (ownsDb) {
      await client.end?.();
    }
  }
}

function getAggregateDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL must be configured");
  }

  return connectionString;
}

function createPgAggregateClient(connectionString: string): AggregateDbClient {
  const pgClient = new Client({ connectionString });

  return {
    connect: async () => {
      await pgClient.connect();
    },
    end: async () => {
      await pgClient.end();
    },
    query: async <Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ) => {
      const result = await pgClient.query(text, values);
      return { rows: result.rows as Row[] };
    },
  };
}

export async function runAggregateRecompute(options: {
  batchSize?: number;
  db?: AggregateDbClient;
} = {}): Promise<number> {
  const { batchSize = AGGREGATE_SKU_BATCH_SIZE, db } = options;
  if (batchSize < 1) {
    throw new Error("Aggregate recompute batchSize must be at least 1");
  }

  const ownsDb = !db;
  const client = db ?? createPgAggregateClient(getAggregateDatabaseUrl());

  if (ownsDb) {
    await client.connect?.();
  }

  try {
    let totalAffected = 0;
    let lastSku: string | number = 0;

    while (true) {
      const skuResult = await client.query(
        SALE_ACTIVE_SKU_BATCH_SQL,
        [lastSku, batchSize],
      ) as AggregateQueryResult<{ sku: string }>;
      const skuRows = skuResult.rows;
      if (skuRows.length === 0) {
        break;
      }

      const skuBatch = skuRows.map((row) => row.sku);
      const updatedResult = await client.query(
        buildAggregateRecomputeSql(),
        [skuBatch],
      ) as AggregateQueryResult<{ affected: number | string }>;
      const updatedRows = updatedResult.rows;

      totalAffected += Number(updatedRows[0]?.affected ?? 0);
      lastSku = skuBatch[skuBatch.length - 1];
    }

    await refreshAnalyticsSalesRollups({ db: client });
    return totalAffected;
  } finally {
    if (ownsDb) {
      await client.end?.();
    }
  }
}
