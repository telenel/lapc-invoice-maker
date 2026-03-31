import type { InvoiceFormData } from "./invoice-form";

export function getInvoiceValidationErrors(
  form: Pick<
    InvoiceFormData,
    "staffId" | "invoiceNumber" | "date" | "department" | "category" | "items"
  >,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.staffId) {
    errors.staffId = "Please select a staff member";
  }

  if (!form.invoiceNumber?.trim()) {
    errors.invoiceNumber = "Please enter an invoice number";
  }

  if (!form.date?.trim()) {
    errors.date = "Please enter a date";
  }

  if (!form.category?.trim()) {
    errors.category = "Please select a category";
  }

  if (!form.department?.trim()) {
    errors.department = "Please enter a department";
  }

  const hasValidItem = form.items.some((item) => item.description.trim() !== "");
  if (!hasValidItem) {
    errors.lineItems = "At least one line item with a description is required";
  }

  return errors;
}
