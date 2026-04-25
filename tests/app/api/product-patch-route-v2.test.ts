import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT } from "@/domains/product/inventory-mirror-state";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

const prismMocks = vi.hoisted(() => ({
  isPrismConfigured: vi.fn(),
  updateGmItem: vi.fn(),
  updateTextbookPricing: vi.fn(),
  getItemSnapshot: vi.fn(),
  getInventoryMirrorSnapshotRows: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/supabase/admin", () => supabaseMocks);

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockProductsUpsert = vi.fn();
const mockProductInventoryUpsert = vi.fn();
const mockProductInventoryUpdateIn = vi.fn();
const mockProductInventoryUpdateEq = vi.fn(() => ({ in: mockProductInventoryUpdateIn }));
const mockProductInventoryUpdate = vi.fn(() => ({ eq: mockProductInventoryUpdateEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === "products") {
    return {
      select: mockSelect,
      upsert: mockProductsUpsert,
    };
  }
  if (table === "product_inventory") {
    return {
      upsert: mockProductInventoryUpsert,
      update: mockProductInventoryUpdate,
    };
  }
  return {
    upsert: vi.fn(),
  };
});

function mockDefaultPrismModules() {
  vi.doMock("@/lib/prism", () => ({
    isPrismConfigured: prismMocks.isPrismConfigured,
  }));
  vi.doMock("@/domains/product/prism-server", () => ({
    discontinueItem: vi.fn(),
    deleteTestItem: vi.fn(),
  }));
  vi.doMock("@/domains/product/prism-updates", async () => {
    const actual = await vi.importActual<typeof import("@/domains/product/prism-updates")>(
      "@/domains/product/prism-updates",
    );
    return {
      ...actual,
      updateGmItem: prismMocks.updateGmItem,
      updateTextbookPricing: prismMocks.updateTextbookPricing,
      getItemSnapshot: prismMocks.getItemSnapshot,
      getInventoryMirrorSnapshotRows: prismMocks.getInventoryMirrorSnapshotRows,
    };
  });
}

async function loadRouteModule() {
  return import("@/app/api/products/[sku]/route");
}

describe("PATCH /api/products/[sku] v2 payloads", () => {
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
    mockMaybeSingle.mockResolvedValue({
      data: { item_type: "general_merchandise" },
      error: null,
    });
    prismMocks.isPrismConfigured.mockReturnValue(true);
    prismMocks.updateGmItem.mockResolvedValue({
      sku: 1001,
      appliedFields: [
        "vendorId",
        "comment",
        "description",
        "catalogNumber",
        "retail",
        "cost",
      ],
    });
    prismMocks.getItemSnapshot.mockResolvedValue({
      sku: 1001,
      barcode: "123456789012",
      itemTaxTypeId: 6,
      retail: 12.99,
      cost: 6.25,
      fDiscontinue: 0,
      primaryLocationId: 2,
    });
    prismMocks.getInventoryMirrorSnapshotRows.mockImplementation(async (_sku, locationIds) =>
      locationIds.map((locationId) => ({
        locationId,
        retail: locationId === 2 ? 12.99 : locationId === 3 ? 14.25 : 15,
        cost: locationId === 2 ? 6.25 : locationId === 3 ? 7.5 : 8,
        expectedCost: null,
        tagTypeId: locationId === 3 ? 17 : null,
        statusCodeId: locationId === 3 ? 3 : null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      })),
    );
    mockProductsUpsert.mockResolvedValue({ error: null });
    mockProductInventoryUpsert.mockResolvedValue({ error: null });
    mockProductInventoryUpdateIn.mockResolvedValue({ error: null });
  });

  it("accepts a typed v2 payload and normalizes write buckets before dispatch", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            item: {
              vendorId: 17,
              comment: "Promo",
            },
            gm: {
              description: "Notebook",
              catalogNumber: "ABC-1",
            },
            primaryInventory: {
              retail: 12.99,
              cost: 6.25,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateGmItem).toHaveBeenCalledWith(
      1001,
      {
        item: {
          vendorId: 17,
          comment: "Promo",
        },
        gm: {
          description: "Notebook",
          catalogNumber: "ABC-1",
        },
        inventory: [
          {
            locationId: 2,
            retail: 12.99,
            cost: 6.25,
          },
        ],
      },
      {
        sku: 1001,
        barcode: "123456789012",
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      vendor_id: 17,
      tx_comment: "Promo",
      description: "Notebook",
      catalog_number: "ABC-1",
      retail_price: 12.99,
      cost: 6.25,
      manual_updated_at: expect.any(String),
    }));
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 1001,
        location_id: 2,
        retail_price: 12.99,
        cost: 6.25,
      }),
    ]);
  });

  it("accepts typed per-location inventory patches and forwards each location unchanged", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            item: {
              vendorId: 17,
            },
            inventory: [
              {
                locationId: 3,
                retail: 14.25,
                cost: 7.5,
                tagTypeId: 17,
                statusCodeId: 3,
              },
              {
                locationId: 4,
                retail: 15.0,
                cost: 8.0,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateGmItem).toHaveBeenCalledWith(
      1001,
      {
        item: {
          vendorId: 17,
        },
        inventory: [
          {
            locationId: 3,
            retail: 14.25,
            cost: 7.5,
            tagTypeId: 17,
            statusCodeId: 3,
          },
          {
            locationId: 4,
            retail: 15,
            cost: 8,
          },
        ],
      },
      {
        sku: 1001,
        barcode: "123456789012",
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
  });

  it("accepts expanded item and GM fields in the V2 payload and mirrors them to products", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            item: {
              usedDccId: 1802,
              styleId: 44,
              itemSeasonCodeId: 77,
              fListPriceFlag: true,
              fPerishable: true,
              fIdRequired: true,
              minOrderQtyItem: 5,
            },
            gm: {
              altVendorId: 22,
              mfgId: 91,
              size: "XL",
              colorId: 2,
              orderIncrement: 6,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateGmItem).toHaveBeenCalledWith(
      1001,
      {
        item: {
          usedDccId: 1802,
          styleId: 44,
          itemSeasonCodeId: 77,
          fListPriceFlag: true,
          fPerishable: true,
          fIdRequired: true,
          minOrderQtyItem: 5,
        },
        gm: {
          altVendorId: 22,
          mfgId: 91,
          size: "XL",
          colorId: 2,
          orderIncrement: 6,
        },
      },
      undefined,
    );
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      used_dcc_id: 1802,
      style_id: 44,
      item_season_code_id: 77,
      f_list_price_flag: true,
      f_perishable: true,
      f_id_required: true,
      min_order_qty_item: 5,
      alt_vendor_id: 22,
      mfg_id: 91,
      size: "XL",
      color_id: 2,
      order_increment: 6,
      manual_updated_at: expect.any(String),
    }));
  });

  it("accepts nullable inventory clears and forwards nulls unchanged", async () => {
    const productDetailRoute = await loadRouteModule();
    prismMocks.getItemSnapshot.mockResolvedValueOnce({
      sku: 1001,
      barcode: "123456789012",
      retail: null,
      cost: null,
      fDiscontinue: 0,
    });
    prismMocks.getInventoryMirrorSnapshotRows.mockResolvedValueOnce([
      {
        locationId: 3,
        retail: null,
        cost: null,
        expectedCost: null,
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

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            inventory: [
              {
                locationId: 3,
                retail: null,
                cost: null,
                expectedCost: null,
                tagTypeId: null,
                statusCodeId: null,
                estSales: null,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateGmItem).toHaveBeenCalledWith(
      1001,
      {
        inventory: [
          {
            locationId: 3,
            retail: null,
            cost: null,
            expectedCost: null,
            tagTypeId: null,
            statusCodeId: null,
            estSales: null,
          },
        ],
      },
      {
        sku: 1001,
        barcode: "123456789012",
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      retail_price: null,
      cost: null,
    }));
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 1001,
        location_id: 3,
        retail_price: null,
        cost: null,
        expected_cost: null,
        tag_type_id: null,
        status_code_id: null,
        est_sales: null,
      }),
    ]);
  });

  it("rejects per-location inventory patches that target invalid locations", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            inventory: [
              {
                locationId: 5,
                retail: 14.25,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(400);
    expect(prismMocks.updateGmItem).not.toHaveBeenCalled();
    expect(prismMocks.updateTextbookPricing).not.toHaveBeenCalled();
    expect(mockProductsUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
  });

  it("rejects duplicate per-location inventory patches in a single payload", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            inventory: [
              {
                locationId: 3,
                retail: 14.25,
              },
              {
                locationId: 3,
                retail: 15.25,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(400);
    expect(prismMocks.updateGmItem).not.toHaveBeenCalled();
    expect(prismMocks.updateTextbookPricing).not.toHaveBeenCalled();
    expect(mockProductsUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
  });

  it("does not fall back to primaryInventory when an explicit empty inventory array is present", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            inventory: [],
            primaryInventory: {
              retail: 14.25,
              cost: 7.5,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "PATCH body must include at least one writable field.",
    });
    expect(prismMocks.updateGmItem).not.toHaveBeenCalled();
    expect(prismMocks.updateTextbookPricing).not.toHaveBeenCalled();
    expect(mockProductsUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
  });

  it("routes textbook-only v2 patches through updateTextbookPricing and mirrors textbook fields", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { item_type: "textbook" },
      error: null,
    });
    prismMocks.updateTextbookPricing.mockResolvedValueOnce({
      sku: 1001,
      appliedFields: [
        "barcode",
        "fDiscontinue",
        "author",
        "title",
        "isbn",
        "edition",
        "bindingId",
        "imprint",
        "copyright",
        "textStatusId",
        "statusDate",
      ],
    });

    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            textbook: {
              author: "Jane Doe",
              title: "Intro Biology",
              isbn: "9781234567890",
              edition: "3",
              bindingId: 15,
              imprint: "PEARSON",
              copyright: "26",
              textStatusId: 7,
              statusDate: "2026-04-20",
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateTextbookPricing).toHaveBeenCalledWith(
      1001,
      {
        textbook: {
          author: "Jane Doe",
          title: "Intro Biology",
          isbn: "9781234567890",
          edition: "3",
          bindingId: 15,
          imprint: "PEARSON",
          copyright: "26",
          textStatusId: 7,
          statusDate: "2026-04-20",
        },
      },
      {
        sku: 1001,
        barcode: "123456789012",
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
    expect(prismMocks.updateGmItem).not.toHaveBeenCalled();
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      author: "Jane Doe",
      title: "Intro Biology",
      isbn: "9781234567890",
      edition: "3",
      binding_id: 15,
      imprint: "PEARSON",
      copyright: "26",
      text_status_id: 7,
      status_date: "2026-04-20",
      barcode: "123456789012",
      retail_price: 12.99,
      cost: 6.25,
      discontinued: false,
      manual_updated_at: expect.any(String),
    }));
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
  });

  it("forwards tax-type baselines through GM v2 patches", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            itemTaxTypeId: 6,
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            item: {
              itemTaxTypeId: 4,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateGmItem).toHaveBeenCalledWith(
      1001,
      {
        item: {
          itemTaxTypeId: 4,
        },
      },
      {
        sku: 1001,
        barcode: "123456789012",
        itemTaxTypeId: 6,
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      item_tax_type_id: 4,
    }));
  });

  it("reads the post-write mirror snapshot from the baseline primary location", async () => {
    prismMocks.getItemSnapshot.mockResolvedValueOnce({
      sku: 1001,
      barcode: "123456789012",
      itemTaxTypeId: 6,
      retail: 12.99,
      cost: 6.25,
      fDiscontinue: 0,
      primaryLocationId: 2,
    });
    prismMocks.getInventoryMirrorSnapshotRows.mockResolvedValueOnce([
      {
        locationId: 3,
        retail: 24.49,
        cost: 11.1,
        expectedCost: null,
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

    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 21.99,
            cost: 10.5,
            fDiscontinue: 0,
            primaryLocationId: 3,
          },
          patch: {
            inventory: [
              {
                locationId: 3,
                retail: 24.99,
                cost: 11.25,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.getItemSnapshot).toHaveBeenCalledWith(1001, 2);
    expect(prismMocks.getInventoryMirrorSnapshotRows).toHaveBeenCalledWith(1001, [3]);
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      retail_price: 12.99,
      cost: 6.25,
      barcode: "123456789012",
    }));
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 1001,
        location_id: 3,
        retail_price: 24.49,
        cost: 11.1,
      }),
    ]);
  });

  it("returns a non-blocking mirror warning when the inventory mirror refresh fails", async () => {
    prismMocks.updateGmItem.mockResolvedValueOnce({
      sku: 1001,
      appliedFields: ["inventory:2:retail"],
    });
    mockProductInventoryUpsert.mockResolvedValueOnce({
      error: { message: "snapshot failed" },
    });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            primaryInventory: {
              retail: 12.99,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sku: 1001,
      appliedFields: ["inventory:2:retail"],
      mirrorErrors: [{ sku: 1001, message: "snapshot failed" }],
    });
  });

  it("invalidates stale mirrored rows when Prism omits a touched location snapshot", async () => {
    prismMocks.updateGmItem.mockResolvedValueOnce({
      sku: 1001,
      appliedFields: ["inventory:3:retail"],
    });
    prismMocks.getInventoryMirrorSnapshotRows.mockResolvedValueOnce([]);
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 21.99,
            cost: 10.5,
            fDiscontinue: 0,
            primaryLocationId: 3,
          },
          patch: {
            inventory: [
              {
                locationId: 3,
                retail: 24.99,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryUpdate).toHaveBeenCalledTimes(1);
    expect(mockProductInventoryUpdate).toHaveBeenCalledWith({
      synced_at: INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT,
    });
    expect(mockProductInventoryUpdateEq).toHaveBeenCalledWith("sku", 1001);
    expect(mockProductInventoryUpdateIn).toHaveBeenCalledWith("location_id", [3]);
    await expect(response.json()).resolves.toEqual({
      sku: 1001,
      appliedFields: ["inventory:3:retail"],
      mirrorErrors: [
        {
          sku: 1001,
          message: "Inventory mirror snapshot for SKU 1001 omitted PCOP; browse data may stay stale until the next sync.",
        },
      ],
    });
  });

  it("still refreshes product_inventory when the products mirror upsert fails", async () => {
    prismMocks.updateGmItem.mockResolvedValueOnce({
      sku: 1001,
      appliedFields: ["inventory:2:retail"],
    });
    mockProductsUpsert.mockResolvedValueOnce({
      error: { message: "products mirror failed" },
    });
    mockProductInventoryUpsert.mockResolvedValueOnce({
      error: null,
    });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            primaryInventory: {
              retail: 12.99,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 1001,
        location_id: 2,
        retail_price: 12.99,
      }),
    ]);
    await expect(response.json()).resolves.toEqual({
      sku: 1001,
      appliedFields: ["inventory:2:retail"],
      mirrorErrors: [{ sku: 1001, message: "products mirror failed" }],
    });
  });

  it("returns 400 when Prism reports a missing location inventory row", async () => {
    prismMocks.updateGmItem.mockRejectedValueOnce(
      Object.assign(new Error("Missing inventory row"), {
        code: "MISSING_INVENTORY_ROW",
        locationId: 3,
      }),
    );
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            inventory: [
              {
                locationId: 3,
                retail: 14.25,
              },
            ],
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "MISSING_INVENTORY_ROW",
      message: "SKU 1001 no longer has an inventory row at PCOP. Refresh and try again.",
    });
  });

  it("forwards tax-type baselines through textbook v2 patches", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { item_type: "textbook" },
      error: null,
    });
    prismMocks.updateTextbookPricing.mockResolvedValueOnce({
      sku: 1001,
      appliedFields: ["itemTaxTypeId"],
    });

    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            itemTaxTypeId: 6,
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            item: {
              itemTaxTypeId: 4,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateTextbookPricing).toHaveBeenCalledWith(
      1001,
      {
        item: {
          itemTaxTypeId: 4,
        },
      },
      {
        sku: 1001,
        barcode: "123456789012",
        itemTaxTypeId: 6,
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      item_tax_type_id: 4,
    }));
  });

  it("ignores textbook fields for GM v2 patches when mirroring to products", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          baseline: {
            sku: 1001,
            barcode: "123456789012",
            retail: 11.99,
            cost: 5.5,
            fDiscontinue: 0,
            primaryLocationId: 2,
          },
          patch: {
            item: {
              vendorId: 17,
            },
            textbook: {
              title: "Should not mirror to GM",
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(200);
    expect(prismMocks.updateGmItem).toHaveBeenCalledWith(
      1001,
      {
        item: {
          vendorId: 17,
        },
        textbook: {
          title: "Should not mirror to GM",
        },
      },
      {
        sku: 1001,
        barcode: "123456789012",
        retail: 11.99,
        cost: 5.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      },
    );
    expect(prismMocks.updateTextbookPricing).not.toHaveBeenCalled();
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      vendor_id: 17,
      barcode: "123456789012",
      retail_price: 12.99,
      cost: 6.25,
      discontinued: false,
      manual_updated_at: expect.any(String),
    }));
    expect(mockProductsUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
      title: "Should not mirror to GM",
    }));
  });

  it("rejects empty typed patches instead of dispatching a no-op update", async () => {
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {},
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "PATCH body must include at least one writable field.",
    });
    expect(prismMocks.updateGmItem).not.toHaveBeenCalled();
    expect(prismMocks.updateTextbookPricing).not.toHaveBeenCalled();
    expect(mockProductsUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
  });
});
