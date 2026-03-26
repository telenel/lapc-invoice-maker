"use client";

import { useQuoteForm } from "@/components/quote/quote-form";
import { QuoteMode } from "@/components/quote/quote-mode";

export default function NewQuotePage() {
  const quoteForm = useQuoteForm();
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-6">New Quote</h1>
      <QuoteMode {...quoteForm} />
    </div>
  );
}
