"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types (re-exported so consumers can import from here)
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
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder,
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

  return { form, setForm, updateField, updateItem, addItem, removeItem };
}
