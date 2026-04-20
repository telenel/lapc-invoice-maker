import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/supabase/admin", () => supabaseMocks);

const mockProductsIn = vi.fn();
const mockProductsEq = vi.fn();
const mockProductsFilter = vi.fn();
const mockProductsLimit = vi.fn(() => ({ in: mockProductsIn, eq: mockProductsEq }));
const mockProductsSelect = vi.fn(() => ({
  limit: mockProductsLimit,
  ilike: mockProductsFilter,
  eq: mockProductsFilter,
  gte: mockProductsFilter,
  lte: mockProductsFilter,
  not: mockProductsFilter,
  is: mockProductsFilter,
}));

const mockInventoryLocationIn = vi.fn();
const mockInventorySkuIn = vi.fn(() => ({ in: mockInventoryLocationIn }));
const mockInventorySelect = vi.fn(() => ({ in: mockInventorySkuIn }));

const mockFrom = vi.fn((table: string) => {
  if (table === "products") {
    return {
      select: mockProductsSelect,
    };
  }

  if (table === "product_inventory") {
    return {
      select: mockInventorySelect,
    };
  }

  return {
    select: vi.fn(),
  };
});

async function loadRouteModule() {
  return import("@/app/api/products/bulk-edit/dry-run/route");
}

describe("POST /api/products/bulk-edit/dry-run", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });

    mockProductsFilter.mockReturnValue({ limit: mockProductsLimit });
    mockProductsEq.mockResolvedValue({ data: [], error: null });
    mockProductsIn.mockResolvedValue({
      data: [
        {
          sku: 101,
          description: "Pierce Hoodie",
          barcode: "111222333444",
          retail_price: 9.99,
          cost: 4.5,
          vendor_id: 21,
          dcc_id: 100,
          item_tax_type_id: 6,
          item_type: "general_merchandise",
          discontinued: false,
          title: null,
          author: null,
          isbn: null,
          edition: null,
          binding_id: null,
          catalog_number: "HD-101",
          package_type: "EA",
          units_per_pack: 1,
          order_increment: 2,
        },
      ],
      error: null,
    });
    mockInventoryLocationIn.mockResolvedValue({
      data: [
        {
          sku: 101,
          location_id: 2,
          retail_price: 9.99,
          cost: 4.5,
          expected_cost: 4.25,
          tag_type_id: 6,
          status_code_id: 11,
          est_sales: 8,
          est_sales_locked: false,
          f_inv_list_price_flag: false,
          f_tx_want_list_flag: false,
          f_tx_buyback_list_flag: false,
          f_no_returns: false,
        },
        {
          sku: 101,
          location_id: 3,
          retail_price: 8.99,
          cost: 3.75,
          expected_cost: 3.5,
          tag_type_id: 4,
          status_code_id: 12,
          est_sales: 6,
          est_sales_locked: true,
          f_inv_list_price_flag: true,
          f_tx_want_list_flag: false,
          f_tx_buyback_list_flag: true,
          f_no_returns: true,
        },
      ],
      error: null,
    });
  });

  it("rejects inventory fields without an explicit inventory scope", async () => {
    const dryRunRoute = await loadRouteModule();

    const response = await dryRunRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            fieldIds: ["retail"],
            inventoryScope: null,
            values: { retail: 10 },
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      errors: [expect.objectContaining({ code: "MISSING_INVENTORY_SCOPE" })],
    });
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects requests that select more than five fields", async () => {
    const dryRunRoute = await loadRouteModule();

    const response = await dryRunRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            fieldIds: ["description", "vendorId", "dccId", "barcode", "retail", "cost"],
            inventoryScope: 2,
            values: {
              description: "Updated description",
              vendorId: 21,
              dccId: 100,
              barcode: "111222333444",
              retail: 12.5,
              cost: 6.25,
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.objectContaining({
        fieldErrors: expect.objectContaining({
          transform: [expect.stringContaining("<=5")],
        }),
      }),
    });
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects unknown transform value keys that are not real Phase 8 field ids", async () => {
    const dryRunRoute = await loadRouteModule();

    const response = await dryRunRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            fieldIds: ["description"],
            inventoryScope: null,
            values: {
              description: "New description",
              notARealField: "nope",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(JSON.stringify(json)).toContain("notARealField");
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects malformed legacy transforms with 400 instead of crashing", async () => {
    const dryRunRoute = await loadRouteModule();

    const response = await dryRunRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            pricing: {},
            catalog: {},
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.objectContaining({
        fieldErrors: expect.objectContaining({
          transform: expect.any(Array),
        }),
      }),
    });
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns the Phase 8 field preview using per-location inventory rows", async () => {
    const dryRunRoute = await loadRouteModule();

    const response = await dryRunRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            fieldIds: ["cost", "tagTypeId"],
            inventoryScope: "all",
            values: { cost: 6.25, tagTypeId: 7 },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totals: {
        rowCount: 1,
        changedFieldCount: 2,
      },
      rows: [
        {
          sku: 101,
          changedFields: ["cost", "tagTypeId"],
          cells: [
            {
              fieldId: "cost",
              beforeLabel: "2: 4.5, 3: 3.75",
              afterLabel: "2: 6.25, 3: 6.25",
              changed: true,
            },
            {
              fieldId: "tagTypeId",
              beforeLabel: expect.stringContaining("2: "),
              afterLabel: "2: #7, 3: #7",
              changed: true,
            },
          ],
        },
      ],
    });
    expect(mockInventorySkuIn).toHaveBeenCalledWith("sku", [101]);
    expect(mockInventoryLocationIn).toHaveBeenCalledWith("location_id", [2, 3, 4]);
  });
});
