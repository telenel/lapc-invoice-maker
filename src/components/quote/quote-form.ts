"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

export interface QuoteFormData {
  date: string;
  staffId: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  contactName: string;
  contactExtension: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  items: QuoteItem[];
  // Quote-specific fields
  expirationDate: string;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
}

export interface StaffAccountNumber {
  id: string;
  accountCode: string;
  description: string;
  lastUsedAt: string;
}

interface SignerHistory {
  position: number;
  signer: { id: string; name: string; title: string };
}

export interface StaffMember {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  accountNumbers?: StaffAccountNumber[];
  signerHistories?: SignerHistory[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function thirtyDaysFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function emptyItem(sortOrder = 0): QuoteItem {
  return { description: "", quantity: 1, unitPrice: 0, extendedPrice: 0, sortOrder };
}

function defaultForm(): QuoteFormData {
  return {
    date: todayISO(),
    staffId: "",
    department: "",
    category: "",
    accountCode: "",
    accountNumber: "",
    approvalChain: [],
    contactName: "",
    contactExtension: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    items: [emptyItem(0)],
    expirationDate: thirtyDaysFromNow(),
    recipientName: "",
    recipientEmail: "",
    recipientOrg: "",
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuoteForm(
  initial?: Partial<QuoteFormData>,
  existingId?: string
) {
  const router = useRouter();

  const [form, setForm] = useState<QuoteFormData>(() => ({
    ...defaultForm(),
    ...initial,
  }));

  const [saving, setSaving] = useState(false);

  const updateField = useCallback(
    <K extends keyof QuoteFormData>(key: K, value: QuoteFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateItem = useCallback(
    (index: number, patch: Partial<QuoteItem>) => {
      setForm((prev) => {
        const items = prev.items.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, ...patch };
          updated.extendedPrice = Number(updated.quantity) * Number(updated.unitPrice);
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

  const total = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.extendedPrice), 0),
    [form.items]
  );

  // ---------- Staff autofill ----------

  const [staffAccountNumbers, setStaffAccountNumbers] = useState<StaffAccountNumber[]>([]);

  const originalStaffRef = useRef<{
    extension: string;
    email: string;
    phone: string;
    department: string;
  } | null>(null);

  const handleStaffSelect = useCallback((staff: StaffMember) => {
    const latestAccount = staff.accountNumbers?.[0];
    setStaffAccountNumbers(staff.accountNumbers ?? []);
    originalStaffRef.current = {
      extension: staff.extension,
      email: staff.email,
      phone: staff.phone,
      department: staff.department,
    };

    setForm((prev) => ({
      ...prev,
      staffId: staff.id,
      department: staff.department,
      accountNumber: latestAccount?.accountCode ?? "",
      accountCode: staff.accountCode,
      contactName: staff.name,
      contactExtension: staff.extension,
      contactEmail: staff.email,
      contactPhone: staff.phone,
      approvalChain: staff.approvalChain,
    }));
  }, []);

  const handleStaffEdit = useCallback((updated: StaffMember) => {
    originalStaffRef.current = {
      extension: updated.extension,
      email: updated.email,
      phone: updated.phone,
      department: updated.department,
    };
    setForm((prev) => ({
      ...prev,
      department: updated.department,
      accountCode: updated.accountCode,
      contactName: updated.name,
      contactExtension: updated.extension,
      contactEmail: updated.email,
      contactPhone: updated.phone,
      approvalChain: updated.approvalChain,
    }));
  }, []);

  // Auto-save staff contact fields (debounced)
  useEffect(() => {
    if (!form.staffId || !originalStaffRef.current) return;

    const orig = originalStaffRef.current;
    const changed =
      form.contactExtension !== orig.extension ||
      form.contactEmail !== orig.email ||
      form.contactPhone !== orig.phone ||
      form.department !== orig.department;

    if (!changed) return;

    const timer = setTimeout(async () => {
      if (!originalStaffRef.current) return;
      try {
        const res = await fetch(`/api/staff/${form.staffId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extension: form.contactExtension,
            email: form.contactEmail,
            phone: form.contactPhone,
            department: form.department,
          }),
        });
        if (res.ok) {
          originalStaffRef.current = {
            extension: form.contactExtension,
            email: form.contactEmail,
            phone: form.contactPhone,
            department: form.department,
          };
          toast.success("Staff info saved", { duration: 1500 });
        }
      } catch { /* ignore */ }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.staffId, form.contactExtension, form.contactEmail, form.contactPhone, form.department]);

  // ---------- Save helpers ----------

  function buildPayload() {
    return {
      date: form.date,
      staffId: form.staffId,
      department: form.department,
      category: form.category,
      accountCode: form.accountCode,
      accountNumber: form.accountNumber,
      approvalChain: form.approvalChain,
      notes: form.notes,
      expirationDate: form.expirationDate,
      recipientName: form.recipientName,
      recipientEmail: form.recipientEmail || undefined,
      recipientOrg: form.recipientOrg,
      items: form.items.map((item, i) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sortOrder: item.sortOrder ?? i,
      })),
    };
  }

  async function postQuote(): Promise<string> {
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErrors = (data?.error?.fieldErrors ?? {}) as Record<string, string[]>;
      const firstFieldError = Object.values(fieldErrors)[0]?.[0];
      const msg =
        (data?.error?.formErrors as string[] | undefined)?.[0] ??
        firstFieldError ??
        "Failed to save quote";
      throw new Error(msg);
    }

    const quote = await res.json();
    return quote.id as string;
  }

  async function putQuote(id: string): Promise<string> {
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErrors = (data?.error?.fieldErrors ?? {}) as Record<string, string[]>;
      const firstFieldError = Object.values(fieldErrors)[0]?.[0];
      const msg =
        (data?.error?.formErrors as string[] | undefined)?.[0] ??
        firstFieldError ??
        data?.error ??
        "Failed to save quote";
      throw new Error(msg);
    }

    const quote = await res.json();
    return quote.id as string;
  }

  const saveQuote = useCallback(async () => {
    setSaving(true);
    try {
      const id = existingId ? await putQuote(existingId) : await postQuote();
      toast.success("Quote saved");
      router.push(`/quotes/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save quote");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, router, existingId]);

  return {
    form,
    updateField,
    updateItem,
    addItem,
    removeItem,
    total,
    handleStaffSelect,
    handleStaffEdit,
    staffAccountNumbers,
    saveQuote,
    saving,
  };
}
