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
import { GET, POST, PRODUCTS_PAGE_GROUPS } from "@/app/api/products/views/route";
import { DELETE } from "@/app/api/products/views/[id]/route";

type QueryResult = { data: unknown; error: unknown };

/**
 * Build a chainable Supabase query builder that resolves to the given result
 * when awaited or when a terminator (.single()) is invoked.
 *
 * Each chain method returns the same proxy so we can cover arbitrary chains
 * like .select().eq().in().order().order() without enumerating every method.
 */
function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "then") {
        // Make the builder thenable so `await builder` resolves to `result`.
        return (
          resolve: (v: QueryResult) => void,
          reject?: (err: unknown) => void,
        ) => {
          try {
            resolve(result);
          } catch (err) {
            reject?.(err);
          }
        };
      }
      if (prop === "single") {
        return () => Promise.resolve(result);
      }
      // Any other chain method returns the proxy itself.
      return () => proxy;
    },
  };
  const proxy = new Proxy(builder, handler);
  return proxy;
}

/**
 * Build a supabase client mock whose `.from(table)` returns a builder that
 * resolves to `result`. If you need two different results (GET calls .from
 * twice), pass an array and the mock will return them in order.
 */
function makeSupabaseMock(results: QueryResult | QueryResult[]) {
  const queue = Array.isArray(results) ? [...results] : [results];
  const from = vi.fn(() => {
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    return makeQueryBuilder(next);
  });
  return { from };
}

describe("GET /api/products/views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is null", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const response = await GET(
      new NextRequest("http://localhost/api/products/views"),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns {system, mine} arrays scoped by filters", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);

    const systemRow = {
      id: "sv-sys",
      name: "Dead Weight",
      description: "No movement",
      filter: { hasMovement: false },
      column_preferences: null,
      is_system: true,
      slug: "dead-weight",
      preset_group: "dead-weight",
      sort_order: 1,
    };
    const mineRow = {
      id: "sv-mine",
      name: "My View",
      description: null,
      filter: { q: "shirt" },
      column_preferences: { visible: ["sku", "description"] },
      is_system: false,
      slug: null,
      preset_group: null,
      sort_order: null,
    };

    const supabaseMock = makeSupabaseMock([
      { data: [systemRow], error: null },
      { data: [mineRow], error: null },
    ]);
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as never);

    const response = await GET(
      new NextRequest("http://localhost/api/products/views"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      system: [
        {
          id: "sv-sys",
          name: "Dead Weight",
          description: "No movement",
          filter: { hasMovement: false },
          columnPreferences: null,
          isSystem: true,
          slug: "dead-weight",
          presetGroup: "dead-weight",
          sortOrder: 1,
        },
      ],
      mine: [
        {
          id: "sv-mine",
          name: "My View",
          description: null,
          filter: { q: "shirt" },
          columnPreferences: { visible: ["sku", "description"] },
          isSystem: false,
          slug: null,
          presetGroup: null,
          sortOrder: null,
        },
      ],
    });
    expect(supabaseMock.from).toHaveBeenCalledWith("saved_searches");
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
  });

  it("includes every products-page preset group in the server allow-list", () => {
    expect(PRODUCTS_PAGE_GROUPS).toEqual([
      "dead-weight",
      "movers",
      "trending",
      "stock-health",
      "data-quality",
      "pricing",
      "recent-activity",
      "textbook",
    ]);
  });
});

describe("POST /api/products/views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
  });

  it("returns 401 when session is null", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const response = await POST(
      new NextRequest("http://localhost/api/products/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", filter: {} }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 201 on valid body", async () => {
    const insertedRow = {
      id: "sv-new",
      name: "My Saved View",
      description: null,
      filter: { q: "widget" },
      column_preferences: null,
      is_system: false,
      slug: null,
      preset_group: null,
      sort_order: null,
    };
    const supabaseMock = makeSupabaseMock({ data: insertedRow, error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as never);

    const response = await POST(
      new NextRequest("http://localhost/api/products/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Saved View", filter: { q: "widget" } }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      id: "sv-new",
      name: "My Saved View",
      isSystem: false,
      filter: { q: "widget" },
    });
    expect(supabaseMock.from).toHaveBeenCalledWith("saved_searches");
  });

  it("returns 409 when Supabase reports a unique-violation (code 23505)", async () => {
    const supabaseMock = makeSupabaseMock({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as never);

    const response = await POST(
      new NextRequest("http://localhost/api/products/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Duplicate", filter: {} }),
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("Duplicate");
  });

  it("returns 400 on invalid body (missing name)", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/products/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: {} }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid body (missing filter)", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/products/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Filter" }),
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/products/views/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
  });

  it("returns 404 when the row isn't owned by the caller or doesn't exist", async () => {
    const supabaseMock = makeSupabaseMock({ data: null, error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as never);

    const response = await DELETE(
      new NextRequest("http://localhost/api/products/views/nope", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "nope" }),
      } as never,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 200 and { ok: true } on successful delete", async () => {
    const supabaseMock = makeSupabaseMock({ data: { id: "v1" }, error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock as never);

    const response = await DELETE(
      new NextRequest("http://localhost/api/products/views/v1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "v1" }),
      } as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });
});
