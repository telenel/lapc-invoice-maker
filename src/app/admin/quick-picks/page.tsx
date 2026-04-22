import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { QuickPickSectionsPanel } from "@/components/admin/quick-pick-sections-panel";
import { authOptions } from "@/lib/auth";

export default async function AdminQuickPicksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <QuickPickSectionsPanel />;
}
