export interface LineItemLike {
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  costPrice: number | null;
  marginOverride: number | null;
}

function isEmptyNumber(value: number | null | undefined): boolean {
  return value == null || Number(value) === 0;
}

export function isBlankLineItem(item: LineItemLike): boolean {
  return (
    !item.sku?.trim() &&
    item.description.trim() === "" &&
    Number(item.quantity) === 1 &&
    Number(item.unitPrice) === 0 &&
    Number(item.extendedPrice) === 0 &&
    isEmptyNumber(item.costPrice) &&
    isEmptyNumber(item.marginOverride)
  );
}

export function prepareLineItemsForSubmit<T extends LineItemLike>(
  items: T[],
): Array<T & { sortOrder: number }> {
  const prepared: Array<T & { sortOrder: number }> = [];

  items.forEach((item, originalIndex) => {
    if (isBlankLineItem(item)) return;

    if (item.description.trim() === "") {
      throw new Error(`Line item ${originalIndex + 1}: description is required.`);
    }

    prepared.push({
      ...item,
      description: item.description.trim(),
      sortOrder: prepared.length,
    });
  });

  if (prepared.length === 0) {
    throw new Error("Add at least one line item before saving.");
  }

  return prepared;
}

export function appendLineItemsReplacingPlaceholders<T extends LineItemLike>(
  existingItems: T[],
  newItems: T[],
): T[] {
  const existingRealItems = existingItems.filter((item) => !isBlankLineItem(item));
  return [...existingRealItems, ...newItems].map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}
