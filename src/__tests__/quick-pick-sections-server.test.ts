import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  QuickPickSectionForbiddenError,
  QuickPickSectionSlugConflictError,
  createQuickPickSection,
  listQuickPickSections,
  previewQuickPickSection,
  summarizeQuickPickSectionScope,
  updateQuickPickSection,
} from "@/domains/quick-pick-sections/server";

const { prismaMocks } = vi.hoisted(() => ({
  prismaMocks: {
    quickPickSection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMocks,
}));

describe("quick pick sections server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists shared and caller-owned sections for non-admin callers and attaches live product counts", async () => {
    prismaMocks.quickPickSection.findMany.mockResolvedValue([
      {
        id: "section-1",
        name: "CopyTech Services",
        slug: "copytech-services",
        description: "CT-prefixed items",
        icon: "Package2",
        sortOrder: 10,
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [],
        isGlobal: true,
        includeDiscontinued: false,
        createdByUserId: "admin-1",
        createdAt: new Date("2026-04-22T08:00:00.000Z"),
        updatedAt: new Date("2026-04-22T08:00:00.000Z"),
      },
    ]);
    prismaMocks.$queryRawUnsafe.mockResolvedValueOnce([{ count: 12 }]);

    const result = await listQuickPickSections({
      role: "user",
      userId: "user-1",
    });

    expect(prismaMocks.quickPickSection.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { isGlobal: true },
          { createdByUserId: "user-1" },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "section-1",
        name: "CopyTech Services",
        productCount: 12,
      }),
    ]);
  });

  it("raises a readable slug conflict before insert", async () => {
    prismaMocks.quickPickSection.findFirst.mockResolvedValue({ id: "existing-section" });

    await expect(
      createQuickPickSection({
        name: "CopyTech Services",
        slug: "copytech-services",
        description: "",
        icon: "Package2",
        sortOrder: 0,
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: "",
        explicitSkus: [],
        isGlobal: true,
        includeDiscontinued: false,
        createdByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(QuickPickSectionSlugConflictError);

    expect(prismaMocks.quickPickSection.create).not.toHaveBeenCalled();
  });

  it("translates a Prisma unique violation into the same slug conflict error", async () => {
    prismaMocks.quickPickSection.findFirst.mockResolvedValue(null);
    prismaMocks.quickPickSection.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      createQuickPickSection({
        name: "CopyTech Services",
        slug: "copytech-services",
        description: "",
        icon: "Package2",
        sortOrder: 0,
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: "",
        explicitSkus: [],
        isGlobal: true,
        includeDiscontinued: false,
        createdByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(QuickPickSectionSlugConflictError);
  });

  it("clears nullable fields on update instead of restoring the previous values", async () => {
    prismaMocks.quickPickSection.findUnique.mockResolvedValue({
      id: "section-1",
      name: "CopyTech Services",
      slug: "copytech-services",
      description: "Old description",
      icon: "Printer",
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: true,
      includeDiscontinued: false,
      createdByUserId: null,
      createdAt: new Date("2026-04-22T08:00:00.000Z"),
      updatedAt: new Date("2026-04-22T08:00:00.000Z"),
    });
    prismaMocks.quickPickSection.update.mockResolvedValue({
      id: "section-1",
      name: "CopyTech Services",
      slug: "copytech-services",
      description: null,
      icon: null,
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: true,
      includeDiscontinued: false,
      createdByUserId: null,
      createdAt: new Date("2026-04-22T08:00:00.000Z"),
      updatedAt: new Date("2026-04-22T08:00:00.000Z"),
    });
    prismaMocks.$queryRawUnsafe.mockResolvedValueOnce([{ count: 12 }]);

    const result = await updateQuickPickSection("section-1", {
      description: "",
      icon: "",
    });

    expect(prismaMocks.quickPickSection.update).toHaveBeenCalledWith({
      where: { id: "section-1" },
      data: expect.objectContaining({
        description: null,
        icon: null,
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        description: null,
        icon: null,
      }),
    );
  });

  it("lets non-admin users update their own personal sections but not make them shared", async () => {
    prismaMocks.quickPickSection.findUnique.mockResolvedValue({
      id: "section-1",
      name: "My Picks",
      slug: "my-picks",
      description: null,
      icon: "Package2",
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: false,
      includeDiscontinued: false,
      createdByUserId: "user-1",
      createdAt: new Date("2026-04-22T08:00:00.000Z"),
      updatedAt: new Date("2026-04-22T08:00:00.000Z"),
    });
    prismaMocks.quickPickSection.update.mockResolvedValue({
      id: "section-1",
      name: "My Picks",
      slug: "my-picks",
      description: null,
      icon: "Package2",
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: false,
      includeDiscontinued: false,
      createdByUserId: "user-1",
      createdAt: new Date("2026-04-22T08:00:00.000Z"),
      updatedAt: new Date("2026-04-22T08:00:00.000Z"),
    });
    prismaMocks.$queryRawUnsafe.mockResolvedValueOnce([{ count: 12 }]);

    await updateQuickPickSection(
      "section-1",
      { isGlobal: true },
      { role: "user", userId: "user-1" },
    );

    expect(prismaMocks.quickPickSection.update).toHaveBeenCalledWith({
      where: { id: "section-1" },
      data: expect.objectContaining({
        isGlobal: false,
      }),
    });
  });

  it("rejects non-admin updates to shared sections", async () => {
    prismaMocks.quickPickSection.findUnique.mockResolvedValue({
      id: "section-1",
      name: "Shared Picks",
      slug: "shared-picks",
      description: null,
      icon: "Package2",
      sortOrder: 0,
      descriptionLike: "CT %",
      dccIds: [],
      vendorIds: [],
      itemType: null,
      explicitSkus: [],
      isGlobal: true,
      includeDiscontinued: false,
      createdByUserId: "admin-1",
      createdAt: new Date("2026-04-22T08:00:00.000Z"),
      updatedAt: new Date("2026-04-22T08:00:00.000Z"),
    });

    await expect(
      updateQuickPickSection(
        "section-1",
        { name: "Updated" },
        { role: "user", userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(QuickPickSectionForbiddenError);

    expect(prismaMocks.quickPickSection.update).not.toHaveBeenCalled();
  });

  it("returns an empty disabled preview without querying products when the scope is blank", async () => {
    const preview = await previewQuickPickSection({
      descriptionLike: "",
      dccIds: [],
      vendorIds: [],
      itemType: "",
      explicitSkus: [],
      includeDiscontinued: false,
    });

    expect(preview).toEqual({
      isEmpty: true,
      productCount: 0,
      products: [],
    });
    expect(prismaMocks.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("summarizes the configured scope in human-readable language", () => {
    expect(
      summarizeQuickPickSectionScope({
        descriptionLike: "CT %",
        dccIds: [101, 202],
        vendorIds: [44],
        itemType: "supplies",
        explicitSkus: [8801, 8802, 8803],
        includeDiscontinued: true,
      }),
    ).toContain("Description contains CT %");
  });
});
