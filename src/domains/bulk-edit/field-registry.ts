import { productEditableFieldRegistry, productEditableFieldSections } from "@/domains/product/editable-fields";
import type { BulkEditFieldDefinition, BulkEditFieldGroup, BulkEditFieldId, BulkEditFieldRegistry } from "@/domains/bulk-edit/types";

export const bulkEditFieldRegistry = productEditableFieldRegistry as unknown as BulkEditFieldRegistry;

export interface BulkEditFieldPickerSection {
  group: BulkEditFieldGroup;
  fields: readonly BulkEditFieldDefinition[];
}

export const bulkEditFieldPickerSections: readonly BulkEditFieldPickerSection[] = productEditableFieldSections.map(
  (section) => ({
    group: section.group,
    fields: section.fields as readonly BulkEditFieldDefinition[],
  }),
);

export const bulkEditFieldPickerFields: readonly BulkEditFieldDefinition[] = bulkEditFieldPickerSections.flatMap(
  (section) => section.fields,
);

export function getBulkEditFieldDefinition(fieldId: BulkEditFieldId): BulkEditFieldDefinition {
  return bulkEditFieldRegistry[fieldId];
}
