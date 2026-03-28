"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { InvoiceFormData } from "./use-invoice-form-state";

export type GenerationStep = null | "saving" | "generating" | "done";

function buildPayload(form: InvoiceFormData) {
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
    isRunning: form.isRunning,
    runningTitle: form.runningTitle || undefined,
    items: form.items.map((item, i) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: item.sortOrder ?? i,
    })),
  };
}

// Raw fetch is used below instead of invoiceApi.create/update because the API
// returns structured Zod field errors ({ error: { fieldErrors, formErrors } })
// that ApiError.fromResponse() cannot preserve — it only extracts a plain string.
// Keeping raw fetch lets us surface the first field-level message to the user.

/** POST to /api/invoices, returns the created invoice id */
async function postDraft(form: InvoiceFormData): Promise<string> {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(form)),
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
async function putDraft(form: InvoiceFormData, id: string): Promise<string> {
  const res = await fetch(`/api/invoices/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(form)),
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

export function useInvoiceSave(form: InvoiceFormData, existingId?: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>(null);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const id = existingId
        ? await putDraft(form, existingId)
        : await postDraft(form);
      toast.success("Draft saved");
      router.push(`/invoices/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }, [form, router, existingId]);

  const saveAndFinalize = useCallback(async () => {
    setSaving(true);
    setGenerationStep("saving");
    try {
      const id = await postDraft(form);

      setGenerationStep("generating");

      await invoiceApi.finalize(id, {
        prismcorePath: form.prismcorePath ?? undefined,
        signatures: form.signatures,
        signatureStaffIds: form.signatureStaffIds,
        semesterYearDept: form.semesterYearDept,
        contactName: form.contactName,
        contactExtension: form.contactExtension,
      });

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
  }, [form, router]);

  // Raw fetch here for the same reason as postDraft/putDraft: Zod field error parsing.
  const savePendingCharge = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...buildPayload(form),
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
  }, [form, router]);

  return { saving, generationStep, saveDraft, saveAndFinalize, savePendingCharge };
}
