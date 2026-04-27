"use client";

import { useMemo } from "react";
import type {
  InvoiceFormData,
  InvoiceItem,
} from "@/components/invoice/hooks/use-invoice-form-state";
import type { QuoteFormData, QuoteItem } from "@/components/quote/quote-form";
import type {
  BlockerEntry,
  ChecklistEntry,
  ComposerTotals,
  DocType,
} from "../types";

type AnyItem = InvoiceItem | QuoteItem;
type AnyForm = InvoiceFormData | QuoteFormData;

function isInvoiceForm(form: AnyForm): form is InvoiceFormData {
  return "signatureStaffIds" in form;
}

function chargedPrice(item: AnyItem, form: AnyForm): number {
  if (!form.marginEnabled || form.marginPercent <= 0) {
    return Number(item.unitPrice);
  }
  const cost = item.costPrice ?? item.unitPrice;
  const m = item.marginOverride ?? form.marginPercent;
  return Math.round(cost * (1 + m / 100) * 100) / 100;
}

function computeTotals(form: AnyForm): ComposerTotals {
  let subtotal = 0;
  let taxableSubtotal = 0;
  let marginCost = 0;
  let itemCount = 0;
  let taxableCount = 0;

  for (const item of form.items) {
    const hasContent = item.description.trim().length > 0 || !!item.sku;
    if (!hasContent) continue;

    const charged = chargedPrice(item, form);
    const ext = charged * Number(item.quantity);
    subtotal += ext;
    itemCount += 1;
    if (form.marginEnabled) {
      const cost = item.costPrice ?? item.unitPrice;
      marginCost += Number(cost) * Number(item.quantity);
    }
    if (item.isTaxable) {
      taxableSubtotal += ext;
      taxableCount += 1;
    }
  }

  const taxAmount = form.taxEnabled
    ? taxableSubtotal * Number(form.taxRate)
    : 0;
  const marginAmount = form.marginEnabled ? subtotal - marginCost : 0;
  const grandTotal = subtotal + taxAmount;

  return {
    subtotal,
    taxableSubtotal,
    taxAmount,
    marginAmount,
    grandTotal,
    itemCount,
    taxableCount,
  };
}

export function useComposerValidation(form: AnyForm, docType: DocType) {
  const totals = useMemo(() => computeTotals(form), [form]);

  const blockers = useMemo<BlockerEntry[]>(() => {
    const list: BlockerEntry[] = [];

    // Invoice always needs a staff requestor. Quote uses a single `recipient`
    // blocker that covers both internal mode (staffId set) and external mode
    // (recipientName set) — see spec §4 "Validation — quote blockers".
    if (docType === "invoice" && !form.staffId) {
      list.push({
        field: "requestor",
        label: "Requestor required",
        anchor: "section-people",
      });
    }

    if (docType === "quote" && !isInvoiceForm(form)) {
      const recipientOk = !!form.staffId || !!form.recipientName.trim();
      if (!recipientOk) {
        list.push({
          field: "recipient",
          label: "Requestor or recipient required",
          anchor: "section-people",
        });
      }
    }

    if (!form.department) {
      list.push({
        field: "department",
        label: "Department required",
        anchor: "section-department",
      });
    }
    if (!form.accountNumber) {
      list.push({
        field: "accountNumber",
        label: "Account number required",
        anchor: "section-department",
      });
    }
    if (!form.category) {
      list.push({
        field: "category",
        label: "Category required",
        anchor: "section-details",
      });
    }
    if (form.items.length === 0) {
      list.push({
        field: "items",
        label: "Add at least one line item",
        anchor: "section-items",
      });
    } else {
      const allValid = form.items.every(
        (i) => i.description.trim() && Number(i.quantity) > 0,
      );
      if (!allValid) {
        list.push({
          field: "itemsValid",
          label: "Every item needs a description and qty > 0",
          anchor: "section-items",
        });
      }
    }

    if (docType === "invoice" && isInvoiceForm(form)) {
      const filled = (
        ["line1", "line2", "line3"] as const
      ).filter((k) => form.signatureStaffIds[k]).length;
      if (filled < 2) {
        list.push({
          field: "approvers",
          label: `${2 - filled} approver(s) missing (2 required)`,
          anchor: "section-approval",
        });
      }
    }

    return list;
  }, [form, docType]);

  const checklist = useMemo<ChecklistEntry[]>(() => {
    const itemsAdded = form.items.length > 0;
    const itemsValid =
      itemsAdded &&
      form.items.every(
        (i) => i.description.trim() && Number(i.quantity) > 0,
      );

    if (docType === "invoice" && isInvoiceForm(form)) {
      const filled = (
        ["line1", "line2", "line3"] as const
      ).filter((k) => form.signatureStaffIds[k]).length;
      return [
        {
          id: "requestor",
          label: "Requestor selected",
          anchor: "section-people",
          complete: !!form.staffId,
          blocker: !form.staffId,
        },
        {
          id: "deptAcct",
          label: "Department & account",
          anchor: "section-department",
          complete: !!form.department && !!form.accountNumber,
          blocker: !form.department || !form.accountNumber,
        },
        {
          id: "category",
          label: "Category chosen",
          anchor: "section-details",
          complete: !!form.category,
          blocker: !form.category,
        },
        {
          id: "items",
          label: "Line items added",
          anchor: "section-items",
          complete: itemsAdded,
          blocker: !itemsAdded,
        },
        {
          id: "itemsValid",
          label: "Items valid",
          anchor: "section-items",
          complete: itemsValid,
          blocker: itemsAdded && !itemsValid,
        },
        {
          id: "approvers",
          label: "At least 2 approvers",
          anchor: "section-approval",
          complete: filled >= 2,
          blocker: filled < 2,
        },
      ];
    }

    if (!isInvoiceForm(form)) {
      const recipientOk = !!form.staffId || !!form.recipientName.trim();
      return [
        {
          id: "requestor",
          label: "Requestor selected",
          anchor: "section-people",
          complete: !!form.staffId,
          // For quotes, requestor is a soft to-do, not a hard blocker —
          // external-mode quotes intentionally have no staffId.
          blocker: false,
        },
        {
          id: "recipient",
          label: "Recipient set",
          anchor: "section-people",
          complete: recipientOk,
          blocker: !recipientOk,
        },
        {
          id: "category",
          label: "Category chosen",
          anchor: "section-details",
          complete: !!form.category,
          blocker: !form.category,
        },
        {
          id: "items",
          label: "Line items added",
          anchor: "section-items",
          complete: itemsAdded,
          blocker: !itemsAdded,
        },
        {
          id: "itemsValid",
          label: "Items valid",
          anchor: "section-items",
          complete: itemsValid,
          blocker: itemsAdded && !itemsValid,
        },
        {
          id: "marginTax",
          label: "Margin & tax confirmed",
          anchor: "section-items",
          complete: true,
          blocker: false,
        },
      ];
    }

    return [];
  }, [form, docType]);

  const readiness =
    checklist.length === 0
      ? 0
      : checklist.filter((c) => c.complete).length / checklist.length;

  const canSaveDraft = useMemo(() => {
    const itemsValid =
      form.items.length > 0 &&
      form.items.every(
        (i) => i.description.trim() && Number(i.quantity) > 0,
      );
    if (!itemsValid || !form.department || !form.date) return false;

    if (docType === "invoice") {
      return !!form.staffId;
    }
    // Quote: schema minimum needs recipientName OR staffId (internal-mode UX
    // auto-fills recipientName from the selected staff record on staff pick).
    if (!isInvoiceForm(form)) {
      return !!form.staffId || !!form.recipientName.trim();
    }
    return false;
  }, [form, docType]);

  return { blockers, checklist, readiness, canSaveDraft, totals };
}
