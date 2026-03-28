"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useInvoiceForm, InvoiceFormData } from "@/components/invoice/invoice-form";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

interface ApiInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: string | number;
  extendedPrice: string | number;
  sortOrder: number;
  isTaxable?: boolean;
  marginOverride?: number | null;
  costPrice?: string | number | null;
}

interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  staffId: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  contactName: string | null;
  contactExtension: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  semesterYearDept: string | null;
  notes: string | null;
  status: string;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  prismcorePath: string | null;
  isRunning: boolean;
  runningTitle: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  signatures: { line1: string; line2: string; line3: string } | null;
  staff: { id: string; name: string; title: string; department: string; extension: string; email: string } | null;
  items: ApiInvoiceItem[];
}

function mapApiToFormData(invoice: ApiInvoice): InvoiceFormData {
  return {
    invoiceNumber: invoice.invoiceNumber ?? "",
    // date comes as ISO string like "2024-01-15T00:00:00.000Z"; take the date part
    date: invoice.date ? invoice.date.split("T")[0] : "",
    staffId: invoice.staffId ?? "",
    department: invoice.department ?? "",
    category: invoice.category ?? "",
    accountCode: invoice.accountCode ?? "",
    accountNumber: invoice.accountNumber ?? "",
    approvalChain: invoice.approvalChain ?? [],
    contactName: invoice.contactName || invoice.staff?.name || "",
    contactExtension: invoice.contactExtension || invoice.staff?.extension || "",
    contactEmail: invoice.contactEmail || invoice.staff?.email || "",
    contactPhone: invoice.contactPhone ?? "",
    semesterYearDept: invoice.semesterYearDept ?? "",
    notes: invoice.notes ?? "",
    isRunning: invoice.isRunning ?? false,
    runningTitle: invoice.runningTitle ?? "",
    marginEnabled: invoice.marginEnabled ?? false,
    marginPercent: invoice.marginPercent ?? 0,
    taxEnabled: invoice.taxEnabled ?? false,
    isRecurring: invoice.isRecurring ?? false,
    recurringInterval: invoice.recurringInterval ?? "",
    recurringEmail: invoice.recurringEmail ?? "",
    prismcorePath: invoice.prismcorePath ?? null,
    signatures: invoice.signatures ?? { line1: "", line2: "", line3: "" },
    signatureStaffIds: { line1: "", line2: "", line3: "" },
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      extendedPrice: Number(item.extendedPrice),
      sortOrder: item.sortOrder,
      isTaxable: item.isTaxable ?? true,
      marginOverride: item.marginOverride ?? null,
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    })),
  };
}

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const [initialData, setInitialData] = useState<InvoiceFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPendingCharge, setIsPendingCharge] = useState(false);

  // Fetch existing invoice data
  useEffect(() => {
    if (!invoiceId) return;

    setLoading(true);
    setFetchError(null);

    fetch(`/api/invoices/${invoiceId}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data?.error ?? "Failed to load invoice");
          });
        }
        return res.json();
      })
      .then((invoice: ApiInvoice) => {
        setInitialData(mapApiToFormData(invoice));
        setIsPendingCharge(invoice.status === "PENDING_CHARGE");
      })
      .catch((err: unknown) => {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load invoice"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [invoiceId]);

  const invoiceForm = useInvoiceForm(initialData ?? undefined, invoiceId);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <p className="text-muted-foreground">Loading invoice…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <p className="text-destructive">{fetchError}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-6">
        {isPendingCharge ? "Complete POS Charge" : "Edit Invoice"}
      </h1>
      <KeyboardMode {...invoiceForm} isPendingCharge={isPendingCharge} />
    </div>
  );
}
