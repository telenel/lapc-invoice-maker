import type { BulkEditFieldDefinition, BulkEditFieldGroup, BulkEditFieldId, BulkEditFieldRegistry } from "@/domains/bulk-edit/types";

export const bulkEditFieldRegistry = {
  description: {
    id: "description",
    label: "Description",
    group: "primary",
    fillRateLabel: "100.0%",
    requiresLocation: false,
  },
  vendorId: {
    id: "vendorId",
    label: "Vendor",
    group: "primary",
    fillRateLabel: "100.0%",
    requiresLocation: false,
    refOptionKey: "vendors",
  },
  dccId: {
    id: "dccId",
    label: "DCC",
    group: "primary",
    fillRateLabel: "100.0%",
    requiresLocation: false,
    refOptionKey: "dccs",
  },
  barcode: {
    id: "barcode",
    label: "Barcode",
    group: "primary",
    fillRateLabel: "69.5% / 94.1%",
    requiresLocation: false,
  },
  itemTaxTypeId: {
    id: "itemTaxTypeId",
    label: "Item Tax Type",
    group: "primary",
    fillRateLabel: "100.0%",
    requiresLocation: false,
    refOptionKey: "taxTypes",
  },
  catalogNumber: {
    id: "catalogNumber",
    label: "Catalog #",
    group: "primary",
    fillRateLabel: "70.9%",
    requiresLocation: false,
  },
  packageType: {
    id: "packageType",
    label: "Package Type",
    group: "more",
    fillRateLabel: "100.0%",
    requiresLocation: false,
    refOptionKey: "packageTypes",
  },
  unitsPerPack: {
    id: "unitsPerPack",
    label: "Units per Pack",
    group: "more",
    fillRateLabel: "15.0%",
    requiresLocation: false,
  },
  title: {
    id: "title",
    label: "Title",
    group: "primary",
    fillRateLabel: "100.0%",
    requiresLocation: false,
  },
  author: {
    id: "author",
    label: "Author",
    group: "primary",
    fillRateLabel: "100.0%",
    requiresLocation: false,
  },
  isbn: {
    id: "isbn",
    label: "ISBN",
    group: "primary",
    fillRateLabel: "91.8%",
    requiresLocation: false,
  },
  edition: {
    id: "edition",
    label: "Edition",
    group: "primary",
    fillRateLabel: "65.4%",
    requiresLocation: false,
  },
  bindingId: {
    id: "bindingId",
    label: "Binding",
    group: "primary",
    fillRateLabel: "82.9%",
    requiresLocation: false,
    refOptionKey: "bindings",
  },
  retail: {
    id: "retail",
    label: "Retail",
    group: "inventory",
    fillRateLabel: "98.4% / 98.9%",
    requiresLocation: true,
  },
  cost: {
    id: "cost",
    label: "Cost",
    group: "inventory",
    fillRateLabel: "96.7% / 98.4%",
    requiresLocation: true,
  },
  expectedCost: {
    id: "expectedCost",
    label: "Expected Cost",
    group: "inventory",
    fillRateLabel: "39.6% / 81.9%",
    requiresLocation: true,
  },
  tagTypeId: {
    id: "tagTypeId",
    label: "Tag Type",
    group: "inventory",
    fillRateLabel: "100.0% / 100.0%",
    requiresLocation: true,
    refOptionKey: "tagTypes",
  },
  statusCodeId: {
    id: "statusCodeId",
    label: "Status Code",
    group: "inventory",
    fillRateLabel: "98.9% / 100.0%",
    requiresLocation: true,
    refOptionKey: "statusCodes",
  },
  estSales: {
    id: "estSales",
    label: "Est. Sales",
    group: "inventory",
    fillRateLabel: "39.3% / 84.2%",
    requiresLocation: true,
  },
  fInvListPriceFlag: {
    id: "fInvListPriceFlag",
    label: "Use inventory list price on price tag",
    group: "inventory",
    fillRateLabel: "95.3% / 81.3%",
    requiresLocation: true,
  },
  fTxWantListFlag: {
    id: "fTxWantListFlag",
    label: "Want List",
    group: "inventory",
    fillRateLabel: "4.9% / 76.2%",
    requiresLocation: true,
  },
  fTxBuybackListFlag: {
    id: "fTxBuybackListFlag",
    label: "Buyback List",
    group: "inventory",
    fillRateLabel: "4.9% / 75.4%",
    requiresLocation: true,
  },
  fNoReturns: {
    id: "fNoReturns",
    label: "No Returns",
    group: "inventory",
    fillRateLabel: "0.0% / 18.1%",
    requiresLocation: true,
  },
  fDiscontinue: {
    id: "fDiscontinue",
    label: "Discontinue",
    group: "primary",
    fillRateLabel: "0.2% / 0.7%",
    requiresLocation: false,
  },
} as const satisfies BulkEditFieldRegistry;

export interface BulkEditFieldPickerSection {
  group: BulkEditFieldGroup;
  fields: readonly BulkEditFieldDefinition[];
}

export const bulkEditFieldPickerSections: readonly BulkEditFieldPickerSection[] = [
  {
    group: "primary",
    fields: [
      bulkEditFieldRegistry.description,
      bulkEditFieldRegistry.title,
      bulkEditFieldRegistry.author,
      bulkEditFieldRegistry.isbn,
      bulkEditFieldRegistry.edition,
      bulkEditFieldRegistry.bindingId,
      bulkEditFieldRegistry.barcode,
      bulkEditFieldRegistry.dccId,
      bulkEditFieldRegistry.vendorId,
      bulkEditFieldRegistry.itemTaxTypeId,
      bulkEditFieldRegistry.catalogNumber,
      bulkEditFieldRegistry.fDiscontinue,
    ],
  },
  {
    group: "inventory",
    fields: [
      bulkEditFieldRegistry.retail,
      bulkEditFieldRegistry.cost,
      bulkEditFieldRegistry.expectedCost,
      bulkEditFieldRegistry.tagTypeId,
      bulkEditFieldRegistry.statusCodeId,
      bulkEditFieldRegistry.estSales,
      bulkEditFieldRegistry.fInvListPriceFlag,
      bulkEditFieldRegistry.fTxWantListFlag,
      bulkEditFieldRegistry.fTxBuybackListFlag,
      bulkEditFieldRegistry.fNoReturns,
    ],
  },
  {
    group: "more",
    fields: [bulkEditFieldRegistry.packageType, bulkEditFieldRegistry.unitsPerPack],
  },
  {
    group: "advanced",
    fields: [],
  },
] ;

export const bulkEditFieldPickerFields: readonly BulkEditFieldDefinition[] = bulkEditFieldPickerSections.flatMap(
  (section) => section.fields,
);

export function getBulkEditFieldDefinition(fieldId: BulkEditFieldId): BulkEditFieldDefinition {
  return bulkEditFieldRegistry[fieldId];
}
