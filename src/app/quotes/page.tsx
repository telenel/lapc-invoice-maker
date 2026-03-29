import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { staffService } from "@/domains/staff/service";
import { prisma } from "@/lib/prisma";
import { QuoteTable } from "@/components/quotes/quote-table";
import { redirect } from "next/navigation";

export default async function QuotesPage() {
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

  const departmentSet = new Set(staffList.map((s) => s.department).filter(Boolean) as string[]);
  const departments = Array.from(departmentSet).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link href="/quotes/new" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white h-9 px-4 py-2">
          New Quote
        </Link>
      </div>
      <QuoteTable departments={departments} categories={categories} />
    </div>
  );
}
