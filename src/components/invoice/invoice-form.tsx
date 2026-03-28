"use client";

// ---------------------------------------------------------------------------
// Re-exports — keep the same public API so no other file needs to change
// ---------------------------------------------------------------------------

export type { InvoiceItem, InvoiceFormData } from "./hooks/use-invoice-form-state";
export type { StaffAccountNumber } from "./hooks/use-staff-autofill";
export type { GenerationStep } from "./hooks/use-invoice-save";

// ---------------------------------------------------------------------------
// Composition root
// ---------------------------------------------------------------------------

import { useInvoiceFormState } from "./hooks/use-invoice-form-state";
import type { InvoiceFormData } from "./hooks/use-invoice-form-state";
import { useTaxCalculation } from "./hooks/use-tax-calculation";
import { TAX_RATE } from "@/domains/invoice/constants";
import { useStaffAutofill } from "./hooks/use-staff-autofill";
import { useStaffAutoSave } from "./hooks/use-staff-auto-save";
import { useInvoiceSave } from "./hooks/use-invoice-save";

export function useInvoiceForm(
  initial?: Partial<InvoiceFormData>,
  existingId?: string
) {
  const { form, setForm, updateField, updateItem, addItem, removeItem, total, itemsWithMargin } =
    useInvoiceFormState(initial);

  const taxItems = form.marginEnabled ? itemsWithMargin : form.items;
  const { subtotal, taxAmount, total: grandTotal } = useTaxCalculation(
    taxItems,
    form.taxEnabled,
    TAX_RATE
  );

  const { staffAccountNumbers, originalStaffRef, handleStaffSelect, handleStaffEdit } =
    useStaffAutofill(setForm);

  useStaffAutoSave(
    {
      staffId: form.staffId,
      contactExtension: form.contactExtension,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      department: form.department,
    },
    originalStaffRef
  );

  const { saving, generationStep, saveDraft, saveAndFinalize, savePendingCharge } =
    useInvoiceSave(form, existingId);

  return {
    form,
    updateField,
    updateItem,
    addItem,
    removeItem,
    total,
    itemsWithMargin,
    subtotal,
    taxAmount,
    grandTotal,
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
