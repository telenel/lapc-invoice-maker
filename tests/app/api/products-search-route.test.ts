import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const { searchRouteMocks } = vi.hoisted(() => ({
  searchRouteMocks: {
    searchProductBrowseRows: vi.fn(),
  },
}));

vi.mock("@/domains/product/search-route", () => ({
  searchProductBrowseRows: searchRouteMocks.searchProductBrowseRows,
}));

import { getServerSession } from "next-auth";
import { searchProductBrowseRows } from "@/domains/product/search-route";
import { GET } from "@/app/api/products/search/route";

describe("GET /api/products/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(searchProductBrowseRows).mockResolvedValue({
      products: [
        {
          sku: 101,
          retail_price: 19.99,
          cost: 8.5,
          stock_on_hand: 10,
          primary_location_id: 3,
          primary_location_abbrev: "PCOP",
          selected_inventories: [],
          location_variance: {
            retailPriceVaries: false,
            costVaries: false,
            stockVaries: false,
            lastSaleDateVaries: false,
          },
        },
      ],
      total: 1,
      page: 2,
      pageSize: 50,
    } as never);
  });

  it("returns the authenticated search payload as JSON", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/products/search?tab=merchandise&loc=3,4&page=2"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      page: 2,
      pageSize: 50,
      products: [expect.objectContaining({ sku: 101, primary_location_id: 3 })],
    });
  });

  it("marks the route response as private and no-store", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/products/search?tab=merchandise&loc=3,4&page=2"),
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("calls the server search function once with parsed filters", async () => {
    await GET(
      new NextRequest("http://localhost/api/products/search?tab=merchandise&loc=3,4&page=2"),
    );

    expect(searchProductBrowseRows).toHaveBeenCalledTimes(1);
    expect(searchProductBrowseRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "merchandise",
        locationIds: [3, 4],
        page: 2,
      }),
      { countOnly: false },
    );
  });

  it("forwards countOnly requests to the server search path", async () => {
    await GET(
      new NextRequest("http://localhost/api/products/search?tab=merchandise&loc=3,4&page=2&countOnly=true"),
    );

    expect(searchProductBrowseRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "merchandise",
        locationIds: [3, 4],
        page: 2,
      }),
      { countOnly: true },
    );
  });
});
