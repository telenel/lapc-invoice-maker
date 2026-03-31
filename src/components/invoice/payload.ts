import type { InvoiceFormData } from "./invoice-form";

export function buildInvoicePayload(form: InvoiceFormData) {
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
    marginEnabled: form.marginEnabled,
    marginPercent: form.marginEnabled ? form.marginPercent : undefined,
    taxEnabled: form.taxEnabled,
    taxRate: form.taxRate,
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
