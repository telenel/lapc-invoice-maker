import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const { serverViewsMocks, MockProductViewDuplicateError } = vi.hoisted(() => {
  class ProductViewDuplicateError extends Error {
    constructor(nameValue: string) {
      super(`A view named "${nameValue}" already exists.`);
      this.name = "ProductViewDuplicateError";
    }
  }

  return {
    serverViewsMocks: {
      listProductViews: vi.fn(),
      createProductView: vi.fn(),
      deleteProductView: vi.fn(),
    },
    MockProductViewDuplicateError: ProductViewDuplicateError,
  };
});

vi.mock("@/domains/product/server-views", () => ({
  ProductViewDuplicateError: MockProductViewDuplicateError,
  listProductViews: serverViewsMocks.listProductViews,
  createProductView: serverViewsMocks.createProductView,
  deleteProductView: serverViewsMocks.deleteProductView,
}));

import { getServerSession } from "next-auth";
import { GET, POST } from "@/app/api/products/views/route";
import { DELETE } from "@/app/api/products/views/[id]/route";
import { PRODUCTS_PAGE_GROUPS } from "@/domains/product/view-groups";

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

    serverViewsMocks.listProductViews.mockResolvedValue({
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
    expect(serverViewsMocks.listProductViews).toHaveBeenCalledWith("u1");
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
    serverViewsMocks.createProductView.mockResolvedValue({
      id: "sv-new",
      name: "My Saved View",
      description: null,
      filter: { q: "widget" },
      columnPreferences: null,
      isSystem: false,
      slug: null,
      presetGroup: null,
      sortOrder: null,
    });

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
    expect(serverViewsMocks.createProductView).toHaveBeenCalledWith({
      userId: "u1",
      name: "My Saved View",
      description: null,
      filter: { q: "widget" },
      columnPreferences: null,
    });
  });

  it("returns 409 when a duplicate view name is rejected", async () => {
    serverViewsMocks.createProductView.mockRejectedValue(
      new MockProductViewDuplicateError("Duplicate"),
    );

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
    serverViewsMocks.deleteProductView.mockResolvedValue("not_found");

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
    serverViewsMocks.deleteProductView.mockResolvedValue("deleted");

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
    expect(serverViewsMocks.deleteProductView).toHaveBeenCalledWith({
      id: "v1",
      userId: "u1",
    });
  });
});
