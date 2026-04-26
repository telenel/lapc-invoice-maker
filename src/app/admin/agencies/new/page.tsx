import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyCreate } from "@/components/admin/agency-create";

export const dynamic = "force-dynamic";

export default async function AdminAgencyCreatePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <AgencyCreate />;
}
