import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
  vi.doMock("@/domains/product/prism-updates", () => ({
    updateGmItem: prismMocks.updateGmItem,
    updateTextbookPricing: prismMocks.updateTextbookPricing,
    getItemSnapshot: prismMocks.getItemSnapshot,
  }));
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
      retail: 12.99,
      cost: 6.25,
      fDiscontinue: 0,
    });
    mockProductsUpsert.mockResolvedValue({ error: null });
    mockProductInventoryUpsert.mockResolvedValue({ error: null });
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
      synced_at: expect.any(String),
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
      },
    );
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
      synced_at: expect.any(String),
    }));
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
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
      synced_at: expect.any(String),
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
