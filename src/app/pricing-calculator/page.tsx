import { PricingCalculator } from "@/components/pricing/pricing-calculator";
import { printPricingService } from "@/domains/print-pricing/service";

export const dynamic = "force-dynamic";

export default async function PricingCalculatorPage() {
  const pricing = await printPricingService.getPricingSnapshot();

  return <PricingCalculator pricing={pricing} />;
}
