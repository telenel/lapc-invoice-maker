import { afterEach, describe, expect, it, vi } from "vitest";
import { quoteApi } from "@/domains/quote/api-client";

describe("quoteApi.list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes creatorId filters for scoped dashboard queries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          quotes: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
        { status: 200 },
      ),
    );

    await quoteApi.list({
      quoteStatus: "SENT",
      creatorId: "user-123",
      pageSize: 10,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] ?? [];
    expect(typeof url).toBe("string");

    const requestUrl = new URL(String(url), "http://localhost");
    expect(requestUrl.pathname).toBe("/api/quotes");
    expect(requestUrl.searchParams.get("quoteStatus")).toBe("SENT");
    expect(requestUrl.searchParams.get("creatorId")).toBe("user-123");
    expect(requestUrl.searchParams.get("pageSize")).toBe("10");
  });
});
