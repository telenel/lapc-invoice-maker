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
    QuickPickSectionForbiddenError: class QuickPickSectionForbiddenError extends Error {},
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
        scopeSummary: "Description contains CT %",
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
    expect(serverMocks.listQuickPickSections).toHaveBeenCalledWith({
      role: "user",
      userId: "user-1",
    });
  });

  it("allows signed-in non-admin callers to create personal sections", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });
    serverMocks.createQuickPickSection.mockResolvedValue({
      id: "section-1",
      name: "CopyTech Services",
      slug: "copytech-services",
      description: null,
      icon: "ReceiptText",
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: false,
      includeDiscontinued: false,
      productCount: 12,
      createdByUserId: "user-1",
      createdAt: "2026-04-22T08:00:00.000Z",
      updatedAt: "2026-04-22T08:00:00.000Z",
      scopeSummary: "Description contains CT %",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/quick-pick-sections", {
        method: "POST",
        body: JSON.stringify({
          name: "CopyTech Services",
          icon: "ReceiptText",
          sortOrder: 0,
          isGlobal: true,
          includeDiscontinued: false,
          descriptionLike: "CT %",
          dccIds: [],
          vendorIds: [],
          explicitSkus: [],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(serverMocks.createQuickPickSection).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "ReceiptText",
        isGlobal: false,
        createdByUserId: "user-1",
      }),
    );
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

  it("returns 403 on PATCH when the caller cannot manage the section", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });
    serverMocks.updateQuickPickSection.mockRejectedValue(
      new serverMocks.QuickPickSectionForbiddenError("No access."),
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/quick-pick-sections/section-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "section-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "No access." });
  });

  it("accepts the seeded Printer icon on PATCH for admins", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    serverMocks.updateQuickPickSection.mockResolvedValue({
      id: "section-1",
      name: "CopyTech Services",
      slug: "copytech-services",
      description: "In-house print shop services",
      icon: "Printer",
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: true,
      includeDiscontinued: false,
      productCount: 12,
      createdByUserId: null,
      createdAt: "2026-04-22T08:00:00.000Z",
      updatedAt: "2026-04-22T08:00:00.000Z",
      scopeSummary: "Description contains CT %",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/quick-pick-sections/section-1", {
        method: "PATCH",
        body: JSON.stringify({ icon: "Printer" }),
      }),
      { params: Promise.resolve({ id: "section-1" }) },
    );

    expect(response.status).toBe(200);
    expect(serverMocks.updateQuickPickSection).toHaveBeenCalledWith(
      "section-1",
      {
        icon: "Printer",
        slug: undefined,
        description: undefined,
        descriptionLike: undefined,
        itemType: undefined,
      },
      { role: "admin", userId: "admin-1" },
    );
  });

  it("preserves explicit null clears on PATCH for admins", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    serverMocks.updateQuickPickSection.mockResolvedValue({
      id: "section-1",
      name: "CopyTech Services",
      slug: "copytech-services",
      description: null,
      icon: null,
      sortOrder: 0,
      descriptionLike: null,
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: true,
      includeDiscontinued: false,
      productCount: 12,
      createdByUserId: null,
      createdAt: "2026-04-22T08:00:00.000Z",
      updatedAt: "2026-04-22T08:00:00.000Z",
      scopeSummary: "Empty scope",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/quick-pick-sections/section-1", {
        method: "PATCH",
        body: JSON.stringify({
          description: null,
          icon: null,
          descriptionLike: null,
          itemType: null,
        }),
      }),
      { params: Promise.resolve({ id: "section-1" }) },
    );

    expect(response.status).toBe(200);
    expect(serverMocks.updateQuickPickSection).toHaveBeenCalledWith(
      "section-1",
      {
        description: null,
        icon: null,
        descriptionLike: null,
        itemType: null,
        slug: undefined,
      },
      { role: "admin", userId: "admin-1" },
    );
  });

  it("preserves a null slug on PATCH so the server can regenerate it", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    serverMocks.updateQuickPickSection.mockResolvedValue({
      id: "section-1",
      name: "Campus Services",
      slug: "campus-services",
      description: null,
      icon: null,
      sortOrder: 0,
      descriptionLike: null,
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: true,
      includeDiscontinued: false,
      productCount: 12,
      createdByUserId: null,
      createdAt: "2026-04-22T08:00:00.000Z",
      updatedAt: "2026-04-22T08:00:00.000Z",
      scopeSummary: "Empty scope",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/quick-pick-sections/section-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Campus Services",
          slug: null,
        }),
      }),
      { params: Promise.resolve({ id: "section-1" }) },
    );

    expect(response.status).toBe(200);
    expect(serverMocks.updateQuickPickSection).toHaveBeenCalledWith(
      "section-1",
      {
        name: "Campus Services",
        slug: null,
      },
      { role: "admin", userId: "admin-1" },
    );
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

  it("returns preview payloads for signed-in non-admin users", async () => {
    const preview: QuickPickSectionPreviewResult = {
      isEmpty: false,
      productCount: 4,
      products: [],
    };
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", role: "user" },
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
