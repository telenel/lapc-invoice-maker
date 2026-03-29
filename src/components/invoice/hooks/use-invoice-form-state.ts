"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { TAX_RATE } from "@/domains/invoice/constants";

// ---------------------------------------------------------------------------
// Types (re-exported so consumers can import from here)
// ---------------------------------------------------------------------------

export interface InvoiceItem {
  /** Stable client-side key for React reconciliation (not persisted) */
  _key: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  /** Whether this item is subject to sales tax */
  isTaxable: boolean;
  /** Per-item margin override percentage */
  marginOverride: number | null;
  /** Original cost price before margin */
  costPrice: number | null;
}

export interface InvoiceFormData {
  // Core fields
  invoiceNumber: string;
  date: string;
  staffId: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  // Contact / display fields (autofilled from staff, editable)
  contactName: string;
  contactExtension: string;
  contactEmail: string;
  contactPhone: string;
  // Additional fields
  semesterYearDept: string;
  notes: string;
  // Recurring invoice fields
  isRecurring: boolean;
  recurringInterval: string;
  recurringEmail: string;
  // Running invoice fields
  isRunning: boolean;
  runningTitle: string;
  // Margin & Tax
  marginEnabled: boolean;
  marginPercent: number;
  taxEnabled: boolean;
  /** Stored tax rate from existing invoice; falls back to TAX_RATE for new invoices */
  taxRate: number;
  // Line items
  items: InvoiceItem[];
  // Finalization
  prismcorePath: string | null;
  signatures: {
    line1: string;
    line2: string;
    line3: string;
  };
  signatureStaffIds: {
    line1: string;
    line2: string;
    line3: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function emptyItem(sortOrder = 0): InvoiceItem {
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

export function defaultForm(): InvoiceFormData {
  return {
    invoiceNumber: "",
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
    semesterYearDept: "",
    notes: "",
    isRecurring: false,
    recurringInterval: "",
    recurringEmail: "",
    isRunning: false,
    runningTitle: "",
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    taxRate: TAX_RATE,
    items: [emptyItem(0)],
    prismcorePath: null,
    signatures: { line1: "", line2: "", line3: "" },
    signatureStaffIds: { line1: "", line2: "", line3: "" },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInvoiceFormState(initial?: Partial<InvoiceFormData>) {
  const [form, setForm] = useState<InvoiceFormData>(() => ({
    ...defaultForm(),
    ...initial,
  }));

  // When initial data arrives asynchronously (e.g. edit page fetch), update form state
  const initialApplied = useRef(false);
  useEffect(() => {
    if (initial && !initialApplied.current) {
      initialApplied.current = true;
      setForm({ ...defaultForm(), ...initial });
    }
  }, [initial]);

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
          updated.extendedPrice =
            Number(updated.quantity) * Number(updated.unitPrice);
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

  return { form, setForm, updateField, updateItem, addItem, removeItem, total, itemsWithMargin };
}
