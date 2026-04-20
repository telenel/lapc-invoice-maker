import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

const prismMocks = vi.hoisted(() => ({
  isPrismConfigured: vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
  bulkEditRun: {
    create: vi.fn(),
  },
}));

const productPatchRouteMocks = vi.hoisted(() => ({
  PATCH: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/supabase/admin", () => supabaseMocks);
vi.mock("@/lib/prism", () => ({
  isPrismConfigured: prismMocks.isPrismConfigured,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: prismaMocks,
}));
vi.mock("@/app/api/products/[sku]/route", () => productPatchRouteMocks);

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
  return import("@/app/api/products/bulk-edit/commit/route");
}

describe("POST /api/products/bulk-edit/commit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin", name: "Admin User", username: "admin" },
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    prismMocks.isPrismConfigured.mockReturnValue(true);

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
          location_id: 4,
          retail_price: 7.99,
          cost: 3.25,
          expected_cost: 3,
          tag_type_id: 2,
          status_code_id: 15,
          est_sales: 5,
          est_sales_locked: false,
          f_inv_list_price_flag: false,
          f_tx_want_list_flag: false,
          f_tx_buyback_list_flag: false,
          f_no_returns: false,
        },
      ],
      error: null,
    });

    productPatchRouteMocks.PATCH.mockResolvedValue(
      NextResponse.json({ sku: 101, appliedFields: ["retail", "tagTypeId", "fNoReturns"] }),
    );
    prismaMocks.bulkEditRun.create.mockResolvedValue({ id: "run-1" });
  });

  it("rebuilds Phase 8 row patches server-side and commits them through the v2 product PATCH route", async () => {
    const commitRoute = await loadRouteModule();

    const response = await commitRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "next-auth.session-token=test" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            fieldIds: ["retail", "tagTypeId", "fNoReturns"],
            inventoryScope: "all",
            values: { retail: 12.5, tagTypeId: 7, fNoReturns: true },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(productPatchRouteMocks.PATCH).toHaveBeenCalledTimes(1);

    const [nestedRequest, nestedContext] = productPatchRouteMocks.PATCH.mock.calls[0] ?? [];
    expect(nestedContext).toEqual({ params: Promise.resolve({ sku: "101" }) });
    expect(nestedRequest).toBeInstanceOf(NextRequest);

    const nestedBody = await (nestedRequest as NextRequest).json();
    expect(nestedBody).toEqual({
      mode: "v2",
      patch: {
        inventory: [
          {
            locationId: 2,
            retail: 12.5,
            tagTypeId: 7,
            fNoReturns: true,
          },
          {
            locationId: 4,
            retail: 12.5,
            tagTypeId: 7,
            fNoReturns: true,
          },
        ],
      },
    });

    await expect(response.json()).resolves.toEqual({
      runId: "run-1",
      successCount: 1,
      affectedSkus: [101],
    });
    expect(prismaMocks.bulkEditRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        affectedSkus: [101],
        skuCount: 1,
        pricingDeltaCents: BigInt(0),
        hadDistrictChanges: false,
      }),
    }));
  });

  it("rejects commit requests that select more than five fields", async () => {
    const commitRoute = await loadRouteModule();

    const response = await commitRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "next-auth.session-token=test" },
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
    expect(productPatchRouteMocks.PATCH).not.toHaveBeenCalled();
    expect(prismaMocks.bulkEditRun.create).not.toHaveBeenCalled();
  });

  it("normalizes nested PATCH conflicts into structured errors for callers", async () => {
    productPatchRouteMocks.PATCH.mockResolvedValueOnce(
      NextResponse.json(
        {
          error: "CONCURRENT_MODIFICATION",
          current: { sku: 101, retail: 13.25 },
        },
        { status: 409 },
      ),
    );
    const commitRoute = await loadRouteModule();

    const response = await commitRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "next-auth.session-token=test" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            fieldIds: ["retail"],
            inventoryScope: 2,
            values: { retail: 12.5 },
          },
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "CONCURRENT_MODIFICATION",
          message: "CONCURRENT_MODIFICATION",
          current: { sku: 101, retail: 13.25 },
        },
      ],
    });
    expect(prismaMocks.bulkEditRun.create).not.toHaveBeenCalled();
  });

  it("rejects malformed legacy transforms with 400 instead of crashing", async () => {
    const commitRoute = await loadRouteModule();

    const response = await commitRoute.POST(
      new NextRequest("http://localhost/api/products/bulk-edit/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "next-auth.session-token=test" },
        body: JSON.stringify({
          selection: { skus: [101], scope: "pierce" },
          transform: {
            foo: "bar",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(JSON.stringify(json)).toContain("transform");
    expect(supabaseMocks.getSupabaseAdminClient).not.toHaveBeenCalled();
    expect(productPatchRouteMocks.PATCH).not.toHaveBeenCalled();
    expect(prismaMocks.bulkEditRun.create).not.toHaveBeenCalled();
  });
});
