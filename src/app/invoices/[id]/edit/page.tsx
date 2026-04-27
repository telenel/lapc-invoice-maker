"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useInvoiceForm, InvoiceFormData } from "@/components/invoice/invoice-form";
import { DocumentComposer } from "@/components/composer/document-composer";
import type { ComposerStatus } from "@/components/composer/types";
import { TAX_RATE } from "@/domains/invoice/constants";

interface ApiInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: string | number;
  extendedPrice: string | number;
  sortOrder: number;
  isTaxable?: boolean;
  marginOverride?: number | null;
  costPrice?: string | number | null;
  sku?: string | null;
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
  notes: string | null;
  status: string;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  pdfMetadata?: {
    signatures?: { line1?: string; line2?: string; line3?: string };
    signatureStaffIds?: { line1?: string; line2?: string; line3?: string };
    semesterYearDept?: string;
    contactName?: string;
    contactExtension?: string;
    internalNotes?: string;
  } | null;
  prismcorePath: string | null;
  isRunning: boolean;
  runningTitle: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  viewerAccess?: {
    canManageActions: boolean;
  };
  staff: { id: string; name: string; title: string; department: string; extension: string; email: string } | null;
  items: ApiInvoiceItem[];
}

function mapApiToFormData(invoice: ApiInvoice): InvoiceFormData {
  return {
    invoiceNumber: invoice.invoiceNumber ?? "",
    date: invoice.date ? invoice.date.split("T")[0] : "",
    staffId: invoice.staffId ?? "",
    department: invoice.department ?? "",
    category: invoice.category ?? "",
    accountCode: invoice.accountCode ?? "",
    accountNumber: invoice.accountNumber ?? "",
    approvalChain: invoice.approvalChain ?? [],
    contactName: invoice.pdfMetadata?.contactName || invoice.staff?.name || "",
    contactExtension: invoice.pdfMetadata?.contactExtension || invoice.staff?.extension || "",
    contactEmail: invoice.staff?.email || "",
    contactPhone: "",
    semesterYearDept: invoice.pdfMetadata?.semesterYearDept ?? "",
    notes: invoice.notes ?? "",
    internalNotes: invoice.pdfMetadata?.internalNotes ?? "",
    isRunning: invoice.isRunning,
    runningTitle: invoice.runningTitle ?? "",
    marginEnabled: invoice.marginEnabled ?? false,
    marginPercent: invoice.marginPercent ?? 0,
    taxEnabled: invoice.taxEnabled ?? false,
    taxRate: invoice.taxRate ?? TAX_RATE,
    isRecurring: invoice.isRecurring ?? false,
    recurringInterval: invoice.recurringInterval ?? "",
    recurringEmail: invoice.recurringEmail ?? "",
    prismcorePath: invoice.prismcorePath ?? null,
    signatures: {
      line1: invoice.pdfMetadata?.signatures?.line1 ?? "",
      line2: invoice.pdfMetadata?.signatures?.line2 ?? "",
      line3: invoice.pdfMetadata?.signatures?.line3 ?? "",
    },
    signatureStaffIds: {
      line1: invoice.pdfMetadata?.signatureStaffIds?.line1 ?? "",
      line2: invoice.pdfMetadata?.signatureStaffIds?.line2 ?? "",
      line3: invoice.pdfMetadata?.signatureStaffIds?.line3 ?? "",
    },
    items: invoice.items.map((item) => {
      const dbUnitPrice = Number(item.unitPrice);
      const dbCostPrice = item.costPrice != null ? Number(item.costPrice) : null;
      // When costPrice exists, the DB unitPrice is the marked-up charged price.
      // The form's unitPrice is the editable cost; itemsWithMargin re-derives the charged display.
      const formUnitPrice = dbCostPrice ?? dbUnitPrice;
      return {
        _key: crypto.randomUUID(),
        sku: item.sku ?? null,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: formUnitPrice,
        extendedPrice: Number(item.quantity) * formUnitPrice,
        sortOrder: item.sortOrder,
        isTaxable: item.isTaxable ?? true,
        marginOverride: item.marginOverride ?? null,
        costPrice: dbCostPrice,
      };
    }),
  };
}

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const [initialData, setInitialData] = useState<InvoiceFormData | null>(null);
  const [status, setStatus] = useState<ComposerStatus>("DRAFT");
  const [canManageActions, setCanManageActions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
        if (invoice.viewerAccess?.canManageActions === false) {
          throw new Error("You can't edit an invoice created by another user. Open the invoice detail page and use Duplicate to make your own editable copy.");
        }
        if (invoice.status === "FINAL") {
          throw new Error("Finalized invoices cannot be edited");
        }
        setInitialData(mapApiToFormData(invoice));
        setStatus(invoice.status as ComposerStatus);
        setCanManageActions(invoice.viewerAccess?.canManageActions ?? true);
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
      <div className="mx-auto max-w-7xl px-0 py-4 sm:px-4 sm:py-8" aria-busy="true">
        <div className="mb-6 space-y-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {[0, 1, 2].map((section) => (
              <div key={section} className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                <div className="skeleton h-4 w-32" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="skeleton h-9 w-full" />
                  <div className="skeleton h-9 w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
            <div className="skeleton h-5 w-36" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="skeleton h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-5xl px-0 py-4 sm:px-4 sm:py-8">
        <p className="text-destructive">{fetchError}</p>
      </div>
    );
  }

  return (
    <DocumentComposer
      composer={{ docType: "invoice", form: invoiceForm }}
      mode="edit"
      status={status}
      canManageActions={canManageActions}
      documentNumber={invoiceForm.form.invoiceNumber}
    />
  );
}
