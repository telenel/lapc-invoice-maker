import type { QuoteFormData } from "./quote-form";

export function buildQuotePayload(form: QuoteFormData, existingId?: string) {
  return {
    date: form.date,
    staffId: existingId ? (form.staffId || null) : (form.staffId || undefined),
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
    items: form.items
      .filter((item) => item.description.trim() !== "")
      .map((item, i) => {
        const cost = Number(item.costPrice ?? item.unitPrice);
        const effectiveMargin = item.marginOverride ?? form.marginPercent;
        const charged =
          form.marginEnabled && effectiveMargin > 0
            ? Math.round(cost * (1 + effectiveMargin / 100) * 100) / 100
            : cost;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: charged,
          sortOrder: item.sortOrder ?? i,
          isTaxable: item.isTaxable,
          marginOverride: item.marginOverride ?? undefined,
          costPrice: form.marginEnabled ? cost : undefined,
        };
      }),
  };
}
