import { QuoteTable } from "@/components/quotes/quote-table";

export default function QuotesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
      </div>
      <QuoteTable />
    </div>
  );
}
