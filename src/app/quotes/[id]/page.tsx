import { QuoteDetailView } from "@/components/quotes/quote-detail";

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  return <QuoteDetailView id={params.id} />;
}
