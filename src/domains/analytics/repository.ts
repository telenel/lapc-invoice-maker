import { prisma } from "@/lib/prisma";
import { addDaysToDateKey, getDateKeyInLosAngeles, shiftDateKey, zonedDateTimeToUtc } from "@/lib/date-utils";
import { buildIncludedFinanceWhere } from "@/domains/shared/finance";
import type { AnalyticsDateRange, AnalyticsFilters, OperationsSnapshot } from "./types";

type NumericLike = number | string | bigint | null | undefined;
type DateLike = Date | string | null | undefined;

type SalesSummaryRow = {
  revenue: NumericLike;
  units: NumericLike;
  receipts: NumericLike;
  discount_amount: NumericLike;
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

async function findSalesSummary(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<SalesSummaryRow[]>(
    `
      SELECT
        COALESCE(SUM(st.ext_price), 0) AS revenue,
        COALESCE(SUM(st.qty), 0) AS units,
        COUNT(DISTINCT st.transaction_id) AS receipts,
        COALESCE(SUM(st.discount_amt), 0) AS discount_amount
      FROM sales_transactions st
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
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
      SELECT
        TO_CHAR(date_trunc('month', st.process_date AT TIME ZONE 'America/Los_Angeles'), 'YYYY-MM') AS month,
        COALESCE(SUM(st.ext_price), 0) AS revenue,
        COALESCE(SUM(st.qty), 0) AS units,
        COUNT(DISTINCT st.transaction_id) AS receipts,
        COALESCE(SUM(st.discount_amt), 0) / NULLIF(COALESCE(SUM(st.ext_price), 0), 0) AS discount_rate
      FROM sales_transactions st
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
      GROUP BY 1
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
      SELECT
        EXTRACT(DOW FROM st.process_date AT TIME ZONE 'America/Los_Angeles')::int AS day_of_week,
        COALESCE(SUM(st.ext_price), 0) AS revenue,
        COUNT(DISTINCT st.transaction_id) AS receipts
      FROM sales_transactions st
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
      GROUP BY 1
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
        EXTRACT(HOUR FROM st.process_date AT TIME ZONE 'America/Los_Angeles')::int AS hour,
        COALESCE(SUM(st.ext_price), 0) AS revenue,
        COUNT(DISTINCT st.transaction_id) AS receipts
      FROM sales_transactions st
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
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
        st.sku::integer AS sku,
        COALESCE(
          NULLIF(TRIM(MAX(p.title)), ''),
          NULLIF(TRIM(MAX(p.description)), ''),
          NULLIF(TRIM(MAX(st.description)), ''),
          CONCAT('SKU ', st.sku::text)
        ) AS description,
        COALESCE(NULLIF(TRIM(MAX(p.dept_name)), ''), 'Uncategorized') AS department,
        COALESCE(SUM(st.qty), 0) AS units,
        COALESCE(SUM(st.ext_price), 0) AS revenue,
        MAX(st.process_date AT TIME ZONE 'America/Los_Angeles') AS last_sale_date,
        MAX(pwd.trend_direction) AS trend_direction
      FROM sales_transactions st
      LEFT JOIN products p
        ON p.sku = st.sku::integer
      LEFT JOIN products_with_derived pwd
        ON pwd.sku = st.sku::integer
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
      GROUP BY st.sku
      HAVING COALESCE(SUM(st.ext_price), 0) > 0
      ORDER BY ${orderBy === "units" ? "units DESC, revenue DESC" : "revenue DESC, units DESC"}, st.sku ASC
      LIMIT 8
    `,
    range.dateFrom,
    range.dateTo,
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
      ORDER BY pwd.units_sold_30d DESC, pwd.revenue_30d DESC, pwd.sku ASC
      LIMIT 8
    `,
    trendDirection,
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
      ORDER BY pwd.revenue_30d DESC, pwd.units_sold_30d DESC, pwd.sku ASC
      LIMIT 8
    `,
    getNewProductThresholdDate(),
  );

  return rows.map(toProductTrendRow);
}

async function findCategoryMix(range: AnalyticsDateRange) {
  const rows = await prisma.$queryRawUnsafe<CategoryMixRow[]>(
    `
      SELECT
        COALESCE(NULLIF(TRIM(MAX(p.dept_name)), ''), 'Uncategorized') AS category,
        COALESCE(SUM(st.ext_price), 0) AS revenue,
        COALESCE(SUM(st.qty), 0) AS units
      FROM sales_transactions st
      LEFT JOIN products p
        ON p.sku = st.sku::integer
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
      GROUP BY COALESCE(NULLIF(TRIM(p.dept_name), ''), 'Uncategorized')
      ORDER BY revenue DESC, category ASC
      LIMIT 8
    `,
    range.dateFrom,
    range.dateTo,
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
        COALESCE(SUM(st.ext_price), 0) AS revenue
      FROM sales_transactions st
      WHERE st.location_id = 2
        AND st.dtl_f_status <> 1
        AND (st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN $1::date AND $2::date
      GROUP BY st.sku
      HAVING COALESCE(SUM(st.ext_price), 0) > 0
      ORDER BY revenue DESC
    `,
    range.dateFrom,
    range.dateTo,
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
  const [invoices, printQuotes] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        type: "INVOICE",
        category: "COPY_TECH",
        archivedAt: null,
        createdAt: {
          gte: bounds.start,
          lt: bounds.endExclusive,
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
        recipientOrg: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.printQuote.findMany({
      where: {
        createdAt: {
          gte: bounds.start,
          lt: bounds.endExclusive,
        },
      },
      select: {
        totalCents: true,
        createdAt: true,
        requesterOrganization: true,
        lineItems: {
          select: {
            service: true,
            quantity: true,
            lineTotalCents: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const monthly = new Map<string, OperationsSnapshot["copyTechMonthly"][number]>();
  const topRequesters = new Map<string, OperationsSnapshot["copyTechTopRequesters"][number]>();
  const serviceMix = new Map<string, OperationsSnapshot["copyTechServiceMix"][number]>();

  let invoiceRevenue = 0;
  let quoteRevenue = 0;

  for (const invoice of invoices) {
    const month = getDateKeyInLosAngeles(invoice.createdAt).slice(0, 7);
    const revenue = Number(invoice.totalAmount);
    invoiceRevenue += revenue;

    const monthlyBucket = monthly.get(month) ?? {
      month,
      invoiceRevenue: 0,
      quoteRevenue: 0,
      invoiceCount: 0,
      quoteCount: 0,
    };
    monthlyBucket.invoiceRevenue += revenue;
    monthlyBucket.invoiceCount += 1;
    monthly.set(month, monthlyBucket);

    const requester = normalizeText(invoice.recipientOrg, "Unspecified requester");
    const requesterBucket = topRequesters.get(requester) ?? {
      name: requester,
      revenue: 0,
      invoiceCount: 0,
      quoteCount: 0,
    };
    requesterBucket.revenue += revenue;
    requesterBucket.invoiceCount += 1;
    topRequesters.set(requester, requesterBucket);
  }

  for (const quote of printQuotes) {
    const month = getDateKeyInLosAngeles(quote.createdAt).slice(0, 7);
    const revenue = quote.totalCents / 100;
    quoteRevenue += revenue;

    const monthlyBucket = monthly.get(month) ?? {
      month,
      invoiceRevenue: 0,
      quoteRevenue: 0,
      invoiceCount: 0,
      quoteCount: 0,
    };
    monthlyBucket.quoteRevenue += revenue;
    monthlyBucket.quoteCount += 1;
    monthly.set(month, monthlyBucket);

    const requester = normalizeText(quote.requesterOrganization, "Unspecified requester");
    const requesterBucket = topRequesters.get(requester) ?? {
      name: requester,
      revenue: 0,
      invoiceCount: 0,
      quoteCount: 0,
    };
    requesterBucket.revenue += revenue;
    requesterBucket.quoteCount += 1;
    topRequesters.set(requester, requesterBucket);

    for (const lineItem of quote.lineItems) {
      const serviceBucket = serviceMix.get(lineItem.service) ?? {
        service: lineItem.service,
        revenue: 0,
        quantity: 0,
      };
      serviceBucket.revenue += lineItem.lineTotalCents / 100;
      serviceBucket.quantity += lineItem.quantity;
      serviceMix.set(lineItem.service, serviceBucket);
    }
  }

  return {
    summary: {
      invoiceRevenue,
      invoiceCount: invoices.length,
      quoteRevenue,
      quoteCount: printQuotes.length,
    },
    monthly: Array.from(monthly.values()).sort((left, right) => left.month.localeCompare(right.month)),
    serviceMix: Array.from(serviceMix.values()).sort((left, right) => right.revenue - left.revenue),
    topRequesters: Array.from(topRequesters.values()).sort((left, right) => right.revenue - left.revenue).slice(0, 8),
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
  async findFinanceDocuments(filters: AnalyticsFilters) {
    return prisma.invoice.findMany({
      where: buildIncludedFinanceWhere(filters.dateFrom, filters.dateTo),
      select: {
        type: true,
        status: true,
        quoteStatus: true,
        convertedToInvoice: { select: { id: true } },
        date: true,
        totalAmount: true,
        category: true,
        department: true,
        createdBy: true,
      },
      orderBy: { date: "asc" },
    }).then((documents) =>
      documents.map((document) => ({
        ...document,
        convertedToInvoiceId: document.convertedToInvoice?.id ?? null,
      })),
    );
  },

  async findUsersByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
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
