"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuoteForm, QuoteFormData } from "@/components/quote/quote-form";
import { QuoteMode } from "@/components/quote/quote-mode";
import { LazyProductSearchPanel } from "@/components/shared/lazy-product-search-panel";
import type { SelectedProduct } from "@/domains/product/types";
import { getDateKeyInLosAngeles } from "@/lib/date-utils";
import { formatDateLong as formatDate } from "@/lib/formatters";

interface ApiQuoteItem {
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

interface ApiCateringDetails {
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  headcount?: number;
  eventName?: string;
  setupRequired: boolean;
  setupTime?: string;
  setupInstructions?: string;
  takedownRequired: boolean;
  takedownTime?: string;
  takedownInstructions?: string;
  specialInstructions?: string;
}

interface ApiQuote {
  id: string;
  date: string;
  staffId: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  notes: string | null;
  expirationDate: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientOrg: string | null;
  quoteStatus: string;
  viewerAccess?: {
    canManageActions: boolean;
  };
  convertedToInvoice?: {
    id: string;
    invoiceNumber: string | null;
  } | null;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  isCateringEvent?: boolean;
  cateringDetails?: ApiCateringDetails | null;
  items: ApiQuoteItem[];
}

function mapApiToFormData(quote: ApiQuote): QuoteFormData {
  return {
    date: quote.date ? quote.date.split("T")[0] : "",
    staffId: quote.staffId ?? "",
    department: quote.department ?? "",
    category: quote.category ?? "",
    accountCode: quote.accountCode ?? "",
    accountNumber: quote.accountNumber ?? "",
    approvalChain: quote.approvalChain ?? [],
    contactName: "",
    contactExtension: "",
    contactEmail: "",
    contactPhone: "",
    notes: quote.notes ?? "",
    expirationDate: quote.expirationDate ? quote.expirationDate.split("T")[0] : "",
    recipientName: quote.recipientName ?? "",
    recipientEmail: quote.recipientEmail ?? "",
    recipientOrg: quote.recipientOrg ?? "",
    marginEnabled: quote.marginEnabled ?? false,
    marginPercent: quote.marginPercent ?? 0,
    taxEnabled: quote.taxEnabled ?? false,
    taxRate: quote.taxRate ?? 0.0975,
    isCateringEvent: quote.isCateringEvent ?? false,
    cateringDetails: quote.cateringDetails
      ? {
          eventDate: quote.cateringDetails.eventDate,
          startTime: quote.cateringDetails.startTime,
          endTime: quote.cateringDetails.endTime,
          location: quote.cateringDetails.location,
          contactName: quote.cateringDetails.contactName,
          contactPhone: quote.cateringDetails.contactPhone,
          contactEmail: quote.cateringDetails.contactEmail ?? "",
          headcount: quote.cateringDetails.headcount,
          eventName: quote.cateringDetails.eventName ?? "",
          setupRequired: quote.cateringDetails.setupRequired,
          setupTime: quote.cateringDetails.setupTime ?? "",
          setupInstructions: quote.cateringDetails.setupInstructions ?? "",
          takedownRequired: quote.cateringDetails.takedownRequired,
          takedownTime: quote.cateringDetails.takedownTime ?? "",
          takedownInstructions: quote.cateringDetails.takedownInstructions ?? "",
          specialInstructions: quote.cateringDetails.specialInstructions ?? "",
        }
      : {
          eventDate: getDateKeyInLosAngeles(),
          startTime: "",
          endTime: "",
          location: "",
          contactName: "",
          contactPhone: "",
          contactEmail: "",
          headcount: undefined,
          eventName: "",
          setupRequired: false,
          setupTime: "",
          setupInstructions: "",
          takedownRequired: false,
          takedownTime: "",
          takedownInstructions: "",
          specialInstructions: "",
        },
    items: quote.items.map((item) => {
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

export default function EditQuotePage() {
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const [initialData, setInitialData] = useState<QuoteFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId) return;

    setLoading(true);
    setFetchError(null);

    fetch(`/api/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data?.error ?? "Failed to load quote");
          });
        }
        return res.json();
      })
      .then((quote: ApiQuote) => {
        if (quote.viewerAccess?.canManageActions === false) {
          throw new Error("You can't edit a quote created by another user. Open the quote detail page, choose More, and use Duplicate to make your own editable copy.");
        }
        if (
          quote.quoteStatus === "DECLINED" ||
          quote.quoteStatus === "EXPIRED" ||
          quote.quoteStatus === "REVISED" ||
          quote.convertedToInvoice
        ) {
          throw new Error("This quote cannot be edited");
        }
        setInitialData(mapApiToFormData(quote));
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Failed to load quote");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [quoteId]);

  const quoteForm = useQuoteForm(initialData ?? undefined, quoteId);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-0 py-4 sm:px-4 sm:py-8" aria-busy="true">
        <div className="mb-6 space-y-2">
          <div className="skeleton h-8 w-44" />
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
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <p className="text-destructive">{fetchError}</p>
      </div>
    );
  }

  async function handlePrintForRegister() {
    const { form, itemsWithMargin } = quoteForm;
    if (form.items.length === 0) return;
    const displayItems = form.marginEnabled ? itemsWithMargin : form.items;
    const subtotal = displayItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxRate = form.taxEnabled ? Number(form.taxRate) : 0;
    const taxableTotal = displayItems
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxAmount = taxableTotal * taxRate;

    let openRegisterPrintWindow: typeof import("@/components/shared/register-print-view")["openRegisterPrintWindow"];
    try {
      ({ openRegisterPrintWindow } = await import("@/components/shared/register-print-view"));
    } catch (error) {
      console.error("Failed to load register print view", error);
      window.alert("Could not load the print view. Please try again.");
      return;
    }
    openRegisterPrintWindow({
      documentNumber: "Draft Quote",
      documentType: "Quote",
      status: "DRAFT",
      date: form.date ? formatDate(form.date) : "—",
      staffName: form.contactName || "—",
      department: form.department || "—",
      items: form.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.extendedPrice,
        sku: item.sku ?? null,
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    });
  }

  function mapProductsToItems(products: SelectedProduct[]) {
    return products
      .filter((p): p is SelectedProduct & { retailPrice: number } => p.retailPrice != null)
      .map((p) => ({
      sku: String(p.sku),
      description: p.description.toUpperCase(),
      unitPrice: p.retailPrice,
      costPrice: p.cost,
      quantity: 1,
      isTaxable: true,
      }));
  }

  return (
    <div className="mx-auto max-w-7xl px-0 py-4 sm:px-4 sm:py-8">
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Edit Quote</h1>
        {quoteForm.form.items.length > 0 && (
          <Button variant="outline" size="sm" onClick={handlePrintForRegister}>
            <PrinterIcon className="size-3.5 mr-1.5" />
            Print for Register
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="order-2 lg:order-1">
          <QuoteMode {...quoteForm} />
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-8">
          <LazyProductSearchPanel onAddProducts={(products) => quoteForm.addItems(mapProductsToItems(products))} />
        </div>
      </div>
    </div>
  );
}
