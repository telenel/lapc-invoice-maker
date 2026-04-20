import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import * as productDetailRoute from "@/app/api/products/[sku]/route";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

describe("GET /api/products/[sku]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: mockFrom,
    } as never);
  });

  it("rejects invalid SKUs with 400", async () => {
    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/not-a-number"),
      { params: Promise.resolve({ sku: "not-a-number" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid SKU" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 404 when the product row is absent", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await productDetailRoute.GET(
      new NextRequest("http://localhost/api/products/1001"),
      { params: Promise.resolve({ sku: "1001" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Item not found" });
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
    });
  });
});
