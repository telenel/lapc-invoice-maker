import type { ColumnPreferences, PresetGroup, ProductFilters, SavedView } from "./types";

type PresetSeed = {
  slug: string;
  name: string;
  description: string;
  presetGroup: PresetGroup;
  sortOrder: number;
  filter: Partial<ProductFilters>;
  columnPreferences: ColumnPreferences;
};

export const SYSTEM_PRESETS: PresetSeed[] = [
  // 💀 Dead weight
  { slug: "dead-discontinued-with-stock", name: "Discontinued with stock", description: "Items marked discontinued that still have stock on hand.",
    presetGroup: "dead-weight", sortOrder: 10,
    filter: { discontinued: "yes", minStock: "1" },
    columnPreferences: { visible: ["stock", "updated"] } },
  { slug: "dead-never-sold", name: "Never sold", description: "Items with no recorded last-sale date at Pierce.",
    presetGroup: "dead-weight", sortOrder: 20,
    filter: { lastSaleNever: true },
    columnPreferences: { visible: ["stock", "est_sales", "updated"] } },
  { slug: "dead-no-sales-2y", name: "No sales in 2 years", description: "Last sold more than 2 years ago.",
    presetGroup: "dead-weight", sortOrder: 30,
    filter: { lastSaleOlderThan: "2y" },
    columnPreferences: { visible: ["days_since_sale", "stock"] } },
  { slug: "dead-no-sales-5y", name: "No sales in 5 years", description: "Last sold more than 5 years ago.",
    presetGroup: "dead-weight", sortOrder: 40,
    filter: { lastSaleOlderThan: "5y" },
    columnPreferences: { visible: ["days_since_sale", "stock"] } },
  { slug: "dead-zero-stock-never-sold", name: "Zero stock + never sold", description: "No stock AND never sold — strongest dead-weight signal.",
    presetGroup: "dead-weight", sortOrder: 50,
    filter: { maxStock: "0", lastSaleNever: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "dead-discontinued", name: "Discontinued", description: "All discontinued items (active or zero stock).",
    presetGroup: "dead-weight", sortOrder: 60,
    filter: { discontinued: "yes" },
    columnPreferences: { visible: ["stock", "updated"] } },

  // 📊 Movers
  { slug: "movers-last-30d", name: "Sold in last 30 days", description: "Items with a sale in the trailing 30 days.",
    presetGroup: "movers", sortOrder: 10,
    filter: { lastSaleWithin: "30d" },
    columnPreferences: { visible: ["est_sales", "stock"] } },
  { slug: "movers-last-90d", name: "Sold in last 90 days", description: "Items with a sale in the trailing 90 days.",
    presetGroup: "movers", sortOrder: 20,
    filter: { lastSaleWithin: "90d" },
    columnPreferences: { visible: ["est_sales", "stock"] } },
  { slug: "movers-proven-sellers", name: "Proven sellers", description: "Sold in 90 days, still active, still have stock. Weak velocity proxy until PR #2 ships real time-series data.",
    presetGroup: "movers", sortOrder: 30,
    filter: { lastSaleWithin: "90d", discontinued: "no", minStock: "1" },
    columnPreferences: { visible: ["est_sales", "stock", "margin"] } },

  // 🔍 Data quality
  { slug: "data-missing-barcode", name: "Missing barcode", description: "Items with no barcode on file.",
    presetGroup: "data-quality", sortOrder: 10,
    filter: { missingBarcode: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-missing-isbn-textbook", name: "Missing ISBN (textbooks)", description: "Textbooks with no ISBN.",
    presetGroup: "data-quality", sortOrder: 20,
    filter: { tab: "textbooks", missingIsbn: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-missing-title-or-description", name: "Missing description or title", description: "Textbooks without a title, or general merchandise without a description.",
    presetGroup: "data-quality", sortOrder: 30,
    filter: { missingTitle: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-retail-below-cost", name: "Retail < cost", description: "Retail price lower than cost. Usually a data entry error.",
    presetGroup: "data-quality", sortOrder: 40,
    filter: { retailBelowCost: true },
    columnPreferences: { visible: ["margin", "updated"] } },
  { slug: "data-zero-price", name: "Retail or cost = 0", description: "Retail or cost is exactly zero.",
    presetGroup: "data-quality", sortOrder: 50,
    filter: { zeroPrice: true },
    columnPreferences: { visible: ["updated"] } },

  // 💰 Pricing
  { slug: "pricing-gm-under-5", name: "GM under $5", description: "General merchandise priced under $5.",
    presetGroup: "pricing", sortOrder: 10,
    filter: { tab: "merchandise", maxPrice: "5" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-gm-over-50", name: "GM over $50", description: "General merchandise priced over $50.",
    presetGroup: "pricing", sortOrder: 20,
    filter: { tab: "merchandise", minPrice: "50" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-textbooks-over-100", name: "Textbooks over $100", description: "Textbooks priced over $100.",
    presetGroup: "pricing", sortOrder: 30,
    filter: { tab: "textbooks", minPrice: "100" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-high-margin", name: "High margin", description: "Margin above 40%.",
    presetGroup: "pricing", sortOrder: 40,
    filter: { minMargin: "0.4" },
    columnPreferences: { visible: ["margin", "est_sales"] } },
  { slug: "pricing-thin-margin", name: "Thin margin", description: "Margin below 10%.",
    presetGroup: "pricing", sortOrder: 50,
    filter: { maxMargin: "0.1" },
    columnPreferences: { visible: ["margin", "est_sales"] } },

  // 📝 Recent activity
  { slug: "recent-edited-7d", name: "Edited in last 7 days", description: "Items modified in the past week.",
    presetGroup: "recent-activity", sortOrder: 10,
    filter: { editedWithin: "7d" },
    columnPreferences: { visible: ["updated"] } },
  { slug: "recent-edited-since-sync", name: "Edited since last sync", description: "Items whose row was touched after the mirror was last refreshed.",
    presetGroup: "recent-activity", sortOrder: 20,
    filter: { editedSinceSync: true },
    columnPreferences: { visible: ["updated"] } },

  // 📚 Textbook
  { slug: "textbook-used-only", name: "Used textbooks only", description: "Only used-copy textbook SKUs.",
    presetGroup: "textbook", sortOrder: 10,
    filter: { itemType: "used_textbook" },
    columnPreferences: { visible: ["est_sales"] } },
];

export function presetSeedToSavedView(seed: PresetSeed): SavedView {
  return {
    id: seed.slug,
    name: seed.name,
    description: seed.description,
    filter: seed.filter,
    columnPreferences: seed.columnPreferences,
    isSystem: true,
    slug: seed.slug,
    presetGroup: seed.presetGroup,
    sortOrder: seed.sortOrder,
  };
}

export const SYSTEM_PRESET_VIEWS: SavedView[] = SYSTEM_PRESETS.map(presetSeedToSavedView);
