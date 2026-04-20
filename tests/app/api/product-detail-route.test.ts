import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolveEditDialogMode } from "@/components/products/edit-item-dialog-mode";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

const prismMocks = vi.hoisted(() => ({
  isPrismConfigured: vi.fn(),
  discontinueItem: vi.fn(),
  deleteTestItem: vi.fn(),
  updateGmItem: vi.fn(),
  updateTextbookPricing: vi.fn(),
  getItemSnapshot: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/supabase/admin", () => supabaseMocks);

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockInventoryIn = vi.fn();
const mockInventoryEq = vi.fn(() => ({ in: mockInventoryIn }));
const mockInventorySelect = vi.fn(() => ({ eq: mockInventoryEq }));
const mockUpsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "product_inventory") {
    return {
      select: mockInventorySelect,
    };
  }
  return {
    select: mockSelect,
    upsert: mockUpsert,
  };
});

function mockDefaultPrismModules() {
  vi.doMock("@/lib/prism", () => ({
    isPrismConfigured: prismMocks.isPrismConfigured,
  }));
  vi.doMock("@/domains/product/prism-server", () => ({
    discontinueItem: prismMocks.discontinueItem,
    deleteTestItem: prismMocks.deleteTestItem,
  }));
  vi.doMock("@/domains/product/prism-updates", () => ({
    updateGmItem: prismMocks.updateGmItem,
    updateTextbookPricing: prismMocks.updateTextbookPricing,
    getItemSnapshot: prismMocks.getItemSnapshot,
  }));
}

async function loadRouteModule() {
  return import("@/app/api/products/[sku]/route");
}

describe("GET /api/products/[sku]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDefaultPrismModules();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    prismMocks.isPrismConfigured.mockReturnValue(true);
    mockUpsert.mockResolvedValue({ error: null });
    mockInventoryIn.mockResolvedValue({ data: [], error: null });
  });

  it("returns 401 when the caller is unauthenticated", async () => {
    nextAuthMocks.getServerSession.mockResolvedValue(null);
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1001"),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects invalid SKUs with 400", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/not-a-number"),
      { params: Promise.resolve({ sku: "not-a-number" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid SKU" });
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 404 when the product row is absent", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1001"),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Item not found" });
  });

  it("loads and serves GET without importing the Prism stack", async () => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        sku: 1001,
        item_type: "general_merchandise",
        description: "Pierce Hoodie",
        barcode: null,
        vendor_id: null,
        dcc_id: null,
        item_tax_type_id: null,
        catalog_number: null,
        tx_comment: null,
        retail_price: null,
        cost: null,
        discontinued: false,
        alt_vendor_id: null,
        mfg_id: null,
        weight: null,
        package_type: null,
        units_per_pack: null,
        order_increment: null,
        image_url: null,
        size: null,
        size_id: null,
        color_id: null,
        style_id: null,
        item_season_code_id: null,
        f_list_price_flag: null,
        f_perishable: null,
        f_id_required: null,
        min_order_qty_item: null,
        used_dcc_id: null,
      },
      error: null,
    });

    vi.doMock("@/lib/prism", () => {
      throw new Error("GET should not import @/lib/prism");
    });
    vi.doMock("@/domains/product/prism-server", () => {
      throw new Error("GET should not import prism-server");
    });
    vi.doMock("@/domains/product/prism-updates", () => {
      throw new Error("GET should not import prism-updates");
    });

    const productDetailRoute = await loadRouteModule();
    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1001"),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).sku).toBe(1001);
  });

  it("returns an edit snapshot with the richer Phase 4 global fields", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        sku: 1001,
        item_type: "general_merchandise",
        description: "Pierce Hoodie",
        barcode: "123456789012",
        vendor_id: 42,
        dcc_id: 1701,
        item_tax_type_id: 6,
        catalog_number: "HD-1001",
        tx_comment: "Front window",
        retail_price: null,
        cost: 22.5,
        discontinued: false,
        alt_vendor_id: 77,
        mfg_id: 88,
        weight: 1.25,
        package_type: "EA",
        units_per_pack: 1,
        order_increment: 2,
        image_url: "https://cdn.example.test/hoodie.png",
        size: "L",
        size_id: 9,
        color_id: 4,
        style_id: 5,
        item_season_code_id: 12,
        f_list_price_flag: true,
        f_perishable: false,
        f_id_required: true,
        min_order_qty_item: 3,
        used_dcc_id: 1802,
      },
      error: null,
    });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1001"),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sku: 1001,
      itemType: "general_merchandise",
      description: "Pierce Hoodie",
      barcode: "123456789012",
      vendorId: 42,
      dccId: 1701,
      itemTaxTypeId: 6,
      catalogNumber: "HD-1001",
      comment: "Front window",
      retail: null,
      cost: 22.5,
      fDiscontinue: 0,
      altVendorId: 77,
      mfgId: 88,
      weight: 1.25,
      packageType: "EA",
      unitsPerPack: 1,
      orderIncrement: 2,
      imageUrl: "https://cdn.example.test/hoodie.png",
      size: "L",
      sizeId: 9,
      colorId: 4,
      styleId: 5,
      itemSeasonCodeId: 12,
      fListPriceFlag: true,
      fPerishable: false,
      fIdRequired: true,
      minOrderQtyItem: 3,
      usedDccId: 1802,
      inventoryByLocation: [
        {
          locationId: 2,
          locationAbbrev: "PIER",
          retail: null,
          cost: null,
          expectedCost: null,
          stockOnHand: null,
          lastSaleDate: null,
          tagTypeId: null,
          statusCodeId: null,
          estSales: null,
          estSalesLocked: false,
          fInvListPriceFlag: false,
          fTxWantListFlag: false,
          fTxBuybackListFlag: false,
          fNoReturns: false,
        },
        {
          locationId: 3,
          locationAbbrev: "PCOP",
          retail: null,
          cost: null,
          expectedCost: null,
          stockOnHand: null,
          lastSaleDate: null,
          tagTypeId: null,
          statusCodeId: null,
          estSales: null,
          estSalesLocked: false,
          fInvListPriceFlag: false,
          fTxWantListFlag: false,
          fTxBuybackListFlag: false,
          fNoReturns: false,
        },
        {
          locationId: 4,
          locationAbbrev: "PFS",
          retail: null,
          cost: null,
          expectedCost: null,
          stockOnHand: null,
          lastSaleDate: null,
          tagTypeId: null,
          statusCodeId: null,
          estSales: null,
          estSalesLocked: false,
          fInvListPriceFlag: false,
          fTxWantListFlag: false,
          fTxBuybackListFlag: false,
          fNoReturns: false,
        },
      ],
    });
  });

  it("hydrates textbook detail fields from the products mirror", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        sku: 1002,
        item_type: "textbook",
        description: "Intro Biology",
        barcode: "9781234567890",
        vendor_id: 42,
        dcc_id: 1701,
        item_tax_type_id: 6,
        catalog_number: "BIO-1002",
        tx_comment: null,
        retail_price: 89.5,
        cost: 52.25,
        discontinued: false,
        alt_vendor_id: null,
        mfg_id: null,
        weight: null,
        package_type: null,
        units_per_pack: null,
        order_increment: null,
        image_url: null,
        size: null,
        size_id: null,
        color_id: null,
        style_id: null,
        item_season_code_id: null,
        f_list_price_flag: null,
        f_perishable: null,
        f_id_required: null,
        min_order_qty_item: null,
        used_dcc_id: null,
        author: "Jane Doe",
        title: "Intro Biology",
        isbn: "9781234567890",
        edition: "3",
        binding_id: 15,
        imprint: "PEARSON",
        copyright: "26",
        text_status_id: 7,
        status_date: "2026-04-20",
        book_key: "BIO-KEY-1",
      },
      error: null,
    });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1002"),
      { params: Promise.resolve({ sku: "1002" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        itemType: "textbook",
        author: "Jane Doe",
        title: "Intro Biology",
        isbn: "9781234567890",
        edition: "3",
        bindingId: 15,
        imprint: "PEARSON",
        copyright: "26",
      }),
    );
  });

  it("hydrates all Pierce inventory slices in canonical order", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        sku: 1001,
        item_type: "general_merchandise",
        description: "Pierce Hoodie",
        barcode: "123456789012",
        vendor_id: 42,
        dcc_id: 1701,
        item_tax_type_id: 6,
        catalog_number: "HD-1001",
        tx_comment: "Front window",
        retail_price: 11.99,
        cost: 22.5,
        discontinued: false,
        alt_vendor_id: 77,
        mfg_id: 88,
        weight: 1.25,
        package_type: "EA",
        units_per_pack: 1,
        order_increment: 2,
        image_url: "https://cdn.example.test/hoodie.png",
        size: "L",
        size_id: 9,
        color_id: 4,
        style_id: 5,
        item_season_code_id: 12,
        f_list_price_flag: true,
        f_perishable: false,
        f_id_required: true,
        min_order_qty_item: 3,
        used_dcc_id: 1802,
      },
      error: null,
    });
    mockInventoryIn.mockResolvedValueOnce({
      data: [
        {
          location_id: 4,
          location_abbrev: "STALE-PFS",
          retail_price: null,
          cost: null,
          expected_cost: null,
          stock_on_hand: null,
          last_sale_date: null,
          tag_type_id: null,
          status_code_id: null,
          est_sales: null,
          est_sales_locked: false,
          f_inv_list_price_flag: false,
          f_tx_want_list_flag: false,
          f_tx_buyback_list_flag: false,
          f_no_returns: false,
        },
        {
          location_id: 2,
          location_abbrev: null,
          retail_price: 12.99,
          cost: 7.5,
          expected_cost: 7.25,
          stock_on_hand: 14,
          last_sale_date: "2026-04-18T00:00:00.000Z",
          tag_type_id: 17,
          status_code_id: 31,
          est_sales: 3,
          est_sales_locked: true,
          f_inv_list_price_flag: true,
          f_tx_want_list_flag: false,
          f_tx_buyback_list_flag: false,
          f_no_returns: false,
        },
      ],
      error: null,
    });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1001"),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.inventoryByLocation).toEqual([
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retail: 12.99,
        cost: 7.5,
        expectedCost: 7.25,
        stockOnHand: 14,
        lastSaleDate: "2026-04-18T00:00:00.000Z",
        tagTypeId: 17,
        statusCodeId: 31,
        estSales: 3,
        estSalesLocked: true,
        fInvListPriceFlag: true,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retail: null,
        cost: null,
        expectedCost: null,
        stockOnHand: null,
        lastSaleDate: null,
        tagTypeId: null,
        statusCodeId: null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
      {
        locationId: 4,
        locationAbbrev: "PFS",
        retail: null,
        cost: null,
        expectedCost: null,
        stockOnHand: null,
        lastSaleDate: null,
        tagTypeId: null,
        statusCodeId: null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
    ]);
  });
});

describe("PATCH /api/products/[sku]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDefaultPrismModules();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    prismMocks.isPrismConfigured.mockReturnValue(true);
    prismMocks.updateGmItem.mockResolvedValue({
      sku: 1001,
      appliedFields: [
        "description",
        "vendorId",
        "dccId",
        "itemTaxTypeId",
        "catalogNumber",
        "comment",
        "weight",
        "imageUrl",
        "unitsPerPack",
        "packageType",
        "barcode",
        "retail",
        "cost",
        "fDiscontinue",
      ],
    });
    prismMocks.getItemSnapshot.mockResolvedValue({
      sku: 1001,
      barcode: "123456789012",
      retail: 19.95,
      cost: 8.5,
      fDiscontinue: 1,
    });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("mirrors the currently editable legacy product fields into Supabase", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          patch: {
            description: "Updated Hoodie",
            vendorId: 42,
            dccId: 1701,
            itemTaxTypeId: 6,
            catalogNumber: "HD-1001",
            comment: "Front window",
            weight: 1.25,
            imageUrl: "https://cdn.example.test/hoodie.png",
            unitsPerPack: 4,
            packageType: "EA",
            barcode: "123456789012",
            retail: 19.95,
            cost: 8.5,
            fDiscontinue: 1,
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      description: "Updated Hoodie",
      vendor_id: 42,
      dcc_id: 1701,
      item_tax_type_id: 6,
      catalog_number: "HD-1001",
      tx_comment: "Front window",
      weight: 1.25,
      image_url: "https://cdn.example.test/hoodie.png",
      units_per_pack: 4,
      package_type: "EA",
      barcode: "123456789012",
      retail_price: 19.95,
      cost: 8.5,
      discontinued: true,
      synced_at: expect.any(String),
    }));
  });
});

describe("resolveEditDialogMode", () => {
  it("routes single textbook selections to v2", () => {
    expect(
      resolveEditDialogMode({
        featureFlagEnabled: false,
        override: null,
        hasTextbookSelection: true,
        selectionCount: 1,
      } as never),
    ).toBe("v2");
  });
});
