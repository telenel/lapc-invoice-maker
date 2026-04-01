import { PaymentDetailsForm } from "@/components/quotes/payment-details-form";
import { isPublicPaymentLinkAvailable, quoteService } from "@/domains/quote/service";

export default async function PaymentPage(
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;
  const quote = await quoteService.getByShareToken(token);

  return (
    <PaymentDetailsForm
      token={token}
      initialQuote={
        quote
          ? {
              quoteStatus: quote.quoteStatus,
              paymentDetailsResolved: quote.paymentDetailsResolved,
              paymentLinkAvailable: isPublicPaymentLinkAvailable(quote),
              quoteNumber: quote.quoteNumber,
            }
          : null
      }
    />
  );
}
