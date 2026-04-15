"use client";

import { useQuoteForm } from "@/components/quote/quote-form";
import { QuoteMode } from "@/components/quote/quote-mode";

export default function NewQuotePage() {
  const quoteForm = useQuoteForm();
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="page-enter page-enter-1 mb-7">
        <h1 className="text-3xl font-bold tracking-tight">New Quote</h1>
        <p className="mt-1 text-sm text-muted-foreground">Prepare a quote for your recipient</p>
      </div>
      <div className="page-enter page-enter-2">
        <QuoteMode {...quoteForm} />
      </div>
    </div>
  );
}
