import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const nextAuthMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

const refDataMocks = vi.hoisted(() => ({
  loadCommittedProductRefSnapshot: vi.fn(),
}));

vi.mock("next-auth", () => nextAuthMocks);
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase/admin", () => supabaseMocks);
vi.mock("@/domains/product/ref-data-server", () => refDataMocks);

const mockProductsIn = vi.fn();
const mockProductsSelect = vi.fn(() => ({ in: mockProductsIn }));
const mockInventoryLocationIn = vi.fn();
const mockInventorySkuIn = vi.fn(() => ({ in: mockInventoryLocationIn }));
const mockInventorySelect = vi.fn(() => ({ in: mockInventorySkuIn }));

const mockFrom = vi.fn((table: string) => {
  if (table === "products") {
    return { select: mockProductsSelect };
  }

  if (table === "product_inventory") {
    return { select: mockInventorySelect };
  }

  return { select: vi.fn() };
});

async function loadRouteModule() {
  return import("@/app/api/products/edit-context/route");
}

describe("POST /api/products/edit-context", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nextAuthMocks.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      from: mockFrom,
    });
    refDataMocks.loadCommittedProductRefSnapshot.mockResolvedValue({
      vendors: [{ vendorId: 21, name: "Acme Books", pierceItems: 12 }],
      dccs: [],
      taxTypes: [],
      tagTypes: [],
      statusCodes: [],
      packageTypes: [],
      colors: [],
      bindings: [],
    });
    mockProductsIn.mockResolvedValue({
      data: [
        {
          sku: 202,
          item_type: "textbook",
          description: "Intro Biology",
          title: "Biology 101",
          author: "Jane Doe",
          isbn: "9781234567890",
          edition: "3",
          binding_id: 15,
          imprint: "Pearson",
          copyright: "2026",
          text_status_id: 7,
          status_date: "2026-04-20",
          book_key: "BK-202",
          barcode: "999888777666",
          vendor_id: null,
          dcc_id: 55,
          item_tax_type_id: 4,
          catalog_number: null,
          tx_comment: null,
          retail_price: 49.99,
          cost: 25,
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
          f_list_price_flag: false,
          f_perishable: false,
          f_id_required: false,
          min_order_qty_item: null,
          used_dcc_id: null,
          dept_name: "Texts",
          class_name: "Biology",
          cat_name: null,
        },
        {
          sku: 101,
          item_type: "general_merchandise",
          description: "Pierce Hoodie",
          title: null,
          author: null,
          isbn: null,
          edition: null,
          binding_id: null,
          imprint: null,
          copyright: null,
          text_status_id: null,
          status_date: null,
          book_key: null,
          barcode: "111222333444",
          vendor_id: 21,
          dcc_id: 44,
          item_tax_type_id: 4,
          catalog_number: "HD-101",
          tx_comment: "Front window",
          retail_price: 19.99,
          cost: 9.5,
          discontinued: false,
          alt_vendor_id: null,
          mfg_id: null,
          weight: null,
          package_type: "EA",
          units_per_pack: 1,
          order_increment: 1,
          image_url: null,
          size: "L",
          size_id: 9,
          color_id: 2,
          style_id: 5,
          item_season_code_id: 12,
          f_list_price_flag: false,
          f_perishable: false,
          f_id_required: false,
          min_order_qty_item: null,
          used_dcc_id: null,
          dept_name: "Apparel",
          class_name: "Sweatshirts",
          cat_name: null,
        },
      ],
      error: null,
    });
    mockInventoryLocationIn.mockResolvedValue({
      data: [
        {
          sku: 101,
          location_id: 4,
          retail_price: 18.5,
          cost: 9,
          expected_cost: 8.5,
          stock_on_hand: 2,
          last_sale_date: "2026-04-15",
          tag_type_id: 7,
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
          location_id: 2,
          retail_price: 19.99,
          cost: 9.5,
          expected_cost: 9,
          stock_on_hand: 5,
          last_sale_date: "2026-04-18",
          tag_type_id: 8,
          status_code_id: 11,
          est_sales: 9,
          est_sales_locked: true,
          f_inv_list_price_flag: true,
          f_tx_want_list_flag: false,
          f_tx_buyback_list_flag: false,
          f_no_returns: false,
        },
      ],
      error: null,
    });
  });

  it("returns ordered edit-context items with summary labels and Pierce-only inventory rows", async () => {
    const route = await loadRouteModule();

    const response = await route.POST(
      new NextRequest("http://localhost/api/products/edit-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus: [101, 202] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          sku: 101,
          itemType: "general_merchandise",
          summary: {
            sku: 101,
            displayName: "Pierce Hoodie",
            barcode: "111222333444",
            vendorLabel: "Acme Books",
            dccLabel: "Apparel / Sweatshirts",
            typeLabel: "Merchandise",
          },
          inventoryByLocation: [
            { locationId: 2, locationAbbrev: "PIER" },
            { locationId: 4, locationAbbrev: "PFS" },
          ],
        },
        {
          sku: 202,
          itemType: "textbook",
          summary: {
            sku: 202,
            displayName: "Biology 101",
            barcode: "999888777666",
            vendorLabel: null,
            dccLabel: "Texts / Biology",
            typeLabel: "Textbook",
          },
          inventoryByLocation: [],
        },
      ],
    });

    expect(mockProductsIn).toHaveBeenCalledWith("sku", [101, 202]);
    expect(mockInventorySkuIn).toHaveBeenCalledWith("sku", [101, 202]);
    expect(mockInventoryLocationIn).toHaveBeenCalledWith("location_id", [2, 3, 4]);
  });
});
