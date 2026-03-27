import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { UserActivityStrip } from "@/components/invoices/user-activity-strip";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [staffList, categories] = await Promise.all([
    prisma.staff.findMany({
      where: { active: true },
      select: { department: true },
      distinct: ["department"],
      orderBy: { department: "asc" },
    }),
    prisma.category.findMany({
      where: { active: true },
      select: { name: true, label: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const departments = staffList.map((s) => s.department).filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-balance">Invoices</h1>
      <UserActivityStrip />
      <InvoiceTable departments={departments} categories={categories} />
    </div>
  );
}
