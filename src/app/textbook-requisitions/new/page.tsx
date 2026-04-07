import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RequisitionCreateView } from "@/components/textbook-requisitions/requisition-create-view";

export default async function RequisitionNewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <RequisitionCreateView />
    </main>
  );
}
