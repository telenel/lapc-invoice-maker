import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PrismAction {
  href: string;
  title: string;
  description: string;
  category: "agency" | "item" | "report";
  status: "live" | "coming-soon";
}

const PRISM_ACTIONS: PrismAction[] = [
  {
    href: "/admin/agencies/new",
    title: "Add a single account",
    description:
      "Create one Acct_Agency: mirror an existing template, or build from scratch with full parameter control.",
    category: "agency",
    status: "live",
  },
  {
    href: "/admin/agencies",
    title: "Roll a semester forward",
    description:
      "Bulk-clone every PWI25 / PSP25 / PSU25 / PFA25 account into the next semester. Replaces the manual WPAdmin re-entry.",
    category: "agency",
    status: "live",
  },
  {
    href: "/products",
    title: "Add an item (existing)",
    description:
      "Create a General Merchandise item via the Products page — already shipped. Listed here so all Prism writes have one home.",
    category: "item",
    status: "live",
  },
];

const CATEGORY_LABEL: Record<PrismAction["category"], string> = {
  agency: "AR Accounts",
  item: "Catalog",
  report: "Reports",
};

export default async function AdminPrismHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "admin") redirect("/");

  // Group by category, preserving the listed order within each category.
  const grouped = PRISM_ACTIONS.reduce<Record<string, PrismAction[]>>(
    (acc, action) => {
      (acc[action.category] ??= []).push(action);
      return acc;
    },
    {},
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Prism actions</h1>
        <p className="text-muted-foreground text-sm">
          Pierce-side hub for laportal-driven WinPRISM operations. Every action
          here writes to the live Prism database; do the very first run of any
          new flow on a one-off test code with snapshot/diff capture.
        </p>
      </div>

      {Object.entries(grouped).map(([category, actions]) => (
        <section key={category} className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {CATEGORY_LABEL[category as PrismAction["category"]]}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group block focus:outline-none"
              >
                <Card className="hover:border-primary/40 hover:bg-muted/30 h-full transition-colors group-focus-visible:border-ring group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <CardTitle className="text-base">{action.title}</CardTitle>
                    {action.status === "coming-soon" && (
                      <Badge variant="secondary" className="text-[0.65rem]">
                        Coming soon
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    {action.description}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="text-muted-foreground border-t pt-4 text-xs">
        Prism is on the campus intranet. These pages return 503 if Prism is not
        reachable — connect to LACCD VPN or the SSH tunnel bridge to use them.
      </div>
    </div>
  );
}
