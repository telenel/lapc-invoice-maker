import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PrismRefs as ApiClientPrismRefs } from "@/domains/product/api-client";
import {
  buildProductRefMaps,
  formatLookupLabel,
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

vi.mock("@/domains/product/vendor-directory", () => ({
  useProductRefDirectory: vi.fn(),
}));

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

  it("uses a neutral fallback when a lookup label is missing", () => {
    expect(formatLookupLabel(null, "Vendor unavailable")).toBe("Vendor unavailable");
  });

  it("shows an explicit refs error when the directory is unavailable", async () => {
    const { EditItemDialog } = await import("@/components/products/edit-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: null,
      lookups: buildProductRefMaps({
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      }),
      vendors: [],
      byId: new Map(),
      loading: false,
      available: false,
    });

    render(
      React.createElement(EditItemDialog, {
        open: true,
        onOpenChange: () => {},
        items: [
          {
            sku: 123,
            barcode: null,
            retail: 10,
            cost: 5,
            fDiscontinue: 0,
            description: "Example",
          },
        ],
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Vendor, department/class, and tax type lookups are disabled");
    expect(screen.getByLabelText(/Description/i)).toBeTruthy();
    expect(screen.getByLabelText(/Barcode/i)).toBeTruthy();
  });

  it("shows an explicit refs error in the bulk-edit transform panel when refs are unavailable", async () => {
    const { TransformPanel } = await import("@/components/bulk-edit/transform-panel");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: null,
      lookups: buildProductRefMaps({
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      }),
      vendors: [],
      byId: new Map(),
      loading: false,
      available: false,
    });

    render(
      React.createElement(TransformPanel, {
        transform: {
          pricing: { mode: "none" },
          catalog: {},
        } as never,
        onChange: () => {},
        onPreview: () => {},
        previewing: false,
        disabled: false,
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Reference data is unavailable right now");
  });

  it("shows an explicit refs error in the batch-add grid when refs are unavailable", async () => {
    const { BatchAddGrid } = await import("@/components/products/batch-add-grid");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: null,
      lookups: buildProductRefMaps({
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      }),
      vendors: [],
      byId: new Map(),
      loading: false,
      available: false,
    });

    render(
      React.createElement(BatchAddGrid, {
        onSubmitted: () => {},
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Couldn't load vendor / department / tax lookups");
    expect(screen.getByText("Apply to all")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Description for row 1"), {
      target: { value: "Sample item" },
    });
    expect(screen.getByRole("button", { name: "Validate" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Submit/i }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps the new-item dialog usable when refs are unavailable", async () => {
    const { NewItemDialog } = await import("@/components/products/new-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: null,
      lookups: buildProductRefMaps({
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      }),
      vendors: [],
      byId: new Map(),
      loading: false,
      available: false,
    });

    render(
      React.createElement(NewItemDialog, {
        open: true,
        onOpenChange: () => {},
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Reference data is unavailable right now");
    expect(screen.getByLabelText(/Description/i)).toBeTruthy();
    expect(screen.getByLabelText(/Barcode/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create item" }).hasAttribute("disabled")).toBe(true);
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
