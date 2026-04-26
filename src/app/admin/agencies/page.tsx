import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyRollSemester } from "@/components/admin/agency-roll-semester";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <AgencyRollSemester />;
}
