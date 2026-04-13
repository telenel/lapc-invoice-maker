import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { QuickPickTable } from "@/components/quick-picks/quick-pick-table";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function QuickPicksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  const initialItems = await prisma.quickPickItem.findMany({
    orderBy: { usageCount: "desc" },
  });

  return (
    <QuickPickTable
      initialItems={initialItems.map((item) => ({
        ...item,
        defaultPrice: Number(item.defaultPrice),
      }))}
    />
  );
}
