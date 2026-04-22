import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { QuickPickSectionDto, QuickPickSectionPreviewResult } from "@/domains/quick-pick-sections/types";
import {
  DELETE,
  PATCH,
} from "@/app/api/quick-pick-sections/[id]/route";
import {
  GET,
  POST,
} from "@/app/api/quick-pick-sections/route";
import { POST as POST_PREVIEW } from "@/app/api/quick-pick-sections/preview/route";

const { getServerSessionMock, serverMocks } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  serverMocks: {
    listQuickPickSections: vi.fn(),
    createQuickPickSection: vi.fn(),
    updateQuickPickSection: vi.fn(),
    deleteQuickPickSection: vi.fn(),
    previewQuickPickSection: vi.fn(),
    QuickPickSectionSlugConflictError: class QuickPickSectionSlugConflictError extends Error {},
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/domains/quick-pick-sections/server", () => serverMocks);

describe("quick pick sections routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 on GET when the caller is unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/quick-pick-sections"),
    );

    expect(response.status).toBe(401);
  });

  it("allows signed-in callers to GET visible sections", async () => {
    const items: QuickPickSectionDto[] = [
      {
        id: "section-1",
        name: "CopyTech Services",
        slug: "copytech-services",
        description: "CT-prefixed products",
        icon: "Package2",
        sortOrder: 10,
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [],
        isGlobal: true,
        includeDiscontinued: false,
        productCount: 12,
        createdByUserId: "admin-1",
        createdAt: "2026-04-22T08:00:00.000Z",
        updatedAt: "2026-04-22T08:00:00.000Z",
        scopeSummary: "Description like CT %",
      },
    ];
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });
    serverMocks.listQuickPickSections.mockResolvedValue(items);

    const response = await GET(
      new NextRequest("http://localhost/api/quick-pick-sections"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items });
  });

  it("returns 403 on POST when the caller is not an admin", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/quick-pick-sections", {
        method: "POST",
        body: JSON.stringify({ name: "CopyTech Services" }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 with a readable message when create hits a slug collision", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    serverMocks.createQuickPickSection.mockRejectedValue(
      new serverMocks.QuickPickSectionSlugConflictError("Slug already exists."),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quick-pick-sections", {
        method: "POST",
        body: JSON.stringify({
          name: "CopyTech Services",
          slug: "copytech-services",
          sortOrder: 0,
          isGlobal: true,
          includeDiscontinued: false,
          dccIds: [],
          vendorIds: [],
          explicitSkus: [],
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Slug already exists.",
    });
  });

  it("returns 403 on PATCH when the caller is not an admin", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/quick-pick-sections/section-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "section-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 204 on DELETE for admins", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    serverMocks.deleteQuickPickSection.mockResolvedValue("deleted");

    const response = await DELETE(
      new NextRequest("http://localhost/api/quick-pick-sections/section-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "section-1" }) },
    );

    expect(response.status).toBe(204);
  });

  it("locks preview behind the same admin boundary", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });

    const response = await POST_PREVIEW(
      new NextRequest("http://localhost/api/quick-pick-sections/preview", {
        method: "POST",
        body: JSON.stringify({
          descriptionLike: "CT %",
          dccIds: [],
          vendorIds: [],
          explicitSkus: [],
          includeDiscontinued: false,
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("returns preview payloads for admins", async () => {
    const preview: QuickPickSectionPreviewResult = {
      isEmpty: false,
      productCount: 12,
      products: [
        {
          sku: 8801,
          itemType: "supplies",
          title: null,
          description: "CT PAPER",
          catalogNumber: "CT-1",
          author: null,
          isbn: null,
          edition: null,
          discontinued: false,
        },
      ],
    };
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    serverMocks.previewQuickPickSection.mockResolvedValue(preview);

    const response = await POST_PREVIEW(
      new NextRequest("http://localhost/api/quick-pick-sections/preview", {
        method: "POST",
        body: JSON.stringify({
          descriptionLike: "CT %",
          dccIds: [],
          vendorIds: [],
          explicitSkus: [],
          includeDiscontinued: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(preview);
  });
});
