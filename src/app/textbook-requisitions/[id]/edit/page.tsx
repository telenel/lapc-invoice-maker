import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RequisitionEditView } from "@/components/textbook-requisitions/requisition-edit-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequisitionEditPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <RequisitionEditView id={id} />
    </main>
  );
}
