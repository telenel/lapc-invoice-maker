import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PrismRefs as ApiClientPrismRefs } from "@/domains/product/api-client";
import {
  buildProductRefSelectOptions,
  buildProductRefMaps,
  formatDccLabel,
  formatLookupLabel,
  normalizePackageTypeLabel,
  sortRefsByUsageThenLabel,
} from "@/domains/product/ref-data";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data-server";

const queryLog: string[] = [];
const productApiCreateMock = vi.fn();
const productApiBatchMock = vi.fn();

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

vi.mock("@/components/products/item-ref-selects", () => ({
  ItemRefSelects: ({
    vendorId,
    dccId,
    itemTaxTypeId,
    onChange,
  }: {
    vendorId: string;
    dccId: string;
    itemTaxTypeId: string;
    onChange: (field: "vendorId" | "dccId" | "itemTaxTypeId", value: string) => void;
  }) =>
    React.createElement(
      "div",
      {},
      React.createElement("label", { htmlFor: "vendor-test" }, "Vendor"),
      React.createElement("input", {
        id: "vendor-test",
        "aria-label": "Vendor",
        value: vendorId,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange("vendorId", event.target.value),
      }),
      React.createElement("label", { htmlFor: "dcc-test" }, "Department / Class"),
      React.createElement("input", {
        id: "dcc-test",
        "aria-label": "Department / Class",
        value: dccId,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange("dccId", event.target.value),
      }),
      React.createElement("label", { htmlFor: "tax-test" }, "Tax Type"),
      React.createElement("input", {
        id: "tax-test",
        "aria-label": "Tax Type",
        value: itemTaxTypeId,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange("itemTaxTypeId", event.target.value),
      }),
    ),
  ItemRefSelectField: ({
    value,
    label,
    kind,
    onChange,
  }: {
    value: string;
    label?: string;
    kind?: "vendor" | "dcc" | "taxType";
    onChange: (value: string) => void;
  }) => {
    const resolvedLabel =
      label ??
      (kind === "vendor"
        ? "Vendor"
        : kind === "dcc"
          ? "Department / Class"
          : "Tax Type");
    const id = `${resolvedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-field`;
    return React.createElement(
      "div",
      {},
      React.createElement("label", { htmlFor: id }, resolvedLabel),
      React.createElement("input", {
        id,
        "aria-label": resolvedLabel,
        value,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value),
      }),
    );
  },
}));

vi.mock("@/domains/product/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/domains/product/api-client")>(
    "@/domains/product/api-client",
  );
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      batch: productApiBatchMock,
      create: productApiCreateMock,
    },
  };
});

beforeEach(() => {
  queryLog.length = 0;
  productApiBatchMock.mockReset();
  productApiCreateMock.mockReset();
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

  it("formats DCC labels consistently for label-backed selects", () => {
    expect(formatDccLabel({ deptName: "Clothing", className: "Hoodies" })).toBe("Clothing / Hoodies");
    expect(formatDccLabel({ deptName: "Clothing", className: null })).toBe("Clothing");
  });

  it("builds select options for the phase 4 ref-backed fields without changing API order", async () => {
    const refs = await loadCommittedProductRefSnapshot();
    const options = buildProductRefSelectOptions(refs);

    expect(options.vendors[0]).toEqual({
      value: "21",
      label: "PENS ETC (3001795)",
      usageCount: refs.vendors[0]?.pierceItems ?? 0,
    });
    expect(options.dccs[0]?.label).toBe("NOT USE=111010 / DO NOT USE");
    expect(options.taxTypes[0]).toEqual({
      value: "4",
      label: "STATE",
      usageCount: refs.taxTypes[0]?.pierceItems ?? 0,
    });
    expect(options.packageTypes[0]?.label).toBe("Each");
    expect(options.colors[0]?.label).toBe("BLACK");
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
          fieldIds: ["vendorId"],
          inventoryScope: null,
          values: {},
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
    expect(screen.getByRole("button", { name: /More fields/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create item" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows the short GM create form by default and moves optional fields behind expand", async () => {
    const { NewItemDialog } = await import("@/components/products/new-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: {
        vendors: [{ vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 12 }],
        dccs: [{ dccId: 1313290, deptNum: 20, classNum: 10, catNum: 10, deptName: "Clothing", className: "Hoodies", catName: null, pierceItems: 8 }],
        taxTypes: [{ taxTypeId: 6, description: "TAXABLE", pierceItems: 20 }],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      },
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
      available: true,
    });

    render(
      React.createElement(NewItemDialog, {
        open: true,
        onOpenChange: () => {},
      }),
    );

    expect(screen.getByLabelText(/Description/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Vendor$/i)).toBeTruthy();
    expect(screen.getByLabelText(/Department \/ Class/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Retail\b/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Cost\b/i)).toBeTruthy();

    expect(screen.queryByLabelText(/Barcode/i)).toBeNull();
    expect(screen.queryByLabelText(/Tax Type/i)).toBeNull();
    expect(screen.queryByLabelText(/Catalog #/i)).toBeNull();
    expect(screen.queryByLabelText(/Comment/i)).toBeNull();

    expect(screen.getByLabelText("PIER").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("PCOP").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("PFS").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("PIER").getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /More fields/i }));

    expect(screen.getByLabelText(/Barcode/i)).toBeTruthy();
    expect(screen.getByLabelText(/Tax Type/i)).toBeTruthy();
    expect(screen.getByLabelText(/Catalog #/i)).toBeTruthy();
    expect(screen.getByLabelText(/Internal note/i)).toBeTruthy();
  });

  it("sends inventory rows for the selected locations and supports copy from PIER", async () => {
    const { NewItemDialog } = await import("@/components/products/new-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    productApiCreateMock.mockResolvedValue({
      sku: 12345,
      description: "Pierce mug",
      vendorId: 21,
      dccId: 1313290,
      barcode: null,
      retail: 19.99,
      cost: 8.5,
    });

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: {
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      },
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
      available: true,
    });

    render(
      React.createElement(NewItemDialog, {
        open: true,
        onOpenChange: () => {},
      }),
    );

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Pierce mug" },
    });
    fireEvent.change(screen.getByLabelText(/^Vendor$/i), {
      target: { value: "21" },
    });
    fireEvent.change(screen.getByLabelText(/Department \/ Class/i), {
      target: { value: "1313290" },
    });
    fireEvent.change(screen.getByLabelText(/^Retail\b/i), {
      target: { value: "19.99" },
    });
    fireEvent.change(screen.getByLabelText(/^Cost\b/i), {
      target: { value: "8.50" },
    });

    fireEvent.change(screen.getByLabelText(/PCOP Retail/i), {
      target: { value: "24.99" },
    });
    fireEvent.change(screen.getByLabelText(/PCOP Cost/i), {
      target: { value: "11.25" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy from PIER to PFS/i }));

    fireEvent.click(screen.getByRole("button", { name: "Create item" }));

    expect(productApiCreateMock).toHaveBeenCalledWith({
      description: "Pierce mug",
      vendorId: 21,
      dccId: 1313290,
      itemTaxTypeId: 6,
      barcode: null,
      catalogNumber: null,
      comment: null,
      retail: 19.99,
      cost: 8.5,
      inventory: [
        { locationId: 2, retail: 19.99, cost: 8.5 },
        { locationId: 3, retail: 24.99, cost: 11.25 },
        { locationId: 4, retail: 19.99, cost: 8.5 },
      ],
    });
  });

  it("inherits the current location scope when opening the new-item dialog", async () => {
    const { NewItemDialog } = await import("@/components/products/new-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    productApiCreateMock.mockResolvedValue({
      sku: 12345,
      description: "Pierce mug",
      vendorId: 21,
      dccId: 1313290,
      barcode: null,
      retail: 19.99,
      cost: 8.5,
    });

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: {
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      },
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
      available: true,
    });

    render(
      React.createElement(NewItemDialog, {
        open: true,
        onOpenChange: () => {},
        locationIds: [3, 4],
        primaryLocationId: 3,
      }),
    );

    expect(screen.getByText(/primary location: PCOP/i)).toBeTruthy();
    expect(screen.getByText(/current scope: PCOP, PFS/i)).toBeTruthy();
    expect(screen.getByLabelText("PIER").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("PCOP").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("PFS").getAttribute("aria-checked")).toBe("true");

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Pierce mug" },
    });
    fireEvent.change(screen.getByLabelText(/^Vendor$/i), {
      target: { value: "21" },
    });
    fireEvent.change(screen.getByLabelText(/Department \/ Class/i), {
      target: { value: "1313290" },
    });
    fireEvent.change(screen.getByLabelText(/^Retail\b/i), {
      target: { value: "19.99" },
    });
    fireEvent.change(screen.getByLabelText(/^Cost\b/i), {
      target: { value: "8.50" },
    });
    fireEvent.change(screen.getByLabelText(/PCOP Retail/i), {
      target: { value: "24.99" },
    });
    fireEvent.change(screen.getByLabelText(/PCOP Cost/i), {
      target: { value: "11.25" },
    });
    fireEvent.change(screen.getByLabelText(/PFS Retail/i), {
      target: { value: "21.99" },
    });
    fireEvent.change(screen.getByLabelText(/PFS Cost/i), {
      target: { value: "10.25" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create item" }));

    expect(productApiCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: [
          { locationId: 2, retail: 19.99, cost: 8.5 },
          { locationId: 3, retail: 24.99, cost: 11.25 },
          { locationId: 4, retail: 21.99, cost: 10.25 },
        ],
      }),
    );
  });

  it("submits batch-add rows with the inherited location scope inventory", async () => {
    const { BatchAddGrid } = await import("@/components/products/batch-add-grid");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    productApiBatchMock.mockResolvedValue({
      action: "create",
      count: 1,
      skus: [1001],
    });

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: {
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      },
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
      available: true,
    });

    render(
      React.createElement(BatchAddGrid, {
        locationIds: [4],
        primaryLocationId: 4,
        onSubmitted: () => {},
      }),
    );

    expect(screen.getByText(/primary location: PFS/i)).toBeTruthy();
    expect(screen.getByText(/selected inventory rows: PIER, PFS/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Description for row 1"), {
      target: { value: "Pierce mug" },
    });
    fireEvent.change(screen.getByLabelText(/^Vendor$/i), {
      target: { value: "21" },
    });
    fireEvent.change(screen.getByLabelText(/Department \/ Class/i), {
      target: { value: "1313290" },
    });
    fireEvent.change(screen.getByLabelText("Retail for row 1"), {
      target: { value: "19.99" },
    });
    fireEvent.change(screen.getByLabelText("Cost for row 1"), {
      target: { value: "8.50" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit/i }));

    expect(productApiBatchMock).toHaveBeenCalledWith({
      action: "create",
      rows: [
        expect.objectContaining({
          description: "Pierce mug",
          inventory: [
            { locationId: 2, retail: 19.99, cost: 8.5 },
            { locationId: 4, retail: 19.99, cost: 8.5 },
          ],
        }),
      ],
    });
  });

  it("keeps PIER selected even if someone tries to toggle it off", async () => {
    const { NewItemDialog } = await import("@/components/products/new-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: {
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      },
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
      available: true,
    });

    render(
      React.createElement(NewItemDialog, {
        open: true,
        onOpenChange: () => {},
      }),
    );

    fireEvent.click(screen.getByLabelText("PIER"));

    expect(screen.getByLabelText("PIER").getAttribute("aria-checked")).toBe("true");
  });

  it("does not re-enter a reset loop when closed dialog props rerender with the same scope", async () => {
    const { NewItemDialog } = await import("@/components/products/new-item-dialog");
    const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

    vi.mocked(useProductRefDirectory).mockReturnValue({
      refs: {
        vendors: [],
        dccs: [],
        taxTypes: [],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [],
      },
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
      available: true,
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { rerender } = render(
        React.createElement(NewItemDialog, {
          open: false,
          onOpenChange: () => {},
          locationIds: [3, 4],
          primaryLocationId: 3,
        }),
      );

      rerender(
        React.createElement(NewItemDialog, {
          open: false,
          onOpenChange: () => {},
          locationIds: [3, 4],
          primaryLocationId: 3,
        }),
      );
      rerender(
        React.createElement(NewItemDialog, {
          open: false,
          onOpenChange: () => {},
          locationIds: [3, 4],
          primaryLocationId: 3,
        }),
      );

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Maximum update depth exceeded"),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
