import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismRefs as ApiClientPrismRefs } from "@/domains/product/api-client";
import {
  buildProductRefMaps,
  loadCommittedProductRefSnapshot,
  normalizePackageTypeLabel,
  sortRefsByUsageThenLabel,
} from "@/domains/product/ref-data";

const queryLog: string[] = [];

vi.mock("@/lib/prism", () => {
  const request = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn(async (query: string) => {
      queryLog.push(query);
      return { recordset: [] };
    }),
  };

  return {
    getPrismPool: vi.fn(async () => ({
      request: () => request,
    })),
    sql: {
      Int: "Int",
    },
  };
});

beforeEach(() => {
  queryLog.length = 0;
});

describe("product ref data helpers", () => {
  it("loads the committed snapshot with the full Phase 2 contract", async () => {
    const refs = await loadCommittedProductRefSnapshot();

    const currentRouteShape: ApiClientPrismRefs = refs;

    expect(currentRouteShape.vendors[0]).toMatchObject({ vendorId: 21, name: "PENS ETC (3001795)" });
    expect(currentRouteShape.taxTypes[0]).toMatchObject({ taxTypeId: 4, description: "STATE" });
    expect(currentRouteShape.dccs[0]).toMatchObject({
      dccId: 1313290,
      deptName: "NOT USE=111010",
      className: "DO NOT USE",
    });

    expect(refs.tagTypes[0]).toMatchObject({ tagTypeId: 3, label: "LARGE w/Price/Color" });
    expect(refs.statusCodes[0]).toMatchObject({ statusCodeId: 2, label: "Active" });
    expect(refs.packageTypes[0]).toMatchObject({ code: "EA", label: "Each" });
    expect(refs.colors[0]).toMatchObject({ colorId: 2, label: "BLACK" });
    expect(refs.bindings[0]).toMatchObject({ bindingId: 15, label: "PAPERBACK" });
  });

  it("builds label maps for every Phase 2 ref family", async () => {
    const refs = await loadCommittedProductRefSnapshot();
    const maps = buildProductRefMaps(refs);

    expect(maps.vendorNames.get(21)).toBe("PENS ETC (3001795)");
    expect(maps.taxTypeLabels.get(4)).toBe("STATE");
    expect(maps.tagTypeLabels.get(3)).toBe("LARGE w/Price/Color");
    expect(maps.statusCodeLabels.get(2)).toBe("Active");
    expect(maps.packageTypeLabels.get("EA")).toBe("Each");
    expect(maps.packageTypeLabels.get("CS")).toBe("CS");
    expect(maps.colorLabels.get(2)).toBe("BLACK");
    expect(maps.bindingLabels.get(15)).toBe("PAPERBACK");
  });

  it("breaks usage ties alphabetically", () => {
    const sorted = sortRefsByUsageThenLabel([
      { id: 1, label: "Bravo", usageCount: 5 },
      { id: 2, label: "Alpha", usageCount: 5 },
      { id: 3, label: "Zulu", usageCount: 9 },
    ]);

    expect(sorted.map((row) => row.id)).toEqual([3, 2, 1]);
  });

  it("falls back to the code when a package-type label is blank", () => {
    expect(normalizePackageTypeLabel({ code: "CS", label: null })).toBe("CS");
  });

  it("builds Pierce-wide live ref queries with usage-count semantics", async () => {
    const {
      listBindings,
      listColors,
      listDccs,
      listPackageTypes,
      listStatusCodes,
      listTagTypes,
      listTaxTypes,
      listVendors,
    } = await import("@/domains/product/prism-server");

    await Promise.all([
      listVendors(),
      listDccs(),
      listTaxTypes(),
      listTagTypes(),
      listStatusCodes(),
      listPackageTypes(),
      listColors(),
      listBindings(),
    ]);

    const combined = queryLog.join("\n");
    expect(combined).toContain("inv.LocationID IN (2, 3, 4)");
    expect(combined).toContain("COUNT(DISTINCT i.SKU) AS PierceItems");
    expect(combined).toContain("COUNT_BIG(*) AS PierceRows");
    expect(combined).toContain("COUNT(DISTINCT i.SKU) AS PierceBooks");
  });
});
