import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, PAGE_SIZE } from "@/domains/product/constants";

const { supabaseBrowserMock } = vi.hoisted(() => ({
  supabaseBrowserMock: vi.fn(() => {
    throw new Error("browser Supabase search path should not run");
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: supabaseBrowserMock,
}));

import { searchProducts } from "@/domains/product/queries";

describe("searchProducts route client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("calls the authenticated route with serialized filters including loc", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ sku: 101 }],
        total: 1,
        page: 2,
        pageSize: PAGE_SIZE,
      }),
    } as Response);

    await searchProducts({
      ...EMPTY_FILTERS,
      tab: "merchandise",
      search: "hoodie",
      page: 2,
      locationIds: [4, 3],
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0]!;
    const requestUrl = new URL(String(url), "http://localhost");

    expect(requestUrl.pathname).toBe("/api/products/search");
    expect(requestUrl.searchParams.get("tab")).toBe("merchandise");
    expect(requestUrl.searchParams.get("search")).toBe("hoodie");
    expect(requestUrl.searchParams.get("page")).toBe("2");
    expect(requestUrl.searchParams.get("loc")).toBe("3,4");
    expect(supabaseBrowserMock).not.toHaveBeenCalled();
  });

  it("serializes quick-pick section filters onto the authenticated route", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ sku: 101 }],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    } as Response);

    await searchProducts({
      ...EMPTY_FILTERS,
      tab: "quickPicks",
      sectionSlug: "copytech-services",
      allSections: true,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0]!;
    const requestUrl = new URL(String(url), "http://localhost");

    expect(requestUrl.searchParams.get("tab")).toBe("quickPicks");
    expect(requestUrl.searchParams.get("sectionSlug")).toBe("copytech-services");
    expect(requestUrl.searchParams.get("allSections")).toBe("true");
  });

  it("uses no-store fetch caching for browse reads", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    } as Response);

    await searchProducts(EMPTY_FILTERS);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/products\/search(?:\?|$)/),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("routes count-only requests through the server endpoint instead of the browser query path", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [],
        total: 7,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    } as Response);

    const result = await searchProducts(
      {
        ...EMPTY_FILTERS,
        tab: "merchandise",
      },
      { countOnly: true },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0]!;
    const requestUrl = new URL(String(url), "http://localhost");
    expect(requestUrl.pathname).toBe("/api/products/search");
    expect(requestUrl.searchParams.get("countOnly")).toBe("true");
    expect(supabaseBrowserMock).not.toHaveBeenCalled();
    expect(result.products).toEqual([]);
    expect(result.total).toBe(7);
  });
});
