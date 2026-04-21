"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  InventoryHealthRow,
  LowStockHighDemandRow,
  OperationsAnalytics,
  ProductPerformanceRow,
  ProductTrendRow,
} from "@/domains/analytics/types";
import { formatAmount, formatDateCompact } from "@/domains/shared/formatters";

const MonthlySalesPatternsChart = dynamic(
  () => import("./monthly-sales-patterns-chart").then((m) => m.MonthlySalesPatternsChart),
  { ssr: false },
);
const WeekdaySalesChart = dynamic(
  () => import("./weekday-sales-chart").then((m) => m.WeekdaySalesChart),
  { ssr: false },
);
const HourlySalesChart = dynamic(
  () => import("./hourly-sales-chart").then((m) => m.HourlySalesChart),
  { ssr: false },
);
const CategoryMixChart = dynamic(
  () => import("./category-mix-chart").then((m) => m.CategoryMixChart),
  { ssr: false },
);

function formatMetricNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 });
}

function formatPercent(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function formatMonthLabel(month: string) {
  const [year, value] = month.split("-");
  return new Date(Number(year), Number(value) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatTrendLabel(trend: ProductPerformanceRow["trendDirection"] | ProductTrendRow["trendDirection"]) {
  if (!trend) return "No trend";
  if (trend === "accelerating") return "Accelerating";
  if (trend === "decelerating") return "Decelerating";
  return "Steady";
}

function formatDateLabel(value: string | null) {
  return value ? formatDateCompact(value) : "Never";
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold text-balance">{title}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function HighlightCard({
  title,
  detail,
  tone,
}: OperationsAnalytics["highlights"][number]) {
  const toneClassName = tone === "warning"
    ? "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10"
    : tone === "positive"
      ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10"
      : "border-slate-200/70 bg-slate-50/60 dark:border-white/10 dark:bg-white/[0.03]";

  return (
    <Card className={`border ${toneClassName}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ProductPerformanceTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: ProductPerformanceRow[];
}) {
  if (rows.length === 0) {
    return <EmptyCard title={title} description="No mirrored store sales matched this date range." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Dept</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Last sale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${title}-${row.sku}`}>
                <TableCell>{row.sku}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal">
                  <div className="font-medium">{row.description}</div>
                  <div className="text-xs text-muted-foreground">{formatTrendLabel(row.trendDirection)}</div>
                </TableCell>
                <TableCell>{row.department}</TableCell>
                <TableCell>{formatMetricNumber(row.units)}</TableCell>
                <TableCell>{formatAmount(row.revenue)}</TableCell>
                <TableCell>{formatDateLabel(row.lastSaleDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProductTrendList({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: ProductTrendRow[];
}) {
  if (rows.length === 0) {
    return <EmptyCard title={title} description="No items surfaced for this trend slice in the current mirror." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={`${title}-${row.sku}`} className="rounded-lg border border-border/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium">{row.description}</p>
                <p className="text-xs text-muted-foreground">{row.department}</p>
              </div>
              <p className="text-xs text-muted-foreground">{formatTrendLabel(row.trendDirection)}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">{formatMetricNumber(row.unitsSold30d)}</p>
                <p>30d units</p>
              </div>
              <div>
                <p className="font-medium text-foreground">{formatMetricNumber(row.unitsSold1y)}</p>
                <p>1y units</p>
              </div>
              <div>
                <p className="font-medium text-foreground">{formatAmount(row.revenue30d)}</p>
                <p>30d revenue</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InventoryTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: InventoryHealthRow[];
}) {
  if (rows.length === 0) {
    return <EmptyCard title={title} description="Nothing in this slice currently needs attention." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Loc</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Last sale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${title}-${row.location}-${row.sku}`}>
                <TableCell>{row.sku}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal">
                  <div className="font-medium">{row.description}</div>
                  <div className="text-xs text-muted-foreground">{row.daysSinceLastSale == null ? "Never sold" : `${row.daysSinceLastSale} days since sale`}</div>
                </TableCell>
                <TableCell>{row.location}</TableCell>
                <TableCell>{formatMetricNumber(row.stockOnHand)}</TableCell>
                <TableCell>{formatAmount(row.stockValue)}</TableCell>
                <TableCell>{formatDateLabel(row.lastSaleDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LowStockTable({
  rows,
}: {
  rows: LowStockHighDemandRow[];
}) {
  if (rows.length === 0) {
    return <EmptyCard title="Low-stock, high-demand" description="No PIER items are below min stock with mirrored demand right now." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Low-stock, high-demand</CardTitle>
        <CardDescription>PIER-only alert list where current stock is below min and recent mirrored demand is still active.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Min</TableHead>
              <TableHead>30d units</TableHead>
              <TableHead>Last sale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.location}-${row.sku}`}>
                <TableCell>{row.sku}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal">
                  <div className="font-medium">{row.description}</div>
                  <div className="text-xs text-muted-foreground">{row.location}</div>
                </TableCell>
                <TableCell>{formatMetricNumber(row.stockOnHand)}</TableCell>
                <TableCell>{formatMetricNumber(row.minStock)}</TableCell>
                <TableCell>{formatMetricNumber(row.unitsSold30d)}</TableCell>
                <TableCell>{formatDateLabel(row.lastSaleDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LocationCountCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ location: string; count: number }>;
}) {
  if (rows.length === 0) {
    return <EmptyCard title={title} description="No rows were returned for this inventory slice." />;
  }

  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.location} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{row.location}</span>
              <span className="tabular-nums text-muted-foreground">{row.count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-foreground/80"
                style={{ width: `${Math.max((row.count / max) * 100, 8)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StaleInventoryCard({
  rows,
}: {
  rows: OperationsAnalytics["inventoryHealth"]["staleInventoryByLocation"];
}) {
  if (rows.length === 0) {
    return <EmptyCard title="Stale inventory by location" description="There are no stocked inventory rows to summarize." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stale inventory by location</CardTitle>
        <CardDescription>Current stocked inventory grouped by recency of last sale.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loc</TableHead>
              <TableHead>0-30d</TableHead>
              <TableHead>31-90d</TableHead>
              <TableHead>91-365d</TableHead>
              <TableHead>&gt;365d</TableHead>
              <TableHead>Never</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.location}>
                <TableCell>{row.location}</TableCell>
                <TableCell>{formatMetricNumber(row.fresh30d)}</TableCell>
                <TableCell>{formatMetricNumber(row.stale31To90d)}</TableCell>
                <TableCell>{formatMetricNumber(row.stale91To365d)}</TableCell>
                <TableCell>{formatMetricNumber(row.staleOver365d)}</TableCell>
                <TableCell>{formatMetricNumber(row.neverSold)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SimpleTopRequesters({
  rows,
}: {
  rows: OperationsAnalytics["copyTech"]["topRequesters"];
}) {
  if (rows.length === 0) {
    return <EmptyCard title="Top requesters" description="No CopyTech requester activity landed in this date range." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top requesters</CardTitle>
        <CardDescription>Organizations generating the most CopyTech revenue across invoices and print quotes.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requester</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Quotes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="max-w-[220px] whitespace-normal font-medium">{row.name}</TableCell>
                <TableCell>{formatAmount(row.revenue)}</TableCell>
                <TableCell>{formatMetricNumber(row.invoiceCount)}</TableCell>
                <TableCell>{formatMetricNumber(row.quoteCount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ServiceMixTable({
  rows,
}: {
  rows: OperationsAnalytics["copyTech"]["serviceMix"];
}) {
  if (rows.length === 0) {
    return <EmptyCard title="Service mix" description="No print-quote line items landed in this date range." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service mix</CardTitle>
        <CardDescription>Quote activity by CopyTech service line.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.service}>
                <TableCell className="font-medium">{row.service}</TableCell>
                <TableCell>{formatAmount(row.revenue)}</TableCell>
                <TableCell>{formatMetricNumber(row.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CopyTechMonthlyTable({
  rows,
}: {
  rows: OperationsAnalytics["copyTech"]["monthly"];
}) {
  if (rows.length === 0) {
    return <EmptyCard title="Monthly CopyTech trend" description="No CopyTech invoices or print quotes landed in this date range." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly CopyTech trend</CardTitle>
        <CardDescription>Invoice and quote volume by month so production teams can spot demand shifts over time.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Invoice revenue</TableHead>
              <TableHead>Quote revenue</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Quotes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="font-medium">{formatMonthLabel(row.month)}</TableCell>
                <TableCell>{formatAmount(row.invoiceRevenue)}</TableCell>
                <TableCell>{formatAmount(row.quoteRevenue)}</TableCell>
                <TableCell>{formatMetricNumber(row.invoiceCount)}</TableCell>
                <TableCell>{formatMetricNumber(row.quoteCount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function OperationsDashboard({ data }: { data: OperationsAnalytics }) {
  const hasSalesData = data.overview.receipts > 0;

  return (
    <div className="flex flex-col gap-8">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-gradient-to-br from-emerald-100/70 via-background to-amber-100/50 dark:from-emerald-500/10 dark:via-background dark:to-amber-500/10">
          <CardTitle className="text-2xl">Store operations</CardTitle>
          <CardDescription className="max-w-3xl">
            Actionable read-only analytics across mirrored Pierce POS sales, current multi-location inventory, and CopyTech workflow records. Finance analytics stay intact in the neighboring tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Date-range charts reflect the selected window. Rolling product-trend cards stay grounded in the current mirror so operators can spot what is accelerating, decelerating, or newly landing right now.
            </p>
            <p className="text-sm text-muted-foreground">
              Last mirrored transaction sync:{" "}
              <span className="font-medium text-foreground">
                {data.overview.lastSyncStartedAt ? formatDateCompact(data.overview.lastSyncStartedAt) : "Unavailable"}
              </span>
              {data.overview.lastSyncStatus ? ` • ${data.overview.lastSyncStatus}` : ""}
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-4">
            <p className="font-medium">Current caveats</p>
            {data.limitations.map((item) => (
              <p key={item} className="text-sm text-muted-foreground">
                {item}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {data.highlights.map((item) => (
          <HighlightCard key={item.title} {...item} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Mirrored store sales" value={formatAmount(data.overview.revenue)} detail="Net revenue from the selected mirrored Pierce POS window." />
        <MetricCard title="Units sold" value={formatMetricNumber(data.overview.units)} detail="Units moved through the mirrored store feed in this range." />
        <MetricCard title="Distinct receipts" value={formatMetricNumber(data.overview.receipts)} detail="Receipt count is a practical traffic proxy for staffing." />
        <MetricCard title="Average basket" value={formatAmount(data.overview.averageBasket)} detail="Revenue per mirrored receipt in the current range." />
        <MetricCard title="Dead stock at risk" value={formatAmount(data.overview.deadStockCost)} detail="Current on-hand value for inventory untouched in more than a year." />
        <MetricCard title="Reorder pressure" value={formatMetricNumber(data.overview.reorderBreachCount)} detail="Inventory rows currently below their configured min stock." />
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Sales trends"
          description="Busiest periods, monthly seasonality, and daily traffic patterns from the mirrored Pierce POS transaction feed."
        />
        {!hasSalesData ? (
          <EmptyCard title="Sales trends" description="No mirrored store sales landed in this date range. Try widening the window." />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Monthly sales pattern</CardTitle>
                <CardDescription>Revenue bars plus unit trend across the selected range.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlySalesPatternsChart data={data.salesPatterns.monthly} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busiest days of the week</CardTitle>
                <CardDescription>Use this to sanity-check staffing and production coverage.</CardDescription>
              </CardHeader>
              <CardContent>
                <WeekdaySalesChart data={data.salesPatterns.weekdays} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busiest store times</CardTitle>
                <CardDescription>Hourly demand only renders when the mirrored timestamps carry meaningful sale hours.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.salesPatterns.hourlyAvailable ? (
                  <HourlySalesChart data={data.salesPatterns.hourly} />
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-sm text-muted-foreground">
                    {data.salesPatterns.hourlyFallbackMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Product performance"
          description="Best sellers, best revenue generators, current velocity shifts, and how concentrated store revenue is across the catalog."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ProductPerformanceTable
            title="Highest-selling items"
            description="Top mirrored SKUs by units sold in the selected window."
            rows={data.productPerformance.topSelling}
          />
          <ProductPerformanceTable
            title="Highest-revenue items"
            description="Top mirrored SKUs by revenue in the selected window."
            rows={data.productPerformance.topRevenue}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <ProductTrendList
            title="Accelerating items"
            description="Items outpacing their longer-term run rate."
            rows={data.productPerformance.accelerating}
          />
          <ProductTrendList
            title="Decelerating items"
            description="Items slowing down versus their longer-term demand."
            rows={data.productPerformance.decelerating}
          />
          <ProductTrendList
            title="New arrivals gaining traction"
            description="Products first sold in the last 90 days with early movement."
            rows={data.productPerformance.newItems}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by department</CardTitle>
              <CardDescription>High-level merchandising mix for the selected mirrored range.</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryMixChart data={data.productPerformance.categoryMix} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue concentration</CardTitle>
              <CardDescription>How much of mirrored store revenue comes from a relatively small number of SKUs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-3xl font-semibold tracking-tight">{formatPercent(data.productPerformance.revenueConcentration.topProductShare * 100)}</p>
                <p className="text-sm text-muted-foreground">Share of revenue driven by the single top SKU in this date range.</p>
              </div>
              <div className="space-y-2 rounded-xl border border-border/70 p-4">
                <p className="font-medium">
                  {data.productPerformance.revenueConcentration.skuCountFor80Percent} of {data.productPerformance.revenueConcentration.totalSkuCount} active SKUs drive 80% of mirrored revenue.
                </p>
                <p className="text-sm text-muted-foreground">
                  That means only {formatPercent(data.productPerformance.revenueConcentration.percentOfSkusFor80Percent)} of selling SKUs are carrying most of the store load.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Inventory health"
          description="Current stocking risks across mirrored inventory rows, with demand-backed alerts kept explicit about the PIER-only sales feed."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LocationCountCard
            title="Reorder breaches by location"
            description="Rows below configured min stock right now."
            rows={data.inventoryHealth.reorderBreachesByLocation}
          />
          <StaleInventoryCard rows={data.inventoryHealth.staleInventoryByLocation} />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <LowStockTable rows={data.inventoryHealth.lowStockHighDemand} />
          <InventoryTable
            title="Dead inventory"
            description="Current on-hand stock with no sale in over a year, ranked by tied-up value."
            rows={data.inventoryHealth.deadInventory}
          />
          <InventoryTable
            title="Slow-moving inventory"
            description="Items with on-hand stock whose last sale is old enough to deserve a merchandising review."
            rows={data.inventoryHealth.slowMoving}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="CopyTech"
          description="Workflow-side CopyTech patterns from LAPortal invoices and print quotes, separated from the store POS mirror."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Invoice revenue" value={formatAmount(data.copyTech.summary.invoiceRevenue)} detail="Recorded CopyTech invoice total in the selected window." />
          <MetricCard title="Invoice count" value={formatMetricNumber(data.copyTech.summary.invoiceCount)} detail="Operational CopyTech invoices created in the selected window." />
          <MetricCard title="Quote revenue" value={formatAmount(data.copyTech.summary.quoteRevenue)} detail="Print-quote total captured before conversion or production." />
          <MetricCard title="Quote count" value={formatMetricNumber(data.copyTech.summary.quoteCount)} detail="In-house print quotes created in the selected window." />
        </div>
        <CopyTechMonthlyTable rows={data.copyTech.monthly} />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ServiceMixTable rows={data.copyTech.serviceMix} />
          <SimpleTopRequesters rows={data.copyTech.topRequesters} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>CopyTech limitations</CardTitle>
            <CardDescription>What this section can and cannot answer today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.copyTech.limitations.map((item) => (
              <p key={item} className="text-sm text-muted-foreground">{item}</p>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
