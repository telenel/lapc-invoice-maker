import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { QuickPickTable } from "@/components/quick-picks/quick-pick-table";
import { authOptions } from "@/lib/auth";

export default async function QuickPicksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <QuickPickTable />;
}
