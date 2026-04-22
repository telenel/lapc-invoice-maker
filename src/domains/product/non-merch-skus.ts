// Prism's system-level non-merchandise SKUs. These are not real products —
// they exist so the POS can post shipping fees (SKU 1) and gift-certificate
// sales (SKU 2) as line items on a receipt. They must not appear in
// product-performance analytics (top sellers, category mix, trends, etc.).
//
// The mirror still keeps faithful copies of these rows in `sales_transactions`
// and `products`; this list is only for read-side business filters.
export const NON_MERCH_SKUS = [1, 2] as const;

// Department / category names that Prism uses for non-merchandise line items.
// Sourced from docs/prism/ref-data-snapshot-2026-04-19.json — the DCC
// departments `SHIPPING`, `WEB SHIPPING`, and `GIFT`. Compared case-insensitively
// in SQL so future Prism-added system SKUs attached to these departments are
// excluded without a code change.
export const NON_MERCH_DEPT_NAMES = ["SHIPPING", "WEB SHIPPING", "GIFT"] as const;
