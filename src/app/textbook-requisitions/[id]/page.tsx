import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RequisitionDetail } from "@/components/textbook-requisitions/requisition-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequisitionDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <RequisitionDetail id={id} />
    </main>
  );
}
