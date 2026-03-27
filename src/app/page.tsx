import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PendingCharges } from "@/components/dashboard/pending-charges";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { OnboardingWrapper } from "@/components/dashboard/onboarding-wrapper";
import { TeamActivity } from "@/components/dashboard/team-activity";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <OnboardingWrapper />
      <WelcomeBanner />
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/quotes/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            New Quote
          </Link>
          <Link
            href="/invoices/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-3 text-sm font-semibold text-white transition-colors hover:from-red-700 hover:to-red-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Invoice
          </Link>
        </div>
      </div>
      <StatsCards />
      <PendingCharges />
      <RecentInvoices />
      <TeamActivity />
    </div>
  );
}
