"use client";

import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

export default function NewInvoicePage() {
  const invoiceForm = useInvoiceForm();

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-4 sm:py-8">
      <div className="page-enter page-enter-1 mb-5 sm:mb-7">
        <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the details below to create an invoice</p>
      </div>
      <div className="page-enter page-enter-2">
        <KeyboardMode {...invoiceForm} />
      </div>
    </div>
  );
}
