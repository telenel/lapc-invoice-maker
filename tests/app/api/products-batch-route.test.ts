import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const prismLibMocks = vi.hoisted(() => ({
  isPrismConfigured: vi.fn(),
}));

const prismBatchMocks = vi.hoisted(() => ({
  batchCreateGmItems: vi.fn(),
  batchDiscontinueItems: vi.fn(),
  batchHardDeleteItems: vi.fn(),
  batchUpdateItems: vi.fn(),
  validateBatchCreateAgainstPrism: vi.fn(),
  validateBatchUpdateAgainstPrism: vi.fn(),
}));

const prismUpdateMocks = vi.hoisted(() => ({
  getItemSnapshot: vi.fn(),
  getInventoryMirrorSnapshotRows: vi.fn(),
}));

const prismDeleteMocks = vi.hoisted(() => ({
  hasTransactionHistory: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/prism", () => ({
  isPrismConfigured: prismLibMocks.isPrismConfigured,
}));
vi.mock("@/domains/product/prism-batch", () => prismBatchMocks);
vi.mock("@/domains/product/prism-delete", () => prismDeleteMocks);
vi.mock("@/domains/product/prism-updates", async () => {
  const actual = await vi.importActual<typeof import("@/domains/product/prism-updates")>(
    "@/domains/product/prism-updates",
  );
  return {
    ...actual,
    getItemSnapshot: prismUpdateMocks.getItemSnapshot,
    getInventoryMirrorSnapshotRows: prismUpdateMocks.getInventoryMirrorSnapshotRows,
  };
});
vi.mock("@/lib/supabase/admin", () => supabaseMocks);

const mockProductsUpsert = vi.fn();
const mockProductInventoryUpsert = vi.fn();
const mockProductInventoryDeleteIn = vi.fn();
const mockProductInventoryDeleteEq = vi.fn(() => ({ in: mockProductInventoryDeleteIn }));
const mockProductInventoryDelete = vi.fn(() => ({ eq: mockProductInventoryDeleteEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === "products") {
    return {
      upsert: mockProductsUpsert,
      delete: vi.fn(),
    };
  }

  if (table === "product_inventory") {
    return {
      upsert: mockProductInventoryUpsert,
      delete: mockProductInventoryDelete,
    };
  }

  return {
    upsert: vi.fn(),
    delete: vi.fn(),
  };
});

async function loadRouteModule() {
  return import("@/app/api/products/batch/route");
}

describe("POST /api/products/batch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    prismLibMocks.isPrismConfigured.mockReturnValue(true);
    prismBatchMocks.validateBatchCreateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchCreateGmItems.mockResolvedValue([1001, 1002]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101, 202]);
    prismDeleteMocks.hasTransactionHistory.mockResolvedValue(new Set());
    prismUpdateMocks.getItemSnapshot.mockResolvedValue({
      sku: 101,
      barcode: "X",
      retail: 5,
      cost: 2,
      fDiscontinue: 0,
      primaryLocationId: 2,
    });
    prismUpdateMocks.getInventoryMirrorSnapshotRows.mockImplementation(async (_sku, locationIds) =>
      locationIds.map((locationId) => ({
        locationId,
        retail: locationId === 3 ? 41.99 : 5,
        cost: locationId === 3 ? 21.5 : 2,
        expectedCost: null,
        tagTypeId: null,
        statusCodeId: null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      })),
    );
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    mockProductsUpsert.mockResolvedValue({ error: null });
    mockProductInventoryUpsert.mockResolvedValue({ error: null });
    mockProductInventoryDeleteIn.mockResolvedValue({ error: null });
  });

  it("forwards per-location inventory rows through batch create and mirrors product_inventory", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          rows: [
            {
              description: "Pierce Hoodie",
              vendorId: 21,
              dccId: 1313290,
              itemTaxTypeId: 6,
              retail: 39.99,
              cost: 19.5,
              inventory: [
                { locationId: 2, retail: 39.99, cost: 19.5 },
                { locationId: 3, retail: 41.99, cost: 21.5 },
              ],
            },
            {
              description: "Pierce Mug",
              vendorId: 22,
              dccId: 1313291,
              itemTaxTypeId: 6,
              retail: 12.99,
              cost: 5.25,
              inventory: [
                { locationId: 2, retail: 12.99, cost: 5.25 },
                { locationId: 4, retail: 13.99, cost: 6.25 },
              ],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(prismBatchMocks.validateBatchCreateAgainstPrism).toHaveBeenCalledWith([
      expect.objectContaining({
        description: "Pierce Hoodie",
        inventory: [
          { locationId: 2, retail: 39.99, cost: 19.5 },
          { locationId: 3, retail: 41.99, cost: 21.5 },
        ],
      }),
      expect.objectContaining({
        description: "Pierce Mug",
        inventory: [
          { locationId: 2, retail: 12.99, cost: 5.25 },
          { locationId: 4, retail: 13.99, cost: 6.25 },
        ],
      }),
    ]);
    expect(prismBatchMocks.batchCreateGmItems).toHaveBeenCalledWith([
      expect.objectContaining({
        description: "Pierce Hoodie",
        inventory: [
          { locationId: 2, retail: 39.99, cost: 19.5 },
          { locationId: 3, retail: 41.99, cost: 21.5 },
        ],
      }),
      expect.objectContaining({
        description: "Pierce Mug",
        inventory: [
          { locationId: 2, retail: 12.99, cost: 5.25 },
          { locationId: 4, retail: 13.99, cost: 6.25 },
        ],
      }),
    ]);
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith(
      [
        {
          sku: 1001,
          location_id: 2,
          location_abbrev: "PIER",
          retail_price: 39.99,
          cost: 19.5,
        },
        {
          sku: 1001,
          location_id: 3,
          location_abbrev: "PCOP",
          retail_price: 41.99,
          cost: 21.5,
        },
        {
          sku: 1002,
          location_id: 2,
          location_abbrev: "PIER",
          retail_price: 12.99,
          cost: 5.25,
        },
        {
          sku: 1002,
          location_id: 4,
          location_abbrev: "PFS",
          retail_price: 13.99,
          cost: 6.25,
        },
      ],
      { onConflict: "sku,location_id" },
    );
  });

  it("rejects an update row without a baseline", async () => {
    const { POST } = await loadRouteModule();
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        rows: [{ sku: 101, patch: { retail: 11 } }],
      }),
    }));
    expect(response.status).toBe(400);
  });

  it("forwards CONCURRENT_MODIFICATION with rowIndex + sku as 409", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    const err = Object.assign(new Error("CONCURRENT_MODIFICATION"), {
      code: "CONCURRENT_MODIFICATION",
      rowIndex: 1,
      sku: 202,
      current: { sku: 202, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 3 },
    });
    prismBatchMocks.batchUpdateItems.mockRejectedValue(err);

    const { POST } = await loadRouteModule();
    const body = {
      action: "update",
      rows: [101, 202].map((sku) => ({
        sku,
        patch: { retail: 11 },
        baseline: { sku, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 3 },
      })),
    };
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({ error: "CONCURRENT_MODIFICATION", rowIndex: 1, sku: 202 });
    // The route narrows `current` to known ItemSnapshot fields so future
    // domain-layer changes can't accidentally leak richer objects to the client.
    expect(json.current).toMatchObject({
      sku: 202,
      barcode: "X",
      retail: 5,
      cost: 2,
      fDiscontinue: 0,
      primaryLocationId: 3,
    });
  });

  it("normalizes missing inventory rows into a structured 400 error", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockRejectedValue(
      Object.assign(new Error("Missing inventory row"), {
        code: "MISSING_INVENTORY_ROW",
        rowIndex: 1,
        sku: 202,
        locationId: 3,
      }),
    );

    const { POST } = await loadRouteModule();
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        rows: [101, 202].map((sku) => ({
          sku,
          patch: { retail: 11 },
          baseline: { sku, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 3 },
        })),
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          rowIndex: 1,
          field: "inventory",
          code: "MISSING_INVENTORY_ROW",
          message: "SKU 202 no longer has an inventory row at location 3. Refresh and try again.",
        },
      ],
    });
  });

  it("returns 200 with updated skus on happy path", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101, 202]);

    const { POST } = await loadRouteModule();
    const body = {
      action: "update",
      rows: [101, 202].map((sku) => ({
        sku,
        patch: { retail: 11 },
        baseline: { sku, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 2 },
      })),
    };
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ action: "update", count: 2, skus: [101, 202] });
  });

  it("mirrors batch updates back into products and product_inventory using each row's primary location", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101, 202]);
    prismUpdateMocks.getItemSnapshot
      .mockResolvedValueOnce({
        sku: 101,
        barcode: "AAA",
        retail: 39.99,
        cost: 19.5,
        fDiscontinue: 0,
        primaryLocationId: 2,
      })
      .mockResolvedValueOnce({
        sku: 202,
        barcode: "BBB",
        retail: 12.99,
        cost: 6.25,
        fDiscontinue: 1,
        primaryLocationId: 2,
      });

    const { POST } = await loadRouteModule();
    const body = {
      action: "update",
      rows: [
        {
          sku: 101,
          patch: {
            item: { vendorId: 17 },
            inventory: [{ locationId: 3, retail: 41.99, cost: 21.5 }],
          },
          baseline: { sku: 101, barcode: "AAA", retail: 40, cost: 20, fDiscontinue: 0, primaryLocationId: 3 },
        },
        {
          sku: 202,
          patch: {
            item: { fDiscontinue: 1 },
          },
          baseline: { sku: 202, barcode: "BBB", retail: 12.99, cost: 6.25, fDiscontinue: 0, primaryLocationId: 2 },
        },
      ],
    };

    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(prismUpdateMocks.getItemSnapshot).toHaveBeenNthCalledWith(1, 101, 2);
    expect(prismUpdateMocks.getItemSnapshot).toHaveBeenNthCalledWith(2, 202, 2);
    expect(mockProductsUpsert.mock.calls).toEqual(expect.arrayContaining([
      [
        expect.objectContaining({
          sku: 101,
          vendor_id: 17,
          barcode: "AAA",
          retail_price: 39.99,
          cost: 19.5,
          discontinued: false,
        }),
      ],
      [
        expect.objectContaining({
          sku: 202,
          barcode: "BBB",
          retail_price: 12.99,
          cost: 6.25,
          discontinued: true,
        }),
      ],
    ]));
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 101,
        location_id: 3,
        retail_price: 41.99,
        cost: 21.5,
      }),
    ], { onConflict: "sku,location_id" });
  });

  it("continues mirroring later rows when one batch-update mirror snapshot fails", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101, 202]);
    prismUpdateMocks.getItemSnapshot
      .mockRejectedValueOnce(new Error("snapshot failed"))
      .mockResolvedValueOnce({
        sku: 202,
        barcode: "BBB",
        retail: 12.99,
        cost: 6.25,
        fDiscontinue: 0,
        primaryLocationId: 2,
      });

    const { POST } = await loadRouteModule();
    const body = {
      action: "update",
      rows: [
        {
          sku: 101,
          patch: {
            inventory: [{ locationId: 3, retail: 41.99, cost: 21.5 }],
          },
          baseline: { sku: 101, barcode: "AAA", retail: 40, cost: 20, fDiscontinue: 0, primaryLocationId: 3 },
        },
        {
          sku: 202,
          patch: {
            item: { vendorId: 17 },
          },
          baseline: { sku: 202, barcode: "BBB", retail: 12.99, cost: 6.25, fDiscontinue: 0, primaryLocationId: 2 },
        },
      ],
    };

    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(prismUpdateMocks.getItemSnapshot).toHaveBeenNthCalledWith(1, 101, 2);
    expect(prismUpdateMocks.getItemSnapshot).toHaveBeenNthCalledWith(2, 202, 2);
    expect(mockProductsUpsert).toHaveBeenCalledTimes(1);
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 202,
      vendor_id: 17,
      retail_price: 12.99,
      cost: 6.25,
    }));
    const json = await response.json();
    expect(json).toMatchObject({
      action: "update",
      count: 2,
      skus: [101, 202],
      mirrorErrors: [{ sku: 101, message: "snapshot failed" }],
    });
  });

  it("reports Supabase mirror upsert errors in the batch update response", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101]);
    prismUpdateMocks.getItemSnapshot.mockResolvedValue({
      sku: 101,
      barcode: "AAA",
      retail: 40,
      cost: 20,
      fDiscontinue: 0,
      primaryLocationId: 2,
    });
    mockProductsUpsert.mockResolvedValueOnce({
      error: { message: "products mirror failed" },
    });

    const { POST } = await loadRouteModule();
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        rows: [
          {
            sku: 101,
            patch: {
              item: { vendorId: 17 },
              inventory: [{ locationId: 3, retail: 41.99, cost: 21.5 }],
            },
            baseline: { sku: 101, barcode: "AAA", retail: 40, cost: 20, fDiscontinue: 0, primaryLocationId: 3 },
          },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mockProductsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 101,
      vendor_id: 17,
    }));
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 101,
        location_id: 3,
        retail_price: 41.99,
        cost: 21.5,
      }),
    ], { onConflict: "sku,location_id" });
    await expect(response.json()).resolves.toMatchObject({
      action: "update",
      count: 1,
      skus: [101],
      mirrorErrors: [{ sku: 101, message: "products mirror failed" }],
    });
  });

  it("invalidates stale mirrored rows when Prism omits a touched location snapshot", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101]);
    prismUpdateMocks.getInventoryMirrorSnapshotRows.mockResolvedValueOnce([]);

    const { POST } = await loadRouteModule();
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        rows: [
          {
            sku: 101,
            patch: {
              inventory: [{ locationId: 3, retail: 41.99, cost: 21.5 }],
            },
            baseline: { sku: 101, barcode: "AAA", retail: 40, cost: 20, fDiscontinue: 0, primaryLocationId: 3 },
          },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryDelete).toHaveBeenCalledTimes(1);
    expect(mockProductInventoryDeleteEq).toHaveBeenCalledWith("sku", 101);
    expect(mockProductInventoryDeleteIn).toHaveBeenCalledWith("location_id", [3]);
    await expect(response.json()).resolves.toMatchObject({
      action: "update",
      count: 1,
      skus: [101],
      mirrorErrors: [
        {
          sku: 101,
          message: "Inventory mirror snapshot for SKU 101 omitted PCOP; browse data may stay stale until the next sync.",
        },
      ],
    });
  });

  it("surfaces batch-level mirror setup failures for every updated row", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101, 202]);
    supabaseMocks.getSupabaseAdminClient.mockImplementation(() => {
      throw new Error("supabase unavailable");
    });

    const { POST } = await loadRouteModule();
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        rows: [101, 202].map((sku) => ({
          sku,
          patch: { item: { vendorId: 17 } },
          baseline: { sku, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 2 },
        })),
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      action: "update",
      count: 2,
      skus: [101, 202],
      mirrorErrors: [
        { sku: 101, message: "supabase unavailable" },
        { sku: 202, message: "supabase unavailable" },
      ],
    });
  });

  it("keeps legacy batch create callers working when inventory is absent", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          rows: [
            {
              description: "Pierce Notebook",
              vendorId: 21,
              dccId: 1313290,
              itemTaxTypeId: 6,
              retail: 4.99,
              cost: 2.25,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(prismBatchMocks.batchCreateGmItems).toHaveBeenCalledWith([
      expect.objectContaining({
        description: "Pierce Notebook",
        retail: 4.99,
        cost: 2.25,
      }),
    ]);
  });
});
