import { beforeEach, describe, expect, it, vi } from "vitest";
import { productApi } from "@/domains/product/api-client";

describe("productApi.editContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the selected SKU list to the edit-context route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              sku: 101,
              summary: {
                sku: 101,
                displayName: "Pierce Hoodie",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await productApi.editContext([101, 202]);

    expect(fetchMock).toHaveBeenCalledWith("/api/products/edit-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus: [101, 202] }),
      cache: "no-store",
    });
    expect(result).toMatchObject({
      items: [
        {
          sku: 101,
          summary: {
            displayName: "Pierce Hoodie",
          },
        },
      ],
    });
  });
});
