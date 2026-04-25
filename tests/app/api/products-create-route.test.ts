import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const prismMocks = vi.hoisted(() => ({
  isPrismConfigured: vi.fn(),
  createGmItem: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/prism", () => ({
  isPrismConfigured: prismMocks.isPrismConfigured,
}));
vi.mock("@/domains/product/prism-server", () => ({
  createGmItem: prismMocks.createGmItem,
}));
vi.mock("@/lib/supabase/admin", () => supabaseMocks);

const mockProductsUpsert = vi.fn();
const mockProductInventoryUpsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "products") {
    return {
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

async function loadRouteModule() {
  return import("@/app/api/products/route");
}

describe("POST /api/products", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    prismMocks.isPrismConfigured.mockReturnValue(true);
    prismMocks.createGmItem.mockResolvedValue({
      sku: 1001,
      description: "Pierce mug",
      vendorId: 21,
      dccId: 1313290,
      barcode: null,
      retail: 19.99,
      cost: 8.5,
      inventory: [
        { locationId: 2, retail: 19.99, cost: 8.5 },
        { locationId: 3, retail: 24.99, cost: 11.25 },
        { locationId: 4, retail: 19.99, cost: 8.5 },
      ],
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    mockProductsUpsert.mockResolvedValue({ error: null });
    mockProductInventoryUpsert.mockResolvedValue({ error: null });
  });

  it("accepts inventory rows, validates them, and mirrors product_inventory rows", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          itemTaxTypeId: 6,
          retail: 19.99,
          cost: 8.5,
          inventory: [
            { locationId: 2, retail: 19.99, cost: 8.5 },
            { locationId: 3, retail: 24.99, cost: 11.25 },
            { locationId: 4, retail: 19.99, cost: 8.5 },
          ],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(prismMocks.createGmItem).toHaveBeenCalledWith({
      description: "Pierce mug",
      vendorId: 21,
      dccId: 1313290,
      itemTaxTypeId: 6,
      retail: 19.99,
      cost: 8.5,
      inventory: [
        { locationId: 2, retail: 19.99, cost: 8.5 },
        { locationId: 3, retail: 24.99, cost: 11.25 },
        { locationId: 4, retail: 19.99, cost: 8.5 },
      ],
    });
    expect(mockProductsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: 1001,
        item_type: "general_merchandise",
        retail_price: 19.99,
        cost: 8.5,
        synced_at: expect.any(String),
        manual_updated_at: expect.any(String),
      }),
    );
    expect(mockProductInventoryUpsert).toHaveBeenCalledWith(
      [
        {
          sku: 1001,
          location_id: 2,
          location_abbrev: "PIER",
          retail_price: 19.99,
          cost: 8.5,
        },
        {
          sku: 1001,
          location_id: 3,
          location_abbrev: "PCOP",
          retail_price: 24.99,
          cost: 11.25,
        },
        {
          sku: 1001,
          location_id: 4,
          location_abbrev: "PFS",
          retail_price: 19.99,
          cost: 8.5,
        },
      ],
      { onConflict: "sku,location_id" },
    );
  });

  it("rejects duplicate inventory locations", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          retail: 19.99,
          cost: 8.5,
          inventory: [
            { locationId: 2, retail: 19.99, cost: 8.5 },
            { locationId: 2, retail: 19.99, cost: 8.5 },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Duplicate inventory location"),
      }),
    );
    expect(prismMocks.createGmItem).not.toHaveBeenCalled();
    expect(mockProductsUpsert).not.toHaveBeenCalled();
    expect(mockProductInventoryUpsert).not.toHaveBeenCalled();
  });

  it("rejects out-of-scope inventory locations", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          retail: 19.99,
          cost: 8.5,
          inventory: [{ locationId: 5, retail: 19.99, cost: 8.5 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("inventory"),
      }),
    );
    expect(prismMocks.createGmItem).not.toHaveBeenCalled();
  });

  it("rejects inventory payloads that omit the canonical PIER row", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          retail: 19.99,
          cost: 8.5,
          inventory: [{ locationId: 3, retail: 24.99, cost: 11.25 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("PIER"),
      }),
    );
    expect(prismMocks.createGmItem).not.toHaveBeenCalled();
  });

  it("rejects blank top-level pricing instead of coercing it to zero", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          retail: "",
          cost: "   ",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Retail"),
      }),
    );
    expect(prismMocks.createGmItem).not.toHaveBeenCalled();
  });

  it("rejects blank per-location pricing instead of coercing it to zero", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          retail: 19.99,
          cost: 8.5,
          inventory: [
            { locationId: 2, retail: 19.99, cost: 8.5 },
            { locationId: 3, retail: "", cost: " " },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("inventory"),
      }),
    );
    expect(prismMocks.createGmItem).not.toHaveBeenCalled();
  });

  it("keeps legacy single-location callers working when inventory is absent", async () => {
    const { POST } = await loadRouteModule();

    const response = await POST(
      new NextRequest("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Pierce mug",
          vendorId: 21,
          dccId: 1313290,
          itemTaxTypeId: 6,
          retail: 19.99,
          cost: 8.5,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(prismMocks.createGmItem).toHaveBeenCalledWith({
      description: "Pierce mug",
      vendorId: 21,
      dccId: 1313290,
      itemTaxTypeId: 6,
      retail: 19.99,
      cost: 8.5,
    });
  });
});
