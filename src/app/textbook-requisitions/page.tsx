import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RequisitionStats } from "@/components/textbook-requisitions/requisition-stats";
import { RequisitionTable } from "@/components/textbook-requisitions/requisition-table";

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Textbook Requisitions</h1>
      <RequisitionStats />
      <RequisitionTable />
    </main>
  );
}
