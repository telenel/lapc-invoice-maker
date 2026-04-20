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
const mockUpsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "products") {
    return {
      select: mockSelect,
      upsert: mockUpsert,
    };
  }
  return {
    upsert: mockUpsert,
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
    mockUpsert.mockResolvedValue({ error: null });
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
        primaryInventory: {
          retail: 12.99,
          cost: 6.25,
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
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      sku: 1001,
      vendor_id: 17,
      tx_comment: "Promo",
      description: "Notebook",
      catalog_number: "ABC-1",
      retail_price: 12.99,
      cost: 6.25,
      synced_at: expect.any(String),
    }));
  });

  it("rejects typed v2 requests when the target SKU is a textbook", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { item_type: "textbook" },
      error: null,
    });
    const productDetailRoute = await loadRouteModule();

    const response = await productDetailRoute.PATCH(
      new NextRequest("http://localhost/api/products/1001", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "v2",
          patch: {
            item: {
              vendorId: 17,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "V2 PATCH does not support textbook SKUs. Use the legacy textbook-safe payload.",
    });
    expect(prismMocks.updateGmItem).not.toHaveBeenCalled();
    expect(prismMocks.updateTextbookPricing).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
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
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
