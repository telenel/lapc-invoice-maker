import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteTable } from "@/components/quotes/quote-table";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function QuotesPage() {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link href="/quotes/new">
          <Button>New Quote</Button>
        </Link>
      </div>
      <QuoteTable departments={departments} categories={categories} />
    </div>
  );
}
