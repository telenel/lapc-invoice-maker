import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { RequisitionStats } from "@/components/textbook-requisitions/requisition-stats";
import { RequisitionTable } from "@/components/textbook-requisitions/requisition-table";

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const createdBy =
    (session.user as { role?: string; id?: string }).role === "admin"
      ? undefined
      : (session.user as { id?: string }).id;
  const initialFilters = {
    page: 1,
    pageSize: 20,
    sortBy: "submittedAt",
    sortOrder: "desc" as const,
    createdBy,
  };
  const [initialStats, initialData, initialYears] = await Promise.all([
    requisitionService.getStats(),
    requisitionService.list(initialFilters),
    requisitionService.getDistinctYears(),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight page-enter page-enter-1">Textbook Requisitions</h1>
      <div className="page-enter page-enter-2"><RequisitionStats initialData={initialStats} /></div>
      <div className="page-enter page-enter-3"><RequisitionTable initialData={initialData} initialFilters={initialFilters} initialYears={initialYears} /></div>
    </main>
  );
}
