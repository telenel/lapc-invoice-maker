import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { QuickPickSectionsPanel } from "@/components/admin/quick-pick-sections-panel";
import { authOptions } from "@/lib/auth";

type AdminQuickPicksPageProps = {
  searchParams?: {
    skus?: string | string[];
  };
};

function parseSelectedSkus(value: string | string[] | undefined): number[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const parsed = new Set<number>();

  for (const rawValue of values) {
    for (const part of rawValue.split(",")) {
      const sku = Number(part.trim());
      if (Number.isFinite(sku) && sku > 0) {
        parsed.add(sku);
      }
    }
  }

  return Array.from(parsed).sort((left, right) => left - right);
}

export default async function AdminQuickPicksPage({ searchParams }: AdminQuickPicksPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return <QuickPickSectionsPanel initialExplicitSkus={parseSelectedSkus(searchParams?.skus)} />;
}
