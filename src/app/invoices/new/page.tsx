"use client";

import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

export default function NewInvoicePage() {
  const invoiceForm = useInvoiceForm();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-6">New Invoice</h1>
      <KeyboardMode {...invoiceForm} />
    </div>
  );
}
