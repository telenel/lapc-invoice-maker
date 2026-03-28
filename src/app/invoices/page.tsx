import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffService } from "@/domains/staff/service";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { UserActivityStrip } from "@/components/invoices/user-activity-strip";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [staffList, categories] = await Promise.all([
    staffService.list({}),
    prisma.category.findMany({
      where: { active: true },
      select: { name: true, label: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const departments = Array.from(
    new Set(staffList.map((s) => s.department).filter(Boolean) as string[])
  ).sort();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-balance">Invoices</h1>
      <UserActivityStrip />
      <InvoiceTable departments={departments} categories={categories} />
    </div>
  );
}
