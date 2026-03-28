import { PublicQuoteView } from "@/components/quotes/public-quote-view";

export default async function QuoteReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicQuoteView token={token} />;
}
