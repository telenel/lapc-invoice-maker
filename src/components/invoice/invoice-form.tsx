"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

export interface InvoiceFormData {
  // Core fields
  invoiceNumber: string;
  date: string;
  staffId: string;
  department: string;
  accountCode: string;
  approvalChain: string[];
  // Contact / display fields (autofilled from staff, editable)
  contactName: string;
  contactExtension: string;
  contactEmail: string;
  contactPhone: string;
  // Additional fields
  semesterYearDept: string;
  notes: string;
  // Line items
  items: InvoiceItem[];
  // Finalization
  prismcorePath: string | null;
  signatures: {
    line1: string;
    line2: string;
    line3: string;
  };
}

interface StaffMember {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function emptyItem(sortOrder = 0): InvoiceItem {
  return {
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder,
  };
}

function defaultForm(): InvoiceFormData {
  return {
    invoiceNumber: "",
    date: todayISO(),
    staffId: "",
    department: "",
    accountCode: "",
    approvalChain: [],
    contactName: "",
    contactExtension: "",
    contactEmail: "",
    contactPhone: "",
    semesterYearDept: "",
    notes: "",
    items: [emptyItem(0)],
    prismcorePath: null,
    signatures: { line1: "", line2: "", line3: "" },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInvoiceForm(initial?: Partial<InvoiceFormData>) {
  const router = useRouter();

  const [form, setForm] = useState<InvoiceFormData>(() => ({
    ...defaultForm(),
    ...initial,
  }));

  const [saving, setSaving] = useState(false);

  // ---------- Field update helpers ----------

  const updateField = useCallback(
    <K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateItem = useCallback(
    (index: number, patch: Partial<InvoiceItem>) => {
      setForm((prev) => {
        const items = prev.items.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, ...patch };
          updated.extendedPrice = updated.quantity * updated.unitPrice;
          return updated;
        });
        return { ...prev, items };
      });
    },
    []
  );

  const addItem = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem(prev.items.length)],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setForm((prev) => {
      const items = prev.items
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, sortOrder: i }));
      return { ...prev, items };
    });
  }, []);

  // ---------- Computed total ----------

  const total = useMemo(
    () => form.items.reduce((sum, item) => sum + item.extendedPrice, 0),
    [form.items]
  );

  // ---------- Staff autofill ----------

  const handleStaffSelect = useCallback((staff: StaffMember) => {
    setForm((prev) => ({
      ...prev,
      staffId: staff.id,
      department: staff.department,
      accountCode: staff.accountCode,
      contactName: staff.name,
      contactExtension: staff.extension,
      contactEmail: staff.email,
      contactPhone: staff.phone,
      approvalChain: staff.approvalChain,
    }));
  }, []);

  // ---------- Save helpers ----------

  /** POST to /api/invoices, returns the created invoice id */
  async function postDraft(): Promise<string> {
    const payload = {
      invoiceNumber: form.invoiceNumber,
      date: form.date,
      staffId: form.staffId,
      department: form.department,
      accountCode: form.accountCode,
      approvalChain: form.approvalChain,
      notes: form.notes,
      items: form.items.map((item, i) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sortOrder: item.sortOrder ?? i,
      })),
    };

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErrors = (data?.error?.fieldErrors ?? {}) as Record<
        string,
        string[]
      >;
      const firstFieldError = Object.values(fieldErrors)[0]?.[0];
      const msg =
        (data?.error?.formErrors as string[] | undefined)?.[0] ??
        firstFieldError ??
        "Failed to save invoice";
      throw new Error(msg);
    }

    const invoice = await res.json();
    return invoice.id as string;
  }

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const id = await postDraft();
      toast.success("Draft saved");
      router.push(`/invoices/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, router]);

  const saveAndFinalize = useCallback(async () => {
    setSaving(true);
    try {
      const id = await postDraft();

      const finalizePayload = {
        prismcorePath: form.prismcorePath,
        signatures: form.signatures,
        semesterYearDept: form.semesterYearDept,
        contactName: form.contactName,
        contactExtension: form.contactExtension,
      };

      const res = await fetch(`/api/invoices/${id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalizePayload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error ?? "Failed to finalize invoice";
        throw new Error(msg);
      }

      toast.success("Invoice finalized");
      router.push(`/invoices/${id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to finalize invoice"
      );
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, router]);

  return {
    form,
    updateField,
    updateItem,
    addItem,
    removeItem,
    total,
    handleStaffSelect,
    saveDraft,
    saveAndFinalize,
    saving,
  };
}
