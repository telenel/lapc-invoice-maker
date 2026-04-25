import { prisma } from "@/lib/prisma";
import { addDaysToDateKey, getDateKeyInLosAngeles, shiftDateKey, zonedDateTimeToUtc } from "@/lib/date-utils";
import { NON_MERCH_DEPT_NAMES, NON_MERCH_SKUS } from "@/domains/product/non-merch-skus";
import type { AnalyticsDateRange, FinanceAnalytics, OperationsSnapshot } from "./types";

type NumericLike = number | string | bigint | null | undefined;
type DateLike = Date | string | null | undefined;

type SalesSummaryRow = {
  revenue: NumericLike;
  units: NumericLike;
  receipts: NumericLike;
  discount_amount: NumericLike;
};

type FinanceStatsRow = {
  bucket_type: "summary" | "category" | "month" | "department" | "user";
  bucket_key: string | null;
  count: NumericLike;
  total: NumericLike;
  finalized_count: NumericLike;
  finalized_total: NumericLike;
  expected_count: NumericLike;
  expected_total: NumericLike;
};

type MonthlySalesRow = {
  month: string;
  revenue: NumericLike;
  units: NumericLike;
  receipts: NumericLike;
  discount_rate: NumericLike;
};

type WeekdaySalesRow = {
  day_of_week: NumericLike;
  revenue: NumericLike;
  receipts: NumericLike;
};

type HourlySalesRow = {
  hour: NumericLike;
  revenue: NumericLike;
  receipts: NumericLike;
};

type ProductPerformanceSqlRow = {
  sku: NumericLike;
  description: string | null;
  department: string | null;
  units: NumericLike;
  revenue: NumericLike;
  last_sale_date: DateLike;
  trend_direction: "accelerating" | "decelerating" | "steady" | null;
};

type ProductTrendSqlRow = {
  sku: NumericLike;
  description: string | null;
  department: string | null;
  units_sold_30d: NumericLike;
  units_sold_1y: NumericLike;
  revenue_30d: NumericLike;
  first_sale_date: DateLike;
  last_sale_date: DateLike;
  trend_direction: "accelerating" | "decelerating" | "steady" | null;
};

type CategoryMixRow = {
  category: string | null;
  revenue: NumericLike;
  units: NumericLike;
};

type RevenueBySkuRow = {
  revenue: NumericLike;
};

type InventorySummaryRow = {
  dead_stock_cost: NumericLike;
  low_stock_high_demand_count: NumericLike;
  reorder_breach_count: NumericLike;
};

type BreachByLocationRow = {
  location: string | null;
  count: NumericLike;
};

type StaleInventoryRow = {
  location: string | null;
  fresh_30d: NumericLike;
  stale_31_to_90d: NumericLike;
  stale_91_to_365d: NumericLike;
  stale_over_365d: NumericLike;
  never_sold: NumericLike;
};

type InventoryHealthSqlRow = {
  sku: NumericLike;
  description: string | null;
  location: string | null;
  stock_on_hand: NumericLike;
  min_stock: NumericLike;
  units_sold_30d: NumericLike;
  stock_value: NumericLike;
  last_sale_date: DateLike;
  days_since_last_sale: NumericLike;
};

type LowStockSqlRow = {
  sku: NumericLike;
  description: string | null;
  location: string | null;
  stock_on_hand: NumericLike;
  min_stock: NumericLike;
  units_sold_30d: NumericLike;
  last_sale_date: DateLike;
};

type CopyTechSummaryRow = {
  invoice_revenue: NumericLike;
  invoice_count: NumericLike;
  quote_revenue: NumericLike;
  quote_count: NumericLike;
};

type CopyTechMonthlyRow = CopyTechSummaryRow & {
  month: string;
};

type CopyTechServiceMixSqlRow = {
  service: string;
  revenue: NumericLike;
  quantity: NumericLike;
};

type CopyTechRequesterSqlRow = {
  name: string | null;
  revenue: NumericLike;
  invoice_count: NumericLike;
  quote_count: NumericLike;
};

function toNumber(value: NumericLike, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toInteger(value: NumericLike, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function toIsoString(value: DateLike): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function toProductPerformanceRow(row: ProductPerformanceSqlRow) {
  return {
    sku: toInteger(row.sku),
    description: normalizeText(row.description, `SKU ${toInteger(row.sku)}`),
    department: normalizeText(row.department, "Uncategorized"),
    units: toNumber(row.units),
    revenue: toNumber(row.revenue),
    lastSaleDate: toIsoString(row.last_sale_date),
    trendDirection: row.trend_direction,
  };
}

function toProductTrendRow(row: ProductTrendSqlRow) {
  return {
    sku: toInteger(row.sku),
    description: normalizeText(row.description, `SKU ${toInteger(row.sku)}`),
    department: normalizeText(row.department, "Uncategorized"),
    unitsSold30d: toNumber(row.units_sold_30d),
    unitsSold1y: toNumber(row.units_sold_1y),
    revenue30d: toNumber(row.revenue_30d),
    firstSaleDate: toIsoString(row.first_sale_date),
    lastSaleDate: toIsoString(row.last_sale_date),
    trendDirection: row.trend_direction,
  };
}

function toInventoryHealthRow(row: InventoryHealthSqlRow) {
  return {
    sku: toInteger(row.sku),
    description: normalizeText(row.description, `SKU ${toInteger(row.sku)}`),
    location: normalizeText(row.location, "Unknown"),
    stockOnHand: toInteger(row.stock_on_hand),
    minStock: toInteger(row.min_stock),
    unitsSold30d: toInteger(row.units_sold_30d),
    stockValue: toNumber(row.stock_value),
    lastSaleDate: toIsoString(row.last_sale_date),
    daysSinceLastSale: row.days_since_last_sale == null ? null : toInteger(row.days_since_last_sale),
  };
}

function toLowStockRow(row: LowStockSqlRow) {
  return {
    sku: toInteger(row.sku),
    description: normalizeText(row.description, `SKU ${toInteger(row.sku)}`),
    location: normalizeText(row.location, "Unknown"),
    stockOnHand: toInteger(row.stock_on_hand),
    minStock: toInteger(row.min_stock),
    unitsSold30d: toInteger(row.units_sold_30d),
    lastSaleDate: toIsoString(row.last_sale_date),
  };
}

function buildRangeBounds(range: AnalyticsDateRange) {
  return {
    start: zonedDateTimeToUtc(range.dateFrom, "00:00"),
    endExclusive: zonedDateTimeToUtc(addDaysToDateKey(range.dateTo, 1), "00:00"),
  };
}

function getNewProductThresholdDate() {
  return shiftDateKey(getDateKeyInLosAngeles(), { days: -90 });
}

const NORMALIZED_NON_MERCH_DEPT_NAMES = [...NON_MERCH_DEPT_NAMES];

function buildNonMerchandiseFilterSql({
  skuColumn,
  deptColumn,
  categoryColumn,
  skuParamIndex,
  nameParamIndex,
}: {
  skuColumn: string;
  deptColumn: string;
  categoryColumn: string;
  skuParamIndex: number;
  nameParamIndex: number;
}) {
  return `
        AND ${skuColumn} NOT IN (SELECT unnest($${skuParamIndex}::int[]))
        AND COALESCE(UPPER(TRIM(${deptColumn})), '') NOT IN (SELECT unnest($${nameParamIndex}::text[]))
        AND COALESCE(UPPER(TRIM(${categoryColumn})), '') NOT IN (SELECT unnest($${nameParamIndex}::text[]))
  `;
}

function toAggregateBucket(row: FinanceStatsRow) {
  return {
    count: toInteger(row.count),
    total: toNumber(row.total),
    finalizedCount: toInteger(row.finalized_count),
    finalizedTotal: toNumber(row.finalized_total),
    expectedCount: toInteger(row.expected_count),
    expectedTotal: toNumber(row.expected_total),
  };
}

async function findFinanceAnalytics(range: AnalyticsDateRange): Promise<FinanceAnalytics> {
  const rows = await prisma.$queryRawUnsafe<FinanceStatsRow[]>(
    `
      WITH included AS (
        SELECT
          i.date AS document_date,
          i.total_amount,
          i.category,
          i.department,
          COALESCE(NULLIF(TRIM(u.name), ''), 'Unknown') AS user_name,
          CASE
            WHEN i.type = 'INVOICE' AND i.status = 'FINAL' THEN 'finalized'
            ELSE 'expected'
          END AS lane
        FROM invoices i
        LEFT JOIN users u
          ON u.id = i.created_by
        WHERE i.archived_at IS NULL
          AND i.date BETWEEN $1::date AND $2::date
          AND (
            (i.type = 'INVOICE' AND i.status IN ('FINAL', 'DRAFT', 'PENDING_CHARGE'))
            OR (
              i.type = 'QUOTE'
              AND i.quote_status IN ('DRAFT', 'SENT', 'SUBMITTED_EMAIL', 'SUBMITTED_MANUAL', 'ACCEPTED')
              AND NOT EXISTS (
                SELECT 1
                FROM invoices converted
                WHERE converted.converted_from_quote_id = i.id
              )
            )
          )
      ),
      bucketed AS (
        SELECT 'summary'::text AS bucket_type, NULL::text AS bucket_key, * FROM included
        UNION ALL
        SELECT 'category'::text AS bucket_type, category AS bucket_key, * FROM included
        UNION ALL
        SELECT 'month'::text AS bucket_type, TO_CHAR(document_date, 'YYYY-MM') AS bucket_key, * FROM included
        UNION ALL
        SELECT 'department'::text AS bucket_type, department AS bucket_key, * FROM included
        UNION ALL
        SELECT 'user'::text AS bucket_type, user_name AS bucket_key, * FROM included
      )
      SELECT
        bucket_type,
        bucket_key,
        COUNT(*) AS count,
        COALESCE(SUM(total_amount), 0) AS total,
        COUNT(*) FILTER (WHERE lane = 'finalized') AS finalized_count,
        COALESCE(SUM(total_amount) FILTER (WHERE lane = 'finalized'), 0) AS finalized_total,
        COUNT(*) FILTER (WHERE lane = 'expected') AS expected_count,
        COALESCE(SUM(total_amount) FILTER (WHERE lane = 'expected'), 0) AS expected_total
      FROM bucketed
      GROUP BY bucket_type, bucket_key
      ORDER BY bucket_type, bucket_key
    `,
    range.dateFrom,
    range.dateTo,
  );

  const emptySummary: FinanceStatsRow = {
    bucket_type: "summary",
    bucket_key: null,
    count: 0,
    total: 0,
    finalized_count: 0,
    finalized_total: 0,
    expected_count: 0,
    expected_total: 0,
  };
  const summary = rows.find((row) => row.bucket_type === "summary") ?? emptySummary;
  const byMonth = rows
    .filter((row) => row.bucket_type === "month" && row.bucket_key)
    .map((row) => ({ month: row.bucket_key ?? "", ...toAggregateBucket(row) }))
    .sort((left, right) => left.month.localeCompare(right.month));

  return {
    summary: toAggregateBucket(summary),
    byCategory: rows
      .filter((row) => row.bucket_type === "category" && row.bucket_key)
      .map((row) => ({ category: row.bucket_key ?? "Uncategorized", ...toAggregateBucket(row) }))
      .sort((left, right) => right.total - left.total),
    byMonth,
    byDepartment: rows
      .filter((row) => row.bucket_type === "department" && row.bucket_key)
      .map((row) => ({ department: row.bucket_key ?? "Unknown", ...toAggregateBucket(row) }))
      .sort((left, right) => left.department.localeCompare(right.department)),
    trend: byMonth.map((row) => ({
      month: row.month,
      count: row.count,
      finalizedCount: row.finalizedCount,
      expectedCount: row.expectedCount,
    })),
    byUser: rows
      .filter((row) => row.bucket_type === "user" && row.bucket_key)
      .map((row) => ({ user: row.bucket_key ?? "Unknown", ...toAggregateBucket(row) }))
      .sort((left, right) => right.total - left.total),
  };
}

async function findSalesSummary(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<SalesSummaryRow[]>(
    `
      WITH sales AS (
        SELECT
          COALESCE(SUM(sd.revenue), 0) AS revenue,
          COALESCE(SUM(sd.units), 0) AS units,
          COALESCE(SUM(sd.discount_amount), 0) AS discount_amount
        FROM analytics_sales_daily sd
        WHERE sd.location_id = 2
          AND sd.sale_date BETWEEN $1::date AND $2::date
      ),
      receipts AS (
        SELECT COALESCE(SUM(sr.receipts), 0) AS receipts
        FROM analytics_sales_receipts_daily sr
        WHERE sr.location_id = 2
          AND sr.sale_date BETWEEN $1::date AND $2::date
      )
      SELECT
        sales.revenue,
        sales.units,
        receipts.receipts,
        sales.discount_amount
      FROM sales
      CROSS JOIN receipts
    `,
    range.dateFrom,
    range.dateTo,
  );

  return {
    revenue: toNumber(rows[0]?.revenue),
    units: toNumber(rows[0]?.units),
    receipts: toInteger(rows[0]?.receipts),
    discountAmount: toNumber(rows[0]?.discount_amount),
  };
}

async function findMonthlySales(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<MonthlySalesRow[]>(
    `
      WITH sales AS (
        SELECT
          TO_CHAR(date_trunc('month', sd.sale_date), 'YYYY-MM') AS month,
          COALESCE(SUM(sd.revenue), 0) AS revenue,
          COALESCE(SUM(sd.units), 0) AS units,
          COALESCE(SUM(sd.discount_amount), 0) / NULLIF(COALESCE(SUM(sd.revenue), 0), 0) AS discount_rate
        FROM analytics_sales_daily sd
        WHERE sd.location_id = 2
          AND sd.sale_date BETWEEN $1::date AND $2::date
        GROUP BY 1
      ),
      receipts AS (
        SELECT
          TO_CHAR(date_trunc('month', sr.sale_date), 'YYYY-MM') AS month,
          COALESCE(SUM(sr.receipts), 0) AS receipts
        FROM analytics_sales_receipts_daily sr
        WHERE sr.location_id = 2
          AND sr.sale_date BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        COALESCE(sales.month, receipts.month) AS month,
        COALESCE(sales.revenue, 0) AS revenue,
        COALESCE(sales.units, 0) AS units,
        COALESCE(receipts.receipts, 0) AS receipts,
        sales.discount_rate
      FROM sales
      FULL JOIN receipts USING (month)
      ORDER BY 1 ASC
    `,
    range.dateFrom,
    range.dateTo,
  );

  return rows.map((row) => ({
    month: row.month,
    revenue: toNumber(row.revenue),
    units: toNumber(row.units),
    receipts: toInteger(row.receipts),
    discountRate: toNumber(row.discount_rate),
  }));
}

async function findWeekdaySales(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<WeekdaySalesRow[]>(
    `
      WITH sales AS (
        SELECT
          EXTRACT(DOW FROM sd.sale_date)::int AS day_of_week,
          COALESCE(SUM(sd.revenue), 0) AS revenue
        FROM analytics_sales_daily sd
        WHERE sd.location_id = 2
          AND sd.sale_date BETWEEN $1::date AND $2::date
        GROUP BY 1
      ),
      receipts AS (
        SELECT
          EXTRACT(DOW FROM sr.sale_date)::int AS day_of_week,
          COALESCE(SUM(sr.receipts), 0) AS receipts
        FROM analytics_sales_receipts_daily sr
        WHERE sr.location_id = 2
          AND sr.sale_date BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        COALESCE(sales.day_of_week, receipts.day_of_week) AS day_of_week,
        COALESCE(sales.revenue, 0) AS revenue,
        COALESCE(receipts.receipts, 0) AS receipts
      FROM sales
      FULL JOIN receipts USING (day_of_week)
      ORDER BY 1 ASC
    `,
    range.dateFrom,
    range.dateTo,
  );

  return rows.map((row) => ({
    dayOfWeek: toInteger(row.day_of_week),
    revenue: toNumber(row.revenue),
    receipts: toInteger(row.receipts),
  }));
}

async function findHourlySales(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<HourlySalesRow[]>(
    `
      SELECT
        sh.hour,
        COALESCE(SUM(sh.revenue), 0) AS revenue,
        COALESCE(SUM(sh.receipts), 0) AS receipts
      FROM analytics_sales_hourly sh
      WHERE sh.location_id = 2
        AND sh.sale_date BETWEEN $1::date AND $2::date
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    range.dateFrom,
    range.dateTo,
  );

  return rows.map((row) => ({
    hour: toInteger(row.hour),
    revenue: toNumber(row.revenue),
    receipts: toInteger(row.receipts),
  }));
}

async function findTopProducts(range: AnalyticsDateRange, orderBy: "units" | "revenue") {
  const rows = await prisma.$queryRawUnsafe<ProductPerformanceSqlRow[]>(
    `
      SELECT
        sd.sku AS sku,
        COALESCE(
          NULLIF(TRIM(MAX(p.title)), ''),
          NULLIF(TRIM(MAX(p.description)), ''),
          CONCAT('SKU ', sd.sku::text)
        ) AS description,
        COALESCE(NULLIF(TRIM(MAX(p.dept_name)), ''), 'Uncategorized') AS department,
        COALESCE(SUM(sd.units), 0) AS units,
        COALESCE(SUM(sd.revenue), 0) AS revenue,
        MAX(sd.sale_date) AS last_sale_date,
        MAX(pwd.trend_direction) AS trend_direction
      FROM analytics_sales_daily sd
      LEFT JOIN products p
        ON p.sku = sd.sku
      LEFT JOIN products_with_derived pwd
        ON pwd.sku = sd.sku
      WHERE sd.location_id = 2
        AND sd.sale_date BETWEEN $1::date AND $2::date
${buildNonMerchandiseFilterSql({
  skuColumn: "sd.sku",
  deptColumn: "p.dept_name",
  categoryColumn: "p.cat_name",
  skuParamIndex: 3,
  nameParamIndex: 4,
})}
      GROUP BY sd.sku
      HAVING COALESCE(SUM(sd.revenue), 0) > 0
      ORDER BY ${orderBy === "units" ? "units DESC, revenue DESC" : "revenue DESC, units DESC"}, sd.sku ASC
      LIMIT 8
    `,
    range.dateFrom,
    range.dateTo,
    NON_MERCH_SKUS,
    NORMALIZED_NON_MERCH_DEPT_NAMES,
  );

  return rows.map(toProductPerformanceRow);
}

async function findProductTrends(trendDirection: "accelerating" | "decelerating") {
  const rows = await prisma.$queryRawUnsafe<ProductTrendSqlRow[]>(
    `
      SELECT
        pwd.sku,
        COALESCE(
          NULLIF(TRIM(pwd.title), ''),
          NULLIF(TRIM(pwd.description), ''),
          CONCAT('SKU ', pwd.sku::text)
        ) AS description,
        COALESCE(NULLIF(TRIM(pwd.dept_name), ''), 'Uncategorized') AS department,
        COALESCE(pwd.units_sold_30d, 0) AS units_sold_30d,
        COALESCE(pwd.units_sold_1y, 0) AS units_sold_1y,
        COALESCE(pwd.revenue_30d, 0) AS revenue_30d,
        pwd.first_sale_date_computed AS first_sale_date,
        pwd.last_sale_date_computed AS last_sale_date,
        pwd.trend_direction
      FROM products_with_derived pwd
      WHERE pwd.trend_direction = $1
        AND COALESCE(pwd.units_sold_30d, 0) > 0
${buildNonMerchandiseFilterSql({
  skuColumn: "pwd.sku",
  deptColumn: "pwd.dept_name",
  categoryColumn: "pwd.cat_name",
  skuParamIndex: 2,
  nameParamIndex: 3,
})}
      ORDER BY pwd.units_sold_30d DESC, pwd.revenue_30d DESC, pwd.sku ASC
      LIMIT 8
    `,
    trendDirection,
    NON_MERCH_SKUS,
    NORMALIZED_NON_MERCH_DEPT_NAMES,
  );

  return rows.map(toProductTrendRow);
}

async function findNewProducts() {
  const rows = await prisma.$queryRawUnsafe<ProductTrendSqlRow[]>(
    `
      SELECT
        pwd.sku,
        COALESCE(
          NULLIF(TRIM(pwd.title), ''),
          NULLIF(TRIM(pwd.description), ''),
          CONCAT('SKU ', pwd.sku::text)
        ) AS description,
        COALESCE(NULLIF(TRIM(pwd.dept_name), ''), 'Uncategorized') AS department,
        COALESCE(pwd.units_sold_30d, 0) AS units_sold_30d,
        COALESCE(pwd.units_sold_1y, 0) AS units_sold_1y,
        COALESCE(pwd.revenue_30d, 0) AS revenue_30d,
        pwd.first_sale_date_computed AS first_sale_date,
        pwd.last_sale_date_computed AS last_sale_date,
        pwd.trend_direction
      FROM products_with_derived pwd
      WHERE pwd.first_sale_date_computed >= $1::date
${buildNonMerchandiseFilterSql({
  skuColumn: "pwd.sku",
  deptColumn: "pwd.dept_name",
  categoryColumn: "pwd.cat_name",
  skuParamIndex: 2,
  nameParamIndex: 3,
})}
      ORDER BY pwd.revenue_30d DESC, pwd.units_sold_30d DESC, pwd.sku ASC
      LIMIT 8
    `,
    getNewProductThresholdDate(),
    NON_MERCH_SKUS,
    NORMALIZED_NON_MERCH_DEPT_NAMES,
  );

  return rows.map(toProductTrendRow);
}

async function findCategoryMix(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<CategoryMixRow[]>(
    `
      SELECT
        COALESCE(NULLIF(TRIM(MAX(p.dept_name)), ''), 'Uncategorized') AS category,
        COALESCE(SUM(sd.revenue), 0) AS revenue,
        COALESCE(SUM(sd.units), 0) AS units
      FROM analytics_sales_daily sd
      LEFT JOIN products p
        ON p.sku = sd.sku
      WHERE sd.location_id = 2
        AND sd.sale_date BETWEEN $1::date AND $2::date
${buildNonMerchandiseFilterSql({
  skuColumn: "sd.sku",
  deptColumn: "p.dept_name",
  categoryColumn: "p.cat_name",
  skuParamIndex: 3,
  nameParamIndex: 4,
})}
      GROUP BY COALESCE(NULLIF(TRIM(p.dept_name), ''), 'Uncategorized')
      ORDER BY revenue DESC, category ASC
      LIMIT 8
    `,
    range.dateFrom,
    range.dateTo,
    NON_MERCH_SKUS,
    NORMALIZED_NON_MERCH_DEPT_NAMES,
  );

  return rows.map((row) => ({
    category: normalizeText(row.category, "Uncategorized"),
    revenue: toNumber(row.revenue),
    units: toNumber(row.units),
  }));
}

async function findRevenueConcentration(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<RevenueBySkuRow[]>(
    `
      SELECT
        COALESCE(SUM(sd.revenue), 0) AS revenue
      FROM analytics_sales_daily sd
      LEFT JOIN products p
        ON p.sku = sd.sku
      WHERE sd.location_id = 2
        AND sd.sale_date BETWEEN $1::date AND $2::date
${buildNonMerchandiseFilterSql({
  skuColumn: "sd.sku",
  deptColumn: "p.dept_name",
  categoryColumn: "p.cat_name",
  skuParamIndex: 3,
  nameParamIndex: 4,
})}
      GROUP BY sd.sku
      HAVING COALESCE(SUM(sd.revenue), 0) > 0
      ORDER BY revenue DESC
    `,
    range.dateFrom,
    range.dateTo,
    NON_MERCH_SKUS,
    NORMALIZED_NON_MERCH_DEPT_NAMES,
  );

  const revenues = rows.map((row) => toNumber(row.revenue)).filter((value) => value > 0);
  const totalRevenue = revenues.reduce((sum, value) => sum + value, 0);
  const topProductShare = totalRevenue > 0 ? revenues[0] / totalRevenue : 0;

  let runningRevenue = 0;
  let skuCountFor80Percent = 0;
  for (const revenue of revenues) {
    if (runningRevenue / (totalRevenue || 1) >= 0.8) break;
    runningRevenue += revenue;
    skuCountFor80Percent += 1;
  }

  return {
    topProductShare,
    skuCountFor80Percent,
    totalSkuCount: revenues.length,
  };
}

async function findInventorySummary() {
  const rows = await prisma.$queryRawUnsafe<InventorySummaryRow[]>(
    `
      SELECT
        COALESCE(SUM(COALESCE(inv.cost, p.cost, 0) * GREATEST(COALESCE(inv.stock_on_hand, 0), 0))
          FILTER (
            WHERE COALESCE(inv.stock_on_hand, 0) > 0
              AND (inv.last_sale_date IS NULL OR inv.last_sale_date < NOW() - interval '1 year')
          ), 0) AS dead_stock_cost,
        COUNT(*) FILTER (
          WHERE inv.location_id = 2
            AND COALESCE(inv.stock_on_hand, 0) > 0
            AND COALESCE(inv.min_stock, 0) > 0
            AND COALESCE(inv.stock_on_hand, 0) < COALESCE(inv.min_stock, 0)
            AND COALESCE(p.units_sold_30d, 0) > 0
        ) AS low_stock_high_demand_count,
        COUNT(*) FILTER (
          WHERE COALESCE(inv.min_stock, 0) > 0
            AND COALESCE(inv.stock_on_hand, 0) < COALESCE(inv.min_stock, 0)
        ) AS reorder_breach_count
      FROM product_inventory inv
      LEFT JOIN products p
        ON p.sku = inv.sku
    `,
  );

  return {
    deadStockCost: toNumber(rows[0]?.dead_stock_cost),
    lowStockHighDemandCount: toInteger(rows[0]?.low_stock_high_demand_count),
    reorderBreachCount: toInteger(rows[0]?.reorder_breach_count),
  };
}

async function findReorderBreachesByLocation() {
  const rows = await prisma.$queryRawUnsafe<BreachByLocationRow[]>(
    `
      SELECT
        inv.location_abbrev AS location,
        COUNT(*) AS count
      FROM product_inventory inv
      WHERE COALESCE(inv.min_stock, 0) > 0
        AND COALESCE(inv.stock_on_hand, 0) < COALESCE(inv.min_stock, 0)
      GROUP BY inv.location_abbrev
      ORDER BY count DESC, location ASC
    `,
  );

  return rows.map((row) => ({
    location: normalizeText(row.location, "Unknown"),
    count: toInteger(row.count),
  }));
}

async function findStaleInventoryByLocation() {
  const rows = await prisma.$queryRawUnsafe<StaleInventoryRow[]>(
    `
      SELECT
        inv.location_abbrev AS location,
        COUNT(*) FILTER (
          WHERE inv.last_sale_date >= NOW() - interval '30 days'
        ) AS fresh_30d,
        COUNT(*) FILTER (
          WHERE inv.last_sale_date < NOW() - interval '30 days'
            AND inv.last_sale_date >= NOW() - interval '90 days'
        ) AS stale_31_to_90d,
        COUNT(*) FILTER (
          WHERE inv.last_sale_date < NOW() - interval '90 days'
            AND inv.last_sale_date >= NOW() - interval '1 year'
        ) AS stale_91_to_365d,
        COUNT(*) FILTER (
          WHERE inv.last_sale_date < NOW() - interval '1 year'
        ) AS stale_over_365d,
        COUNT(*) FILTER (
          WHERE inv.last_sale_date IS NULL
        ) AS never_sold
      FROM product_inventory inv
      WHERE COALESCE(inv.stock_on_hand, 0) > 0
      GROUP BY inv.location_abbrev
      ORDER BY inv.location_abbrev ASC
    `,
  );

  return rows.map((row) => ({
    location: normalizeText(row.location, "Unknown"),
    fresh30d: toInteger(row.fresh_30d),
    stale31To90d: toInteger(row.stale_31_to_90d),
    stale91To365d: toInteger(row.stale_91_to_365d),
    staleOver365d: toInteger(row.stale_over_365d),
    neverSold: toInteger(row.never_sold),
  }));
}

async function findDeadInventory() {
  const rows = await prisma.$queryRawUnsafe<InventoryHealthSqlRow[]>(
    `
      SELECT
        inv.sku,
        COALESCE(
          NULLIF(TRIM(p.title), ''),
          NULLIF(TRIM(p.description), ''),
          CONCAT('SKU ', inv.sku::text)
        ) AS description,
        inv.location_abbrev AS location,
        COALESCE(inv.stock_on_hand, 0) AS stock_on_hand,
        COALESCE(inv.min_stock, 0) AS min_stock,
        COALESCE(p.units_sold_30d, 0) AS units_sold_30d,
        COALESCE(inv.cost, p.cost, 0) * GREATEST(COALESCE(inv.stock_on_hand, 0), 0) AS stock_value,
        inv.last_sale_date,
        CASE
          WHEN inv.last_sale_date IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM NOW() - inv.last_sale_date)::int
        END AS days_since_last_sale
      FROM product_inventory inv
      LEFT JOIN products p
        ON p.sku = inv.sku
      WHERE COALESCE(inv.stock_on_hand, 0) > 0
        AND (inv.last_sale_date IS NULL OR inv.last_sale_date < NOW() - interval '1 year')
      ORDER BY stock_value DESC, inv.sku ASC
      LIMIT 8
    `,
  );

  return rows.map(toInventoryHealthRow);
}

async function findSlowMovingInventory() {
  const rows = await prisma.$queryRawUnsafe<InventoryHealthSqlRow[]>(
    `
      SELECT
        inv.sku,
        COALESCE(
          NULLIF(TRIM(p.title), ''),
          NULLIF(TRIM(p.description), ''),
          CONCAT('SKU ', inv.sku::text)
        ) AS description,
        inv.location_abbrev AS location,
        COALESCE(inv.stock_on_hand, 0) AS stock_on_hand,
        COALESCE(inv.min_stock, 0) AS min_stock,
        COALESCE(p.units_sold_30d, 0) AS units_sold_30d,
        COALESCE(inv.cost, p.cost, 0) * GREATEST(COALESCE(inv.stock_on_hand, 0), 0) AS stock_value,
        inv.last_sale_date,
        CASE
          WHEN inv.last_sale_date IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM NOW() - inv.last_sale_date)::int
        END AS days_since_last_sale
      FROM product_inventory inv
      LEFT JOIN products p
        ON p.sku = inv.sku
      WHERE COALESCE(inv.stock_on_hand, 0) > 0
        AND inv.last_sale_date < NOW() - interval '180 days'
        AND inv.last_sale_date >= NOW() - interval '1 year'
      ORDER BY stock_value DESC, inv.sku ASC
      LIMIT 8
    `,
  );

  return rows.map(toInventoryHealthRow);
}

async function findLowStockHighDemand() {
  const rows = await prisma.$queryRawUnsafe<LowStockSqlRow[]>(
    `
      SELECT
        inv.sku,
        COALESCE(
          NULLIF(TRIM(p.title), ''),
          NULLIF(TRIM(p.description), ''),
          CONCAT('SKU ', inv.sku::text)
        ) AS description,
        inv.location_abbrev AS location,
        COALESCE(inv.stock_on_hand, 0) AS stock_on_hand,
        COALESCE(inv.min_stock, 0) AS min_stock,
        COALESCE(p.units_sold_30d, 0) AS units_sold_30d,
        inv.last_sale_date
      FROM product_inventory inv
      INNER JOIN products p
        ON p.sku = inv.sku
      WHERE inv.location_id = 2
        AND COALESCE(inv.min_stock, 0) > 0
        AND COALESCE(inv.stock_on_hand, 0) < COALESCE(inv.min_stock, 0)
        AND COALESCE(p.units_sold_30d, 0) > 0
      ORDER BY p.units_sold_30d DESC, inv.stock_on_hand ASC, inv.sku ASC
      LIMIT 8
    `,
  );

  return rows.map(toLowStockRow);
}

async function findCopyTechAnalytics(range: AnalyticsDateRange) {
  const bounds = buildRangeBounds(range);
  const [summaryRows, monthlyRows, serviceMixRows, requesterRows] = await Promise.all([
    prisma.$queryRawUnsafe<CopyTechSummaryRow[]>(
      `
        WITH invoice_summary AS (
          SELECT
            COALESCE(SUM(total_amount), 0) AS invoice_revenue,
            COUNT(*) AS invoice_count
          FROM invoices
          WHERE type = 'INVOICE'
            AND category = 'COPY_TECH'
            AND archived_at IS NULL
            AND created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
        ),
        quote_summary AS (
          SELECT
            COALESCE(SUM(total_cents), 0) / 100.0 AS quote_revenue,
            COUNT(*) AS quote_count
          FROM print_quotes
          WHERE created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
        )
        SELECT
          invoice_summary.invoice_revenue,
          invoice_summary.invoice_count,
          quote_summary.quote_revenue,
          quote_summary.quote_count
        FROM invoice_summary, quote_summary
      `,
      bounds.start,
      bounds.endExclusive,
    ),
    prisma.$queryRawUnsafe<CopyTechMonthlyRow[]>(
      `
        SELECT
          month,
          COALESCE(SUM(invoice_revenue), 0) AS invoice_revenue,
          COALESCE(SUM(invoice_count), 0) AS invoice_count,
          COALESCE(SUM(quote_revenue), 0) AS quote_revenue,
          COALESCE(SUM(quote_count), 0) AS quote_count
        FROM (
          SELECT
            TO_CHAR(created_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM') AS month,
            total_amount AS invoice_revenue,
            1 AS invoice_count,
            0::numeric AS quote_revenue,
            0 AS quote_count
          FROM invoices
          WHERE type = 'INVOICE'
            AND category = 'COPY_TECH'
            AND archived_at IS NULL
            AND created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
          UNION ALL
          SELECT
            TO_CHAR(created_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM') AS month,
            0::numeric AS invoice_revenue,
            0 AS invoice_count,
            total_cents / 100.0 AS quote_revenue,
            1 AS quote_count
          FROM print_quotes
          WHERE created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
        ) rows
        GROUP BY month
        ORDER BY month ASC
      `,
      bounds.start,
      bounds.endExclusive,
    ),
    prisma.$queryRawUnsafe<CopyTechServiceMixSqlRow[]>(
      `
        SELECT
          line_items.service::text AS service,
          COALESCE(SUM(line_items.line_total_cents), 0) / 100.0 AS revenue,
          COALESCE(SUM(line_items.quantity), 0) AS quantity
        FROM print_quote_line_items line_items
        INNER JOIN print_quotes quotes
          ON quotes.id = line_items.quote_id
        WHERE quotes.created_at >= $1::timestamptz
          AND quotes.created_at < $2::timestamptz
        GROUP BY line_items.service
        ORDER BY revenue DESC, service ASC
      `,
      bounds.start,
      bounds.endExclusive,
    ),
    prisma.$queryRawUnsafe<CopyTechRequesterSqlRow[]>(
      `
        SELECT
          requester AS name,
          COALESCE(SUM(revenue), 0) AS revenue,
          COALESCE(SUM(invoice_count), 0) AS invoice_count,
          COALESCE(SUM(quote_count), 0) AS quote_count
        FROM (
          SELECT
            COALESCE(NULLIF(TRIM(recipient_org), ''), 'Unspecified requester') AS requester,
            total_amount AS revenue,
            1 AS invoice_count,
            0 AS quote_count
          FROM invoices
          WHERE type = 'INVOICE'
            AND category = 'COPY_TECH'
            AND archived_at IS NULL
            AND created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
          UNION ALL
          SELECT
            COALESCE(NULLIF(TRIM(requester_organization), ''), 'Unspecified requester') AS requester,
            total_cents / 100.0 AS revenue,
            0 AS invoice_count,
            1 AS quote_count
          FROM print_quotes
          WHERE created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
        ) rows
        GROUP BY requester
        ORDER BY revenue DESC, requester ASC
        LIMIT 8
      `,
      bounds.start,
      bounds.endExclusive,
    ),
  ]);

  const summary = summaryRows[0];

  return {
    summary: {
      invoiceRevenue: toNumber(summary?.invoice_revenue),
      invoiceCount: toInteger(summary?.invoice_count),
      quoteRevenue: toNumber(summary?.quote_revenue),
      quoteCount: toInteger(summary?.quote_count),
    },
    monthly: monthlyRows.map((row) => ({
      month: row.month,
      invoiceRevenue: toNumber(row.invoice_revenue),
      invoiceCount: toInteger(row.invoice_count),
      quoteRevenue: toNumber(row.quote_revenue),
      quoteCount: toInteger(row.quote_count),
    })),
    serviceMix: serviceMixRows.map((row) => ({
      service: row.service,
      revenue: toNumber(row.revenue),
      quantity: toInteger(row.quantity),
    })),
    topRequesters: requesterRows.map((row) => ({
      name: normalizeText(row.name, "Unspecified requester"),
      revenue: toNumber(row.revenue),
      invoiceCount: toInteger(row.invoice_count),
      quoteCount: toInteger(row.quote_count),
    })),
  };
}

async function findLatestSyncRun() {
  const row = await prisma.syncRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: {
      startedAt: true,
      status: true,
      txnsAdded: true,
    },
  });

  if (!row) return null;

  return {
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    txnsAdded: row.txnsAdded ?? null,
  };
}

export const analyticsRepository = {
  async findFinanceAnalytics(range: AnalyticsDateRange): Promise<FinanceAnalytics> {
    return findFinanceAnalytics(range);
  },

  async findOperationsSnapshot(range: AnalyticsDateRange): Promise<OperationsSnapshot> {
    const [
      salesSummary,
      monthlySales,
      weekdaySales,
      hourlySales,
      topSelling,
      topRevenue,
      acceleratingItems,
      deceleratingItems,
      newItems,
      categoryMix,
      revenueConcentration,
      inventorySummary,
      reorderBreachesByLocation,
      staleInventoryByLocation,
      deadInventory,
      slowMovingInventory,
      lowStockHighDemand,
      copyTech,
      latestSyncRun,
    ] = await Promise.all([
      findSalesSummary(range),
      findMonthlySales(range),
      findWeekdaySales(range),
      findHourlySales(range),
      findTopProducts(range, "units"),
      findTopProducts(range, "revenue"),
      findProductTrends("accelerating"),
      findProductTrends("decelerating"),
      findNewProducts(),
      findCategoryMix(range),
      findRevenueConcentration(range),
      findInventorySummary(),
      findReorderBreachesByLocation(),
      findStaleInventoryByLocation(),
      findDeadInventory(),
      findSlowMovingInventory(),
      findLowStockHighDemand(),
      findCopyTechAnalytics(range),
      findLatestSyncRun(),
    ]);

    return {
      salesSummary,
      monthlySales,
      weekdaySales,
      hourlySales,
      topSelling,
      topRevenue,
      acceleratingItems,
      deceleratingItems,
      newItems,
      categoryMix,
      revenueConcentration,
      inventorySummary,
      reorderBreachesByLocation,
      staleInventoryByLocation,
      deadInventory,
      slowMovingInventory,
      lowStockHighDemand,
      copyTechSummary: copyTech.summary,
      copyTechMonthly: copyTech.monthly,
      copyTechServiceMix: copyTech.serviceMix,
      copyTechTopRequesters: copyTech.topRequesters,
      latestSyncRun,
    };
  },
};
