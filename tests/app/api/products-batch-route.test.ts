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
vi.mock("@/lib/supabase/admin", () => supabaseMocks);

const mockProductsUpsert = vi.fn();
const mockProductInventoryUpsert = vi.fn();
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
    prismDeleteMocks.hasTransactionHistory.mockResolvedValue(new Set());
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    mockProductsUpsert.mockResolvedValue({ error: null });
    mockProductInventoryUpsert.mockResolvedValue({ error: null });
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
