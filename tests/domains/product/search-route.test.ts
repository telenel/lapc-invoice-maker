import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, PAGE_SIZE } from "@/domains/product/constants";
import { INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT } from "@/domains/product/inventory-mirror-state";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRawUnsafe: vi.fn(),
    quickPickSection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  buildProductBrowseRow,
  buildProductLocationVariance,
  searchProductBrowseRows,
  type ProductInventorySliceRow,
} from "@/domains/product/search-route";
import type { Product, ProductBrowseRow, ProductBrowseSearchResult } from "@/domains/product/types";

function buildBaseProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: 101,
    barcode: "123",
    item_type: "general_merchandise",
    description: "Pierce mug",
    author: null,
    title: null,
    isbn: null,
    edition: null,
    retail_price: 19.99,
    cost: 8.5,
    stock_on_hand: 10,
    catalog_number: null,
    vendor_id: 21,
    dcc_id: 7,
    product_type: null,
    color_id: 0,
    created_at: null,
    updated_at: "2026-04-20T00:00:00.000Z",
    last_sale_date: "2026-04-18T00:00:00.000Z",
    synced_at: "2026-04-20T00:00:00.000Z",
    dept_num: null,
    class_num: null,
    cat_num: null,
    dept_name: null,
    class_name: null,
    cat_name: null,
    units_sold_30d: 12,
    units_sold_90d: 20,
    units_sold_1y: 42,
    units_sold_3y: 70,
    units_sold_lifetime: 100,
    revenue_30d: 240,
    revenue_90d: 400,
    revenue_1y: 840,
    revenue_3y: 1400,
    revenue_lifetime: 2000,
    txns_1y: 14,
    txns_lifetime: 30,
    first_sale_date_computed: null,
    last_sale_date_computed: "2026-04-19T00:00:00.000Z",
    sales_aggregates_computed_at: null,
    effective_last_sale_date: "2026-04-18T00:00:00.000Z",
    aggregates_ready: true,
    margin_ratio: null,
    stock_coverage_days: null,
    trend_direction: null,
    discontinued: false,
    ...overrides,
  };
}

describe("buildProductLocationVariance", () => {
  it("reports whether selected location values differ", () => {
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 19.99,
        cost: 8.5,
        stockOnHand: 10,
        lastSaleDate: "2026-04-18T00:00:00.000Z",
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 21.99,
        cost: 8.5,
        stockOnHand: 4,
        lastSaleDate: "2026-04-17T00:00:00.000Z",
      },
    ];

    expect(buildProductLocationVariance(slices)).toEqual({
      retailPriceVaries: true,
      costVaries: false,
      stockVaries: true,
      lastSaleDateVaries: true,
    });
  });
});

describe("buildProductBrowseRow", () => {
  it("copies the primary-location values into the legacy product fields and computes variance", () => {
    const base = buildBaseProduct();
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 19.99,
        cost: 8.5,
        stockOnHand: 10,
        lastSaleDate: "2026-04-18T00:00:00.000Z",
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 21.99,
        cost: 8.5,
        stockOnHand: 4,
        lastSaleDate: "2026-04-17T00:00:00.000Z",
      },
    ];

    const row: ProductBrowseRow = buildProductBrowseRow(base, slices, [2, 3]);

    expect(row.primary_location_id).toBe(2);
    expect(row.primary_location_abbrev).toBe("PIER");
    expect(row.retail_price).toBe(19.99);
    expect(row.cost).toBe(8.5);
    expect(row.stock_on_hand).toBe(10);
    expect(row.last_sale_date).toBe("2026-04-18T00:00:00.000Z");
    expect(row.effective_last_sale_date).toBe("2026-04-18T00:00:00.000Z");
    expect(row.location_variance).toEqual({
      retailPriceVaries: true,
      costVaries: false,
      stockVaries: true,
      lastSaleDateVaries: true,
    });
    expect(row.selected_inventories).toEqual(slices);
    expect(row.selected_inventories).not.toBe(slices);
    expect(row.selected_inventories[0]).not.toBe(slices[0]);
  });

  it("preserves the base effective sale-date chain when the primary slice has no last sale", () => {
    const base = buildBaseProduct({
      last_sale_date: "2026-04-11T00:00:00.000Z",
      effective_last_sale_date: "2026-04-12T00:00:00.000Z",
    });
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 23.99,
        cost: 9.25,
        stockOnHand: 3,
        lastSaleDate: null,
      },
      {
        locationId: 4,
        locationAbbrev: "PFS",
        retailPrice: 23.99,
        cost: 9.25,
        stockOnHand: 3,
        lastSaleDate: "2026-04-10T00:00:00.000Z",
      },
    ];

    const row = buildProductBrowseRow(base, slices, [3, 4]);

    expect(row.primary_location_id).toBe(3);
    expect(row.primary_location_abbrev).toBe("PCOP");
    expect(row.last_sale_date).toBeNull();
    expect(row.effective_last_sale_date).toBe("2026-04-12T00:00:00.000Z");
  });

  it("keeps legacy values when the selected primary location is missing from the slices", () => {
    const base = buildBaseProduct({
      retail_price: 15.5,
      cost: 5.25,
      stock_on_hand: 9,
      last_sale_date: "2026-04-08T00:00:00.000Z",
      effective_last_sale_date: "2026-04-09T00:00:00.000Z",
    });
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 4,
        locationAbbrev: "PFS",
        retailPrice: 18.5,
        cost: 6.25,
        stockOnHand: 1,
        lastSaleDate: "2026-04-05T00:00:00.000Z",
      },
    ];

    const row = buildProductBrowseRow(base, slices, [2, 4]);

    expect(row.primary_location_id).toBeNull();
    expect(row.primary_location_abbrev).toBeNull();
    expect(row.retail_price).toBe(15.5);
    expect(row.cost).toBe(5.25);
    expect(row.stock_on_hand).toBe(9);
    expect(row.last_sale_date).toBe("2026-04-08T00:00:00.000Z");
    expect(row.effective_last_sale_date).toBe("2026-04-09T00:00:00.000Z");
    expect(row.location_variance).toEqual({
      retailPriceVaries: false,
      costVaries: false,
      stockVaries: false,
      lastSaleDateVaries: false,
    });
  });
});

describe("searchProductBrowseRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quickPickSection.findMany.mockResolvedValue([]);
  });

  function mockSearchQueryRows(
    baseRowOverrides: Partial<Record<string, unknown>> = {},
    inventoryRows: Array<Record<string, unknown>> = [
      {
        sku: 101,
        location_id: 2,
        location_abbrev: "PIER",
        retail_price: 19.99,
        cost: 8.5,
        stock_on_hand: 10,
        last_sale_date: new Date("2026-04-18T00:00:00.000Z"),
      },
      {
        sku: 101,
        location_id: 3,
        location_abbrev: "PCOP",
        retail_price: 21.99,
        cost: 9.25,
        stock_on_hand: 4,
        last_sale_date: new Date("2026-04-17T00:00:00.000Z"),
      },
    ],
  ) {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          sku: 101,
          barcode: "123",
          item_type: "general_merchandise",
          description: "Pierce mug",
          author: null,
          title: null,
          isbn: null,
          edition: null,
          retail_price: 19.99,
          cost: 8.5,
          stock_on_hand: 10,
          catalog_number: "MUG-101",
          vendor_id: 21,
          dcc_id: 7,
          product_type: "Drinkware",
          color_id: 0,
          created_at: null,
          updated_at: new Date("2026-04-20T00:00:00.000Z"),
          last_sale_date: new Date("2026-04-18T00:00:00.000Z"),
          synced_at: new Date("2026-04-20T00:00:00.000Z"),
          dept_num: 10,
          class_num: 20,
          cat_num: 30,
          dept_name: "GM",
          class_name: "Drinkware",
          cat_name: "Mugs",
          units_sold_30d: 12,
          units_sold_90d: 20,
          units_sold_1y: 42,
          units_sold_3y: 70,
          units_sold_lifetime: 100,
          revenue_30d: 240,
          revenue_90d: 400,
          revenue_1y: 840,
          revenue_3y: 1400,
          revenue_lifetime: 2000,
          txns_1y: 14,
          txns_lifetime: 30,
          first_sale_date_computed: null,
          last_sale_date_computed: new Date("2026-04-19T00:00:00.000Z"),
          sales_aggregates_computed_at: null,
          effective_last_sale_date: new Date("2026-04-19T00:00:00.000Z"),
          aggregates_ready: true,
          margin_ratio: 0.5747,
          stock_coverage_days: 25,
          trend_direction: "steady",
          discontinued: false,
          ...baseRowOverrides,
        },
      ])
      .mockResolvedValueOnce([{ total: 1n }])
      .mockResolvedValueOnce(inventoryRows);
  }

  it("returns browse rows built from the selected-location slices and counts visible SKUs", async () => {
    mockSearchQueryRows();

    const result = await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      search: "mug",
      page: 2,
      sortBy: "retail_price",
    });

    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledTimes(3);
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(PAGE_SIZE);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      sku: 101,
      retail_price: 19.99,
      cost: 8.5,
      stock_on_hand: 10,
      primary_location_id: 2,
      primary_location_abbrev: "PIER",
      selected_inventories: [
        expect.objectContaining({ locationId: 2, retailPrice: 19.99 }),
        expect.objectContaining({ locationId: 3, retailPrice: 21.99 }),
      ],
      location_variance: {
        retailPriceVaries: true,
        costVaries: true,
        stockVaries: true,
        lastSaleDateVaries: true,
      },
    });
  });

  it("keeps invalidated primary rows visible without falling back to legacy PIER values", async () => {
    mockSearchQueryRows(
      {
        retail_price: null,
        cost: null,
        stock_on_hand: null,
        last_sale_date: null,
        effective_last_sale_date: null,
        primary_location_requested_id: 3,
      },
      [
        {
          sku: 101,
          location_id: 4,
          location_abbrev: "PFS",
          retail_price: 18.5,
          cost: 6.25,
          stock_on_hand: 1,
          last_sale_date: new Date("2026-04-05T00:00:00.000Z"),
        },
      ],
    );

    const result = await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [3, 4],
      sortBy: "retail_price",
    });

    expect(result.products[0]).toMatchObject({
      primary_location_id: null,
      primary_location_abbrev: null,
      retail_price: null,
      cost: null,
      stock_on_hand: null,
      last_sale_date: null,
      effective_last_sale_date: null,
    });
    expect(result.products[0]?.selected_inventories.map((slice) => slice.locationId)).toEqual([4]);

    const browseSql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof browseSql).toBe("string");
    expect(browseSql).not.toContain("inv.synced_at >");
    expect(browseSql).toContain("pi.synced_at >");
    expect(prismaMock.$queryRawUnsafe.mock.calls[0]?.slice(1)).toContain(
      INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT,
    );

    const inventorySql = prismaMock.$queryRawUnsafe.mock.calls[2]?.[0];
    expect(typeof inventorySql).toBe("string");
    expect(inventorySql).toContain("AND synced_at >");
    expect(prismaMock.$queryRawUnsafe.mock.calls[2]?.slice(1)).toContain(
      INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT,
    );
  });

  it("keeps selected-location SKUs visible even when every selected slice is invalidated", async () => {
    mockSearchQueryRows(
      {
        retail_price: null,
        cost: null,
        stock_on_hand: null,
        last_sale_date: null,
        effective_last_sale_date: null,
        primary_location_requested_id: 3,
      },
      [],
    );

    const result = await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [3],
      sortBy: "retail_price",
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      primary_location_id: null,
      primary_location_abbrev: null,
      retail_price: null,
      cost: null,
      stock_on_hand: null,
      last_sale_date: null,
      effective_last_sale_date: null,
      selected_inventories: [],
    });
  });

  it("uses the non-derived products source for simple browse queries", async () => {
    mockSearchQueryRows();

    await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      search: "mug",
      sortBy: "retail_price",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("FROM products pwd");
    expect(sql).not.toContain("FROM products_with_derived pwd");
  });

  it("uses the derived source when the browse query needs derived semantics", async () => {
    mockSearchQueryRows();

    await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      sortBy: "days_since_sale",
      editedSinceSync: true,
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("FROM products_with_derived pwd");
  });

  it("supports a true count-only path that skips browse-row and inventory queries", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 9n }]);

    const result = await searchProductBrowseRows(
      {
        ...EMPTY_FILTERS,
        tab: "merchandise",
        locationIds: [2, 3],
        search: "mug",
      },
      { countOnly: true },
    );

    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("SELECT COUNT(*) AS total");
    expect(result).toEqual({
      products: [],
      total: 9,
      page: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("uses the configured quick-pick section predicate instead of tab item-type buckets", async () => {
    prismaMock.quickPickSection.findMany.mockResolvedValue([
      {
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [],
        includeDiscontinued: false,
      },
    ]);
    mockSearchQueryRows();

    await searchProductBrowseRows(
      {
        ...EMPTY_FILTERS,
        tab: "quickPicks",
        sectionSlug: "copytech-services",
      },
      { role: "user" },
    );

    expect(prismaMock.quickPickSection.findMany).toHaveBeenCalledWith({
      where: {
        isGlobal: true,
        slug: "copytech-services",
      },
      select: {
        descriptionLike: true,
        dccIds: true,
        vendorIds: true,
        itemType: true,
        explicitSkus: true,
        includeDiscontinued: true,
      },
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("pwd.description ILIKE");
    expect(sql).not.toContain("pwd.item_type IN (");
  });

  it("treats a stale quick-pick section slug as an empty result set", async () => {
    prismaMock.quickPickSection.findMany.mockResolvedValue([]);

    const result = await searchProductBrowseRows(
      {
        ...EMPTY_FILTERS,
        tab: "quickPicks",
        sectionSlug: "missing-section",
      },
      { role: "user" },
    );

    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(result).toEqual({
      products: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("unions all visible non-empty quick-pick sections for the quick-picks tab", async () => {
    prismaMock.quickPickSection.findMany.mockResolvedValue([
      {
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [],
        includeDiscontinued: false,
      },
      {
        descriptionLike: null,
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [],
        includeDiscontinued: false,
      },
      {
        descriptionLike: null,
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [2501],
        includeDiscontinued: true,
      },
    ]);
    mockSearchQueryRows();

    await searchProductBrowseRows(
      {
        ...EMPTY_FILTERS,
        tab: "quickPicks",
        allSections: true,
      },
      { role: "admin" },
    );

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("pwd.description ILIKE");
    expect(sql).toContain("pwd.sku = ANY");
    expect(sql).toContain("OR");
    expect(sql).not.toContain("FALSE");
  });

  it("preserves nullable ids and nullable price fields instead of coercing them to zero", async () => {
    mockSearchQueryRows(
      {
        retail_price: null,
        cost: null,
        vendor_id: null,
        dcc_id: null,
        color_id: null,
      },
      [
        {
          sku: 101,
          location_id: 2,
          location_abbrev: "PIER",
          retail_price: null,
          cost: null,
          stock_on_hand: 10,
          last_sale_date: new Date("2026-04-18T00:00:00.000Z"),
        },
      ],
    );

    const result = await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2],
    });

    const row = result.products[0] as ProductBrowseSearchResult["products"][number];
    expect(row.retail_price).toBeNull();
    expect(row.cost).toBeNull();
    expect(row.vendor_id).toBeNull();
    expect(row.dcc_id).toBeNull();
    expect(row.color_id).toBeNull();
  });

  it("adds a DCC composite OR branch when search is a 4-8 digit code", async () => {
    mockSearchQueryRows();

    await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      search: "301010",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    // Still matches existing numeric modes.
    expect(sql).toContain("pwd.sku =");
    expect(sql).toContain("pwd.barcode ILIKE");
    // Adds composite DCC match against dept/class/cat concat.
    expect(sql).toContain("pwd.dept_num::text");
    expect(sql).toContain("pwd.class_num::text");
    expect(sql).toContain("pwd.cat_num::text");
  });

  it("parses dashed DCC search into dept/class/cat equality conditions", async () => {
    mockSearchQueryRows();

    await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      search: "30-10-10",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("pwd.dept_num =");
    expect(sql).toContain("pwd.class_num =");
    expect(sql).toContain("pwd.cat_num =");
  });

  it("does not trigger DCC composite matching for short numeric input", async () => {
    mockSearchQueryRows();

    await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      search: "30",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    // Still uses existing numeric branch (SKU/barcode/isbn/catalog prefix).
    expect(sql).toContain("pwd.sku =");
    // But no composite concat for short inputs.
    expect(sql).not.toContain("pwd.dept_num::text");
  });

  it("applies dccComposite filter by resolving it into segment equality predicates", async () => {
    mockSearchQueryRows();

    await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 3],
      dccComposite: "30-10-10",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("pwd.dept_num =");
    expect(sql).toContain("pwd.class_num =");
    expect(sql).toContain("pwd.cat_num =");
    const params = prismaMock.$queryRawUnsafe.mock.calls[0]?.slice(1);
    expect(params).toEqual(expect.arrayContaining([30, 10, 10]));
  });

  it("uses fallback expressions for primary-location filters and sorts when the primary slice is missing", async () => {
    mockSearchQueryRows(
      {
        retail_price: 15.5,
        cost: 5.25,
        stock_on_hand: 9,
        last_sale_date: new Date("2026-04-08T00:00:00.000Z"),
        effective_last_sale_date: new Date("2026-04-09T00:00:00.000Z"),
      },
      [
        {
          sku: 101,
          location_id: 4,
          location_abbrev: "PFS",
          retail_price: 18.5,
          cost: 6.25,
          stock_on_hand: 1,
          last_sale_date: new Date("2026-04-05T00:00:00.000Z"),
        },
      ],
    );

    const result = await searchProductBrowseRows({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      locationIds: [2, 4],
      minPrice: "15",
      minStock: "9",
      sortBy: "last_sale_date",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("COALESCE(pi.retail_price, CASE WHEN pi_scope.location_id IS NULL THEN pwd.retail_price END)");
    expect(sql).toContain("COALESCE(pi.stock_on_hand, CASE WHEN pi_scope.location_id IS NULL THEN pwd.stock_on_hand END)");
    expect(sql).toContain("COALESCE(pi.last_sale_date, CASE WHEN pi_scope.location_id IS NULL THEN pwd.last_sale_date END)");
    expect(result.products[0]).toMatchObject({
      retail_price: 15.5,
      stock_on_hand: 9,
      last_sale_date: "2026-04-08T00:00:00.000Z",
      effective_last_sale_date: "2026-04-09T00:00:00.000Z",
    });
  });
});
