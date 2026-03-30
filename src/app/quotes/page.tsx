import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { staffService } from "@/domains/staff/service";
import { prisma } from "@/lib/prisma";
import { QuoteTable } from "@/components/quotes/quote-table";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Button className="w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto" render={<Link href="/quotes/new" />}>
          New Quote
        </Button>
      </div>
      <QuoteTable departments={departments} categories={categories} />
    </div>
  );
}
