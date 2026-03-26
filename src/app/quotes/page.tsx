import Link from "next/link";
import { QuoteTable } from "@/components/quotes/quote-table";
import { Button } from "@/components/ui/button";

export default function QuotesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link href="/quotes/new">
          <Button>New Quote</Button>
        </Link>
      </div>
      <QuoteTable />
    </div>
  );
}
