import { PaymentDetailsForm } from "@/components/quotes/payment-details-form";

export default async function PaymentPage(
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;
  return <PaymentDetailsForm token={token} />;
}
