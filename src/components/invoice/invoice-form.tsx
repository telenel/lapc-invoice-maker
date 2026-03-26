"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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

export interface StaffAccountNumber {
  id: string;
  accountCode: string;
  description: string;
  lastUsedAt: string;
}

interface SignerHistory {
  position: number;
  signer: {
    id: string;
    name: string;
    title: string;
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
  accountNumbers?: StaffAccountNumber[];
  signerHistories?: SignerHistory[];
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
    items: [emptyItem(0)],
    prismcorePath: null,
    signatures: { line1: "", line2: "", line3: "" },
    signatureStaffIds: { line1: "", line2: "", line3: "" },
  };
}

// ---------------------------------------------------------------------------
// Generation step type
// ---------------------------------------------------------------------------

export type GenerationStep = null | "saving" | "generating" | "done";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInvoiceForm(
  initial?: Partial<InvoiceFormData>,
  existingId?: string
) {
  const router = useRouter();

  const [form, setForm] = useState<InvoiceFormData>(() => ({
    ...defaultForm(),
    ...initial,
  }));

  const [saving, setSaving] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>(null);

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

  // ---------- Computed total ----------

  const total = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.extendedPrice), 0),
    [form.items]
  );

  // ---------- Staff autofill ----------

  const [staffAccountNumbers, setStaffAccountNumbers] = useState<
    StaffAccountNumber[]
  >([]);

  // Track the original staff field values so we can detect user edits
  const originalStaffRef = useRef<{
    extension: string;
    email: string;
    phone: string;
    department: string;
  } | null>(null);

  const handleStaffSelect = useCallback((staff: StaffMember) => {
    // Most recently used account number (first in the list, already sorted by lastUsedAt desc)
    const latestAccount = staff.accountNumbers?.[0];
    setStaffAccountNumbers(staff.accountNumbers ?? []);
    originalStaffRef.current = {
      extension: staff.extension,
      email: staff.email,
      phone: staff.phone,
      department: staff.department,
    };

    // Auto-populate signatures from signer history (sorted by position)
    const histories = staff.signerHistories ?? [];
    const byPosition: Record<number, SignerHistory> = {};
    for (const h of histories) {
      // Keep only the first entry per position (already sorted by lastUsedAt desc)
      if (!(h.position in byPosition)) byPosition[h.position] = h;
    }

    const lines = ["line1", "line2", "line3"] as const;
    const sigDisplays: Record<string, string> = { line1: "", line2: "", line3: "" };
    const sigIds: Record<string, string> = { line1: "", line2: "", line3: "" };
    lines.forEach((line, idx) => {
      const h = byPosition[idx];
      if (h) {
        const title = h.signer.title ? `, ${h.signer.title}` : "";
        sigDisplays[line] = `${h.signer.name}${title}`;
        sigIds[line] = h.signer.id;
      }
    });

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
      signatures: {
        line1: sigDisplays.line1,
        line2: sigDisplays.line2,
        line3: sigDisplays.line3,
      },
      signatureStaffIds: {
        line1: sigIds.line1,
        line2: sigIds.line2,
        line3: sigIds.line3,
      },
    }));
  }, []);

  // Called after the inline StaffForm dialog saves, to re-sync form fields
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

  // ---------- Auto-save staff contact fields ----------

  // Debounced effect: when contactExtension/contactEmail/contactPhone/department
  // change and differ from the originally-loaded values, PATCH the staff record.
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
      // Re-check that the ref is still current (staff may have changed)
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
          // Update baseline so next change detection is relative to saved values
          originalStaffRef.current = {
            extension: form.contactExtension,
            email: form.contactEmail,
            phone: form.contactPhone,
            department: form.department,
          };
          toast.success("Staff info saved", { duration: 1500 });
        }
      } catch {
        // Silently ignore auto-save network failures
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    form.staffId,
    form.contactExtension,
    form.contactEmail,
    form.contactPhone,
    form.department,
  ]);

  // ---------- Save helpers ----------

  function buildPayload() {
    return {
      invoiceNumber: form.invoiceNumber,
      date: form.date,
      staffId: form.staffId,
      department: form.department,
      category: form.category,
      accountCode: form.accountCode,
      accountNumber: form.accountNumber,
      approvalChain: form.approvalChain,
      notes: form.notes,
      isRecurring: form.isRecurring,
      recurringInterval: form.recurringInterval || undefined,
      recurringEmail: form.recurringEmail || undefined,
      items: form.items.map((item, i) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sortOrder: item.sortOrder ?? i,
      })),
    };
  }

  /** POST to /api/invoices, returns the created invoice id */
  async function postDraft(): Promise<string> {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
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

  /** PUT to /api/invoices/{existingId}, returns the invoice id */
  async function putDraft(id: string): Promise<string> {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
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
        data?.error ??
        "Failed to save invoice";
      throw new Error(msg);
    }

    const invoice = await res.json();
    return invoice.id as string;
  }

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const id = existingId ? await putDraft(existingId) : await postDraft();
      toast.success("Draft saved");
      router.push(`/invoices/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, router, existingId]);

  const saveAndFinalize = useCallback(async () => {
    setSaving(true);
    setGenerationStep("saving");
    try {
      const id = await postDraft();

      setGenerationStep("generating");

      const finalizePayload = {
        prismcorePath: form.prismcorePath,
        signatures: form.signatures,
        signatureStaffIds: form.signatureStaffIds,
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

      setGenerationStep("done");
      toast.success("Invoice finalized");

      // Brief delay so the user sees the "Done!" state
      await new Promise((resolve) => setTimeout(resolve, 1500));

      router.push(`/invoices/${id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to finalize invoice"
      );
      setGenerationStep(null);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, router]);

  const savePendingCharge = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...buildPayload(),
        invoiceNumber: null,
        status: "PENDING_CHARGE",
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
      toast.success("Saved — charge at register when ready");
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save invoice"
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
    handleStaffEdit,
    staffAccountNumbers,
    saveDraft,
    saveAndFinalize,
    savePendingCharge,
    saving,
    generationStep,
  };
}
