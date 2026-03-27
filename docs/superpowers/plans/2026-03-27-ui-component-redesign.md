# UI Component Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the app from a functional portal to a polished Modern SaaS dashboard by redesigning every component with shadow-based depth, tighter typography, pill-style navigation, sparkline stat cards, and avatar-style table rows.

**Architecture:** Same page structure and routes — only component internals and CSS change. The Card base component gets shadow-based depth instead of ring borders. Badge gets new status-specific color variants. Nav, stats, tables, forms, and detail pages all get visual upgrades per the spec.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS 4, shadcn/ui v4 (base-ui), DM Sans font

**Spec:** `docs/superpowers/specs/2026-03-27-ui-component-redesign-design.md`

---

### Task 1: Card Component — Shadow-Based Depth

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Update Card base styles**

Replace the `ring-1 ring-foreground/10` border with shadow-based depth and bump radius to `rounded-xl`:

```tsx
// In Card component, change the className from:
"group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl"

// To:
"group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl dark:border dark:border-white/[0.08] dark:shadow-none"
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "style: replace Card ring borders with shadow-based depth"
```

---

### Task 2: Badge Component — Status Color Variants

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Add status-specific badge variants**

Add three new variants for invoice/quote statuses. In `badgeVariants`, add to the `variants.variant` object:

```tsx
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-transparent px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
        warning:
          "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        info:
          "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

Note: also changed `rounded-4xl` to `rounded-lg` and `font-medium` to `font-semibold` in the base class.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "style: add success/warning/info badge variants, rounded-lg, semibold"
```

---

### Task 3: Navigation Redesign

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Update nav link styles to pill-based active state**

Replace the nav link rendering. Change the link `className` from uppercase + underline to normal-case + pill:

```tsx
// In the links.map() block, change className from:
"relative px-3 py-2 text-sm font-medium tracking-wide uppercase transition-colors",
isActive
  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
  : "text-muted-foreground hover:text-foreground"

// To:
"relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
isActive
  ? "bg-muted text-foreground"
  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
```

Apply the same change to the Admin link.

- [ ] **Step 2: Update logo area with gradient background**

Change the logo `<img>` wrapper background. Replace the `<Link>` that contains the logo:

```tsx
<Link href="/" className="flex items-center gap-2 shrink-0">
  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800">
    <img src="/lapc-logo.png" alt="LAPC" width={22} style={{ height: "22px" }} />
  </div>
  <span className="font-bold tracking-tight text-lg">InvoiceMaker</span>
</Link>
```

- [ ] **Step 3: Update right-side controls**

Replace the sign-out section. Change the right controls area to use icon buttons and an avatar:

```tsx
<div ref={menuRef} className="ml-auto flex items-center gap-1">
  <HelpModal />

  {/* Theme picker */}
  <div className="relative">
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-lg"
      aria-label="Select theme"
      onClick={() => setMenuOpen(menuOpen === "theme" ? null : "theme")}
    >
      <PaletteIcon className="size-4" aria-hidden="true" />
    </Button>
    {menuOpen === "theme" && (
      <div className="absolute right-0 top-full z-50 mt-2 min-w-[150px] rounded-lg border border-border bg-popover p-1 shadow-md">
        {themeOptions.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                theme === t.value && "font-medium"
              )}
              onClick={() => { setTheme(t.value); setMenuOpen(null); }}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{t.label}</span>
              {theme === t.value && <CheckIcon className="ml-auto size-3.5" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    )}
  </div>

  {/* Scale picker */}
  <div className="relative">
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-lg"
      aria-label="UI scale"
      onClick={() => setMenuOpen(menuOpen === "scale" ? null : "scale")}
    >
      <ZoomInIcon className="size-4" aria-hidden="true" />
    </Button>
    {menuOpen === "scale" && (
      <div className="absolute right-0 top-full z-50 mt-2 min-w-[150px] rounded-lg border border-border bg-popover p-1 shadow-md">
        <p className="px-2.5 py-1 text-xs font-medium text-muted-foreground">UI Scale</p>
        {scales.map((s) => (
          <button
            key={s.value}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              scale === s.value && "font-medium"
            )}
            onClick={() => { setScale(s.value as typeof scale); setMenuOpen(null); }}
          >
            <span>{s.label}</span>
            {scale === s.value && <CheckIcon className="ml-auto size-3.5" aria-hidden="true" />}
          </button>
        ))}
      </div>
    )}
  </div>

  <div className="w-px h-5 bg-border/60" />

  <button
    onClick={() => signOut()}
    className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
    aria-label="Sign out"
    title="Sign out"
  >
    {session?.user?.name
      ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
      : "??"}
  </button>
</div>
```

- [ ] **Step 4: Update outer nav bar styles**

Change the `<nav>` className from:

```tsx
"sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
```

To:

```tsx
"sticky top-0 z-50 bg-background/85 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/nav.tsx
git commit -m "style: redesign nav with pill tabs, gradient logo, avatar sign-out"
```

---

### Task 4: Dashboard Stats Cards Redesign

**Files:**
- Modify: `src/components/dashboard/stats-cards.tsx`

- [ ] **Step 1: Expand API data to include previous month for change indicators**

Update the `StatsData` interface and `fetchStats` to also query the previous month:

```tsx
interface StatsData {
  invoicesThisMonth: number;
  totalThisMonth: number;
  pendingDrafts: number;
  invoicesLastMonth: number;
  totalLastMonth: number;
}
```

Update `fetchStats`:

```tsx
async function fetchStats() {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const dateFrom = firstOfMonth.toISOString().split("T")[0];
    const dateTo = now.toISOString().split("T")[0];
    const lastMonthFrom = firstOfLastMonth.toISOString().split("T")[0];
    const lastMonthTo = lastOfLastMonth.toISOString().split("T")[0];

    const [monthRes, lastMonthRes, draftsRes] = await Promise.all([
      fetch(`/api/invoices?dateFrom=${dateFrom}&dateTo=${dateTo}&pageSize=1000`),
      fetch(`/api/invoices?dateFrom=${lastMonthFrom}&dateTo=${lastMonthTo}&pageSize=1000`),
      fetch(`/api/invoices?status=DRAFT&pageSize=1000`),
    ]);

    const monthData = await monthRes.json();
    const lastMonthData = await lastMonthRes.json();
    const draftsData = await draftsRes.json();

    const totalThisMonth = (monthData.invoices as { totalAmount: string | number }[]).reduce(
      (sum: number, inv: { totalAmount: string | number }) => sum + Number(inv.totalAmount),
      0
    );
    const totalLastMonth = (lastMonthData.invoices as { totalAmount: string | number }[]).reduce(
      (sum: number, inv: { totalAmount: string | number }) => sum + Number(inv.totalAmount),
      0
    );

    setStats({
      invoicesThisMonth: monthData.total,
      totalThisMonth,
      pendingDrafts: draftsData.total,
      invoicesLastMonth: lastMonthData.total,
      totalLastMonth,
    });
  } catch (err) {
    console.error("Failed to fetch stats:", err);
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 2: Replace card rendering with redesigned cards**

Replace the entire return JSX with the three redesigned cards:

```tsx
const invoiceDelta = (stats?.invoicesThisMonth ?? 0) - (stats?.invoicesLastMonth ?? 0);
const totalPctChange = stats?.totalLastMonth
  ? Math.round(((stats.totalThisMonth - stats.totalLastMonth) / stats.totalLastMonth) * 100)
  : null;

return (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    {/* Invoices This Month */}
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Invoices This Month</p>
          {!loading && invoiceDelta !== 0 && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              invoiceDelta > 0
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400"
            )}>
              {invoiceDelta > 0 ? "+" : ""}{invoiceDelta}
            </span>
          )}
        </div>
        <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
          {loading ? "—" : stats?.invoicesThisMonth ?? 0}
        </p>
        {!loading && (
          <div className="flex items-end gap-[3px] mt-3 h-6">
            {[30, 55, 40, 70, 50, 100].map((h, i, arr) => (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm",
                  i === arr.length - 1 ? "bg-primary" : "bg-primary/15"
                )}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Total This Month */}
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Total This Month</p>
          {!loading && totalPctChange !== null && totalPctChange !== 0 && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              totalPctChange > 0
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400"
            )}>
              {totalPctChange > 0 ? "+" : ""}{totalPctChange}%
            </span>
          )}
        </div>
        <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
          {loading ? "—" : `$${Number(stats?.totalThisMonth ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        {!loading && (
          <div className="mt-3.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
              style={{ width: `${Math.min(100, Math.max(5, ((stats?.totalThisMonth ?? 0) / Math.max(stats?.totalLastMonth ?? 1, 1)) * 50))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>

    {/* Pending Drafts */}
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Pending Drafts</p>
          {!loading && (stats?.pendingDrafts ?? 0) > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              Action needed
            </span>
          )}
        </div>
        <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
          {loading ? "—" : stats?.pendingDrafts ?? 0}
        </p>
        {!loading && (
          <div className="flex gap-1 mt-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i < (stats?.pendingDrafts ?? 0) ? "bg-amber-500" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/stats-cards.tsx
git commit -m "style: redesign stats cards with sparklines, change indicators, progress bar"
```

---

### Task 5: Dashboard Recent Invoices — Avatar Table Rows

**Files:**
- Modify: `src/components/dashboard/recent-invoices.tsx`

- [ ] **Step 1: Create initials helper**

Add a helper function at the top of the file (after imports):

```tsx
function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
```

- [ ] **Step 2: Replace table with avatar-style row list**

Replace the entire return JSX:

```tsx
return (
  <Card>
    <CardHeader className="border-b border-border/50">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-bold">Recent Invoices</CardTitle>
        <Link
          href="/invoices"
          className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          View all →
        </Link>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      {loading ? (
        <p className="text-sm text-muted-foreground p-4">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">No invoices yet</p>
      ) : (
        <div>
          {invoices.map((invoice, i) => (
            <div
              key={invoice.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                i < invoices.length - 1 && "border-b border-border/30"
              )}
              onClick={() => router.push(`/invoices/${invoice.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") router.push(`/invoices/${invoice.id}`); }}
            >
              <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                {getInitials(invoice.staff.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {invoice.invoiceNumber} · {invoice.staff.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {invoice.department} · {new Date(invoice.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold tabular-nums">
                  ${Number(invoice.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <Badge
                  variant={invoice.status === "FINAL" ? "success" : invoice.status === "PENDING_CHARGE" ? "info" : "warning"}
                  className="mt-0.5"
                >
                  {invoice.status === "FINAL" ? "Final" : invoice.status === "PENDING_CHARGE" ? "Pending" : "Draft"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
```

- [ ] **Step 3: Update imports**

Add `Link` import and `cn` utility. Remove `Table` imports (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`) since we're no longer using them:

```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/recent-invoices.tsx
git commit -m "style: redesign recent invoices with avatar rows, status badges, view-all link"
```

---

### Task 6: Dashboard Pending Charges — Polish

**Files:**
- Modify: `src/components/dashboard/pending-charges.tsx`

- [ ] **Step 1: Remove left-accent border, use shadow card**

Change the Card className from:

```tsx
<Card className="border-l-4 border-l-amber-500">
```

To just:

```tsx
<Card>
```

- [ ] **Step 2: Update header to match new pattern**

Replace the CardHeader section:

```tsx
<CardHeader className="pb-2 border-b border-border/50">
  <div className="flex items-center justify-between">
    <CardTitle className="text-sm font-bold">
      Pending POS Charges
    </CardTitle>
    <Badge variant="warning" className="tabular-nums">
      {total}
    </Badge>
  </div>
</CardHeader>
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/pending-charges.tsx
git commit -m "style: polish pending charges card, remove accent border, warning badge"
```

---

### Task 7: Welcome Banner — Polish

**Files:**
- Modify: `src/components/dashboard/welcome-banner.tsx`

- [ ] **Step 1: Remove left-accent border from welcome banner**

Change the Card className from:

```tsx
<Card className="border-l-4 border-l-primary border-border/40 bg-background">
```

To:

```tsx
<Card className="bg-muted/30">
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/welcome-banner.tsx
git commit -m "style: polish welcome banner, remove accent border"
```

---

### Task 8: Invoice Table — Avatar Rows with Status Colors

**Files:**
- Modify: `src/components/invoices/invoice-table.tsx`

- [ ] **Step 1: Add initials helper and cn import**

Add at top of file after imports:

```tsx
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
```

- [ ] **Step 2: Redesign table rows**

Replace the `<TableBody>` contents. Each row changes from 7 separate columns to the avatar-style compact layout. Replace the existing `<TableRow>` for each invoice:

```tsx
<TableRow
  key={invoice.id}
  className="cursor-pointer group"
  onClick={() => router.push(`/invoices/${invoice.id}`)}
  role="link"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/invoices/${invoice.id}`); }}
>
  <TableCell>
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
        {getInitials(invoice.staff.name)}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold truncate">
          <span className="flex items-center gap-1">
            {invoice.invoiceNumber} · {invoice.staff.name}
            {invoice.isRecurring && (
              <span title="Recurring invoice">
                <RefreshCwIcon className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
              </span>
            )}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {invoice.department} · {formatDate(invoice.date)}
          {invoice.category && (
            <> · {invoice.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</>
          )}
        </p>
      </div>
    </div>
  </TableCell>
  <TableCell className="text-right">
    <p className="text-[13px] font-bold tabular-nums">
      {formatAmount(invoice.totalAmount)}
    </p>
    <Badge
      variant={
        invoice.status === "FINAL"
          ? "success"
          : invoice.status === "PENDING_CHARGE"
            ? "info"
            : "warning"
      }
      className="mt-0.5"
    >
      {invoice.status === "FINAL"
        ? "Final"
        : invoice.status === "PENDING_CHARGE"
          ? "Pending Charge"
          : "Draft"}
    </Badge>
  </TableCell>
</TableRow>
```

- [ ] **Step 3: Update table header to match 2-column layout**

Replace the `<TableHeader>` section:

```tsx
<TableHeader>
  <TableRow>
    <TableHead>
      <div className="flex gap-4">
        <button
          className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
          onClick={() => handleSort("invoiceNumber")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("invoiceNumber"); } }}
        >
          Invoice #{sortIndicator("invoiceNumber")}
        </button>
        <button
          className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
          onClick={() => handleSort("date")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("date"); } }}
        >
          Date{sortIndicator("date")}
        </button>
      </div>
    </TableHead>
    <TableHead className="text-right">
      <button
        className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
        onClick={() => handleSort("totalAmount")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("totalAmount"); } }}
      >
        Amount{sortIndicator("totalAmount")}
      </button>
    </TableHead>
  </TableRow>
</TableHeader>
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/invoices/invoice-table.tsx
git commit -m "style: redesign invoice table with avatar rows, compact layout, status colors"
```

---

### Task 9: Quote Table — Avatar Rows

**Files:**
- Modify: `src/components/quotes/quote-table.tsx`

- [ ] **Step 1: Add cn import and initials helper**

```tsx
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
```

- [ ] **Step 2: Update status badge variants**

Replace the `STATUS_BADGE_VARIANT` mapping:

```tsx
const STATUS_BADGE_VARIANT: Record<QuoteStatus, "success" | "info" | "warning" | "destructive" | "outline"> = {
  DRAFT: "warning",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "destructive",
  EXPIRED: "outline",
};
```

- [ ] **Step 3: Redesign table rows to 2-column avatar layout**

Apply the same pattern as the invoice table. Replace `<TableHeader>` and `<TableBody>`:

```tsx
<TableHeader>
  <TableRow>
    <TableHead>
      <div className="flex gap-4">
        <button
          className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
          onClick={() => handleSort("quoteNumber")}
        >
          Quote #{sortIndicator("quoteNumber")}
        </button>
        <button
          className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
          onClick={() => handleSort("date")}
        >
          Date{sortIndicator("date")}
        </button>
        <button
          className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
          onClick={() => handleSort("expirationDate")}
        >
          Expires{sortIndicator("expirationDate")}
        </button>
      </div>
    </TableHead>
    <TableHead className="text-right">
      <button
        className="cursor-pointer select-none text-xs font-medium hover:text-foreground"
        onClick={() => handleSort("totalAmount")}
      >
        Amount{sortIndicator("totalAmount")}
      </button>
    </TableHead>
  </TableRow>
</TableHeader>
<TableBody>
  {quotes.map((quote) => (
    <TableRow
      key={quote.id}
      className="cursor-pointer group"
      onClick={() => router.push(`/quotes/${quote.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/quotes/${quote.id}`); }}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
            {getInitials(quote.recipientName || quote.recipientOrg || "??")}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate">
              {quote.quoteNumber} · {quote.recipientName || quote.recipientOrg || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {quote.department} · {formatDate(quote.date)}
              {quote.expirationDate && (
                <span className={isExpired(quote.expirationDate) ? " text-destructive" : ""}>
                  {" "}· Exp {formatDate(quote.expirationDate)}
                </span>
              )}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <p className="text-[13px] font-bold tabular-nums">
          {formatAmount(quote.totalAmount)}
        </p>
        <Badge variant={STATUS_BADGE_VARIANT[quote.status]} className="mt-0.5">
          {STATUS_LABEL[quote.status]}
        </Badge>
      </TableCell>
    </TableRow>
  ))}
</TableBody>
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/quote-table.tsx
git commit -m "style: redesign quote table with avatar rows, status colors"
```

---

### Task 10: Invoice Detail Page — Header + Info Grid Polish

**Files:**
- Modify: `src/components/invoices/invoice-detail.tsx`

- [ ] **Step 1: Update status badge variants in detail view**

Replace all badge variant logic. Find every `variant={isFinal ? "default" : isPendingCharge ? "secondary" : "outline"}` and replace with:

```tsx
variant={isFinal ? "success" : isPendingCharge ? "info" : "warning"}
```

- [ ] **Step 2: Update detail info rows to use 11px labels**

In the Invoice Information card, change all label spans from:

```tsx
<span className="text-muted-foreground">Date</span>
```

To:

```tsx
<span className="text-[11px] font-medium text-muted-foreground">Date</span>
```

And all value spans to include `text-[13px] font-semibold` where appropriate (e.g., for the name, total).

Apply same pattern to all `<div className="flex justify-between text-sm">` rows in both Invoice Information and Staff Member cards.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-detail.tsx
git commit -m "style: polish invoice detail with status colors, tighter typography"
```

---

### Task 11: Login Page — Gradient Button

**Files:**
- Modify: `src/components/login-form.tsx`

- [ ] **Step 1: Update submit button to gradient red**

Change the Button className:

```tsx
<Button
  type="submit"
  className="w-full h-11 font-semibold uppercase tracking-wide bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white"
  disabled={loading}
>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/login-form.tsx
git commit -m "style: gradient red login button"
```

---

### Task 12: Dashboard Page — Polish Action Buttons

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the New Invoice button with gradient**

Change the New Invoice link className:

```tsx
<Link
  href="/invoices/new"
  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-3 text-sm font-semibold text-white transition-colors hover:from-red-700 hover:to-red-900"
>
  <Plus className="h-4 w-4" aria-hidden="true" />
  New Invoice
</Link>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "style: gradient red new invoice button on dashboard"
```

---

### Task 13: Global CSS — Typography Tightening

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update keyboard-mode section label styles**

Change the `.keyboard-mode .section-label` styles from uppercase to normal-case matching the new design:

```css
.keyboard-mode .section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--muted-foreground);
  padding: 0.25rem 0;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update keyboard-mode section labels to match new typography"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Visual check**

Start dev server (`npm run dev`) and manually verify:
- Dashboard: shadow cards, sparklines, avatar rows, pill nav
- Invoice list: avatar rows, status colors
- Quote list: avatar rows, status colors
- Invoice detail: polished badges, tighter type
- Login page: gradient button
- Dark mode: cards use border instead of shadow
- All theme variants (light, dark, Catppuccin)
