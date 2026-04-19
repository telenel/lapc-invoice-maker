import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import {
  ProductViewDuplicateError,
  createProductView,
  deleteProductView,
  listProductViews,
} from "@/domains/product/server-views";

const { savedSearchMocks } = vi.hoisted(() => ({
  savedSearchMocks: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedSearch: savedSearchMocks,
  },
}));

describe("product server views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always returns the code-owned system preset catalog", async () => {
    savedSearchMocks.findMany.mockResolvedValue([
      {
        id: "mine-1",
        name: "My movers",
        description: "mine",
        filter: { minStock: "1" },
        columnPreferences: { visible: ["margin"] },
        isSystem: false,
        slug: null,
        presetGroup: null,
        sortOrder: null,
      },
    ]);

    const result = await listProductViews("user-1");

    expect(savedSearchMocks.findMany).toHaveBeenCalledWith({
      where: { ownerUserId: "user-1", isSystem: false },
      orderBy: { updatedAt: "desc" },
    });
    expect(result.system).toEqual(SYSTEM_PRESET_VIEWS);
    expect(result.mine).toEqual([
      {
        id: "mine-1",
        name: "My movers",
        description: "mine",
        filter: { minStock: "1" },
        columnPreferences: { visible: ["margin"] },
        isSystem: false,
        slug: null,
        presetGroup: null,
        sortOrder: null,
      },
    ]);
  });

  it("rejects duplicate user view names before insert", async () => {
    savedSearchMocks.findFirst.mockResolvedValue({ id: "existing-view" });

    await expect(
      createProductView({
        userId: "user-1",
        name: "My movers",
        description: null,
        filter: { minStock: "1" },
        columnPreferences: null,
      }),
    ).rejects.toBeInstanceOf(ProductViewDuplicateError);

    expect(savedSearchMocks.create).not.toHaveBeenCalled();
  });

  it("prevents deleting system presets through the user delete path", async () => {
    savedSearchMocks.findUnique.mockResolvedValue({
      id: "system-1",
      isSystem: true,
      ownerUserId: null,
    });

    const result = await deleteProductView({
      id: "system-1",
      userId: "user-1",
    });

    expect(result).toBe("system");
    expect(savedSearchMocks.delete).not.toHaveBeenCalled();
  });
});
