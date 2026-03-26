import Link from "next/link";
import { Plus } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner />
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Link
          href="/invoices/new"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </Link>
      </div>
      <StatsCards />
      <RecentInvoices />
    </div>
  );
}
