import { Client } from "pg";

const REQUIRED_COLUMNS = [
  "stock_coverage_days",
  "trend_direction",
  "effective_last_sale_date",
  "aggregates_ready",
  "margin_ratio",
];

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL must be configured");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products_with_derived'
      order by ordinal_position
    `);

    const actual = new Set(result.rows.map((row) => row.column_name));
    const missing = REQUIRED_COLUMNS.filter((column) => !actual.has(column));

    if (missing.length > 0) {
      throw new Error(
        `products_with_derived is missing required columns: ${missing.join(", ")}`,
      );
    }

    console.log(
      `[schema] products_with_derived includes required columns: ${REQUIRED_COLUMNS.join(", ")}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[schema] Derived products view check failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
