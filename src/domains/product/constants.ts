import type { ProductFilters, ProductTab } from "./types";

export const PAGE_SIZE = 50;

export const TABS: { value: ProductTab; label: string }[] = [
  { value: "textbooks", label: "Textbooks" },
  { value: "merchandise", label: "General Merchandise" },
];

/** item_type values that map to each tab */
export const TAB_ITEM_TYPES: Record<ProductTab, string[]> = {
  textbooks: ["textbook"],
  merchandise: ["general_merchandise", "supplies", "other"],
};

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  tab: "textbooks",
  minPrice: "",
  maxPrice: "",
  vendorId: "",
  hasBarcode: false,
  lastSaleDateFrom: "",
  lastSaleDateTo: "",
  author: "",
  hasIsbn: false,
  edition: "",
  catalogNumber: "",
  productType: "",
  page: 1,
};

/** sessionStorage key for transferring selected products to invoice/quote forms */
export const CATALOG_ITEMS_STORAGE_KEY = "catalog-selected-items";
