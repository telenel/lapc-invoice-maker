"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoiceForm, InvoiceFormData } from "@/components/invoice/invoice-form";
import { WizardMode } from "@/components/invoice/wizard-mode";
import { QuickMode } from "@/components/invoice/quick-mode";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

type Mode = "keyboard" | "wizard" | "quick";

const STORAGE_KEY = "lapc-invoice-mode";

interface ApiInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: string | number;
  extendedPrice: string | number;
  sortOrder: number;
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
  prismcorePath: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  signatures: { line1: string; line2: string; line3: string } | null;
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
    contactName: invoice.contactName ?? "",
    contactExtension: invoice.contactExtension ?? "",
    contactEmail: invoice.contactEmail ?? "",
    contactPhone: invoice.contactPhone ?? "",
    semesterYearDept: invoice.semesterYearDept ?? "",
    notes: invoice.notes ?? "",
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
    })),
  };
}

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const [mode, setMode] = useState<Mode>("keyboard");
  const [initialData, setInitialData] = useState<InvoiceFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Hydrate mode preference from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "keyboard" || stored === "wizard" || stored === "quick") {
      setMode(stored);
    }
  }, []);

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

  function handleModeChange(value: Mode) {
    setMode(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

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
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-balance">Edit Invoice</h1>
        <Tabs
          value={mode}
          onValueChange={(value) => handleModeChange(value as Mode)}
        >
          <TabsList>
            <TabsTrigger value="keyboard">Keyboard</TabsTrigger>
            <TabsTrigger value="wizard">Wizard</TabsTrigger>
            <TabsTrigger value="quick">Quick</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="text-xs text-muted-foreground mb-6 text-right">
        {mode === "keyboard" && "Tab through fields to create invoices fast."}
        {mode === "wizard" && "Step-by-step guided flow."}
        {mode === "quick" && "Everything visible at once."}
      </p>

      {/* Mode content */}
      {mode === "keyboard" && <KeyboardMode {...invoiceForm} />}
      {mode === "wizard" && <WizardMode {...invoiceForm} />}
      {mode === "quick" && <QuickMode {...invoiceForm} />}
    </div>
  );
}
