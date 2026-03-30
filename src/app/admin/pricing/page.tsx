import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { PricingAdminPanel } from "@/components/pricing/pricing-admin-panel";
import { printPricingService } from "@/domains/print-pricing/service";
import { authOptions } from "@/lib/auth";

export default async function AdminPricingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as { role?: string }).role;

  if (role !== "admin") {
    redirect("/");
  }

  const pricing = await printPricingService.getPricingSnapshot();

  return <PricingAdminPanel initialPricing={pricing} />;
}
