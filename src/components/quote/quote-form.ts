"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { staffApi } from "@/domains/staff/api-client";
import type { StaffResponse, StaffDetailResponse, AccountNumberResponse } from "@/domains/staff/types";
import type { CateringDetails } from "@/domains/quote/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteItem {
  /** Stable client-side key for React reconciliation (not persisted) */
  _key: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  marginOverride: number | null;
  costPrice: number | null;
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
  // Margin & Tax
  marginEnabled: boolean;
  marginPercent: number;
  taxEnabled: boolean;
  // Catering
  isCateringEvent: boolean;
  cateringDetails: CateringDetails;
}

// StaffAccountNumber = AccountNumberResponse from staff domain (re-exported for consumers)
export type { AccountNumberResponse as StaffAccountNumber };

// StaffMember = StaffResponse from staff domain (re-exported for consumers)
export type { StaffResponse as StaffMember };

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
  return {
    _key: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder,
    isTaxable: true,
    marginOverride: null,
    costPrice: null,
  };
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
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    isCateringEvent: false,
    cateringDetails: {
      eventDate: todayISO(),
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

  // Handle async initial data (e.g., fetched after mount on edit page)
  const initialApplied = useRef(false);
  useEffect(() => {
    if (initial && !initialApplied.current) {
      initialApplied.current = true;
      setForm({ ...defaultForm(), ...initial });
    }
  }, [initial]);

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

  const itemsWithMargin = useMemo(() => {
    if (!form.marginEnabled || form.marginPercent <= 0) return form.items;
    return form.items.map((item) => {
      const effectiveMargin = item.marginOverride ?? form.marginPercent;
      const cost = item.costPrice ?? item.unitPrice;
      const charged = Math.round(cost * (1 + effectiveMargin / 100) * 100) / 100;
      return { ...item, extendedPrice: charged * item.quantity };
    });
  }, [form.items, form.marginEnabled, form.marginPercent]);

  // ---------- Staff autofill ----------

  const [staffAccountNumbers, setStaffAccountNumbers] = useState<AccountNumberResponse[]>([]);

  const originalStaffRef = useRef<{
    extension: string;
    email: string;
    phone: string;
    department: string;
  } | null>(null);

  // When editing an existing quote, re-populate account numbers and contact
  // fields from the staff record (these aren't stored on the quote itself)
  const staffPopulated = useRef(false);
  useEffect(() => {
    if (!form.staffId || staffPopulated.current) return;
    staffPopulated.current = true;

    staffApi.getById(form.staffId).then((detail) => {
      setStaffAccountNumbers(detail.accountNumbers ?? []);
      originalStaffRef.current = {
        extension: detail.extension,
        email: detail.email,
        phone: detail.phone,
        department: detail.department,
      };
      // Fill in contact fields that are blank on edit (they come as empty
      // strings from mapApiToFormData because they aren't stored on the quote)
      setForm((prev) => ({
        ...prev,
        contactName: prev.contactName || detail.name,
        contactExtension: prev.contactExtension || detail.extension,
        contactEmail: prev.contactEmail || detail.email,
        contactPhone: prev.contactPhone || detail.phone,
      }));
    }).catch(() => {
      // Staff may have been deleted — ignore
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.staffId]);

  const handleStaffSelect = useCallback((staff: StaffResponse & Partial<Pick<StaffDetailResponse, "accountNumbers">>) => {
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
      cateringDetails: {
        ...prev.cateringDetails,
        contactName: prev.cateringDetails.contactName || staff.name,
        contactPhone: prev.cateringDetails.contactPhone || staff.phone,
        contactEmail: prev.cateringDetails.contactEmail || staff.email,
      },
    }));
  }, []);

  const handleStaffEdit = useCallback((updated: StaffResponse) => {
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
        await staffApi.partialUpdate(form.staffId, {
          extension: form.contactExtension,
          email: form.contactEmail,
          phone: form.contactPhone,
          department: form.department,
        });
        originalStaffRef.current = {
          extension: form.contactExtension,
          email: form.contactEmail,
          phone: form.contactPhone,
          department: form.department,
        };
        toast.success("Staff info saved", { duration: 1500 });
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
      marginEnabled: form.marginEnabled,
      marginPercent: form.marginEnabled ? form.marginPercent : undefined,
      taxEnabled: form.taxEnabled,
      isCateringEvent: form.isCateringEvent,
      cateringDetails: form.isCateringEvent ? form.cateringDetails : undefined,
      items: form.items.map((item, i) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sortOrder: item.sortOrder ?? i,
        isTaxable: item.isTaxable,
        marginOverride: item.marginOverride ?? undefined,
        costPrice: item.costPrice ?? undefined,
      })),
    };
  }

  // Raw fetch is used instead of quoteApi.create/update because the API returns
  // structured Zod field errors ({ error: { fieldErrors, formErrors } }) that
  // ApiError.fromResponse() cannot preserve — it only extracts a plain string.
  // Keeping raw fetch lets us surface the first field-level message to the user.
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
    itemsWithMargin,
    handleStaffSelect,
    handleStaffEdit,
    staffAccountNumbers,
    saveQuote,
    saving,
    existingId,
  };
}
