import Link from "next/link";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link
          href="/invoices/new"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all"
        >
          New Invoice
        </Link>
      </div>
      <StatsCards />
      <RecentInvoices />
    </div>
  );
}
