import type { QuoteFormData } from "./quote-form";

export function getQuoteValidationErrors(
  form: Pick<
    QuoteFormData,
    | "date"
    | "recipientName"
    | "department"
    | "category"
    | "expirationDate"
    | "items"
    | "isCateringEvent"
    | "cateringDetails"
  >,
  options?: { requireCateringDetails?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.date.trim()) {
    errors.date = "Please enter a date";
  }

  if (!form.recipientName.trim()) {
    errors.recipientName = "Please enter a recipient name";
  }

  if (!form.department.trim()) {
    errors.department = "Please enter a department";
  }

  if (!form.category.trim()) {
    errors.category = "Please select a category";
  }

  if (!form.expirationDate.trim()) {
    errors.expirationDate = "Please enter an expiration date";
  }

  const hasValidItem = form.items.some((item) => item.description.trim() !== "");
  if (!hasValidItem) {
    errors.lineItems = "At least one line item with a description is required";
  }

  if (form.isCateringEvent && options?.requireCateringDetails) {
    if (!form.cateringDetails.location?.trim()) {
      errors["cateringDetails.location"] = "Event location is required";
    }
    if (!form.cateringDetails.contactName?.trim()) {
      errors["cateringDetails.contactName"] = "Event contact name is required";
    }
    if (!form.cateringDetails.contactPhone?.trim()) {
      errors["cateringDetails.contactPhone"] = "Event contact phone is required";
    }
  }

  return errors;
}
