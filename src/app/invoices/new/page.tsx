"use client";

import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

export default function NewInvoicePage() {
  const invoiceForm = useInvoiceForm();

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-semibold sm:mb-6">New Invoice</h1>
      <KeyboardMode {...invoiceForm} />
    </div>
  );
}
