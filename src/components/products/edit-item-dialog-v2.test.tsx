import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductEditDetails } from "@/domains/product/types";
import { EditItemDialogV2 } from "./edit-item-dialog-v2";

const productApiMocks = vi.hoisted(() => ({
  update: vi.fn(),
  batch: vi.fn(),
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: productApiMocks,
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useProductRefDirectory: vi.fn(),
}));

const baseDetail: ProductEditDetails = {
  sku: 1001,
  itemType: "general_merchandise",
  description: "Pierce Hoodie",
  barcode: "123456789012",
  vendorId: 21,
  dccId: 1313290,
  itemTaxTypeId: 4,
  catalogNumber: "HD-1001",
  comment: "Front window",
  retail: 39.99,
  cost: 19.5,
  fDiscontinue: 0,
  altVendorId: 22,
  mfgId: 88,
  weight: 1.25,
  packageType: "EA",
  unitsPerPack: 1,
  orderIncrement: 2,
  imageUrl: "https://cdn.example.test/hoodie.png",
  size: "L",
  sizeId: 9,
  colorId: 2,
  styleId: 5,
  itemSeasonCodeId: 12,
  fListPriceFlag: true,
  fPerishable: false,
  fIdRequired: true,
  minOrderQtyItem: 3,
  usedDccId: 1802,
  inventoryByLocation: [
    {
      locationId: 2,
      locationAbbrev: "PIER",
      retail: 39.99,
      cost: 19.5,
      expectedCost: null,
      stockOnHand: 12,
      lastSaleDate: null,
      tagTypeId: null,
      statusCodeId: null,
      estSales: null,
      estSalesLocked: false,
      fInvListPriceFlag: false,
      fTxWantListFlag: false,
      fTxBuybackListFlag: false,
      fNoReturns: false,
    },
    {
      locationId: 3,
      locationAbbrev: "PCOP",
      retail: null,
      cost: null,
      expectedCost: null,
      stockOnHand: null,
      lastSaleDate: null,
      tagTypeId: null,
      statusCodeId: null,
      estSales: null,
      estSalesLocked: false,
      fInvListPriceFlag: false,
      fTxWantListFlag: false,
      fTxBuybackListFlag: false,
      fNoReturns: false,
    },
    {
      locationId: 4,
      locationAbbrev: "PFS",
      retail: null,
      cost: null,
      expectedCost: null,
      stockOnHand: null,
      lastSaleDate: null,
      tagTypeId: null,
      statusCodeId: null,
      estSales: null,
      estSalesLocked: false,
      fInvListPriceFlag: false,
      fTxWantListFlag: false,
      fTxBuybackListFlag: false,
      fNoReturns: false,
    },
  ],
};

function buildTextbookDetail(): ProductEditDetails {
  return {
    ...baseDetail,
    itemType: "textbook",
    description: "Intro Biology",
    author: "Jane Doe",
    title: "Intro Biology",
    isbn: "9781234567890",
    edition: "3",
    bindingId: 15,
    imprint: "PEARSON",
    copyright: "26",
    textStatusId: 7,
    statusDate: "2026-04-20",
    bookKey: "BK-1001",
  };
}

async function mockDirectoryState(overrides: Partial<ReturnType<typeof import("@/domains/product/vendor-directory")["useProductRefDirectory"]>> = {}) {
  const { useProductRefDirectory } = await import("@/domains/product/vendor-directory");

  vi.mocked(useProductRefDirectory).mockReturnValue({
    refs: {
      vendors: [
        { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
        { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
      ],
      dccs: [
        { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
        { dccId: 1802, deptNum: 222000, classNum: null, catNum: null, deptName: "USED DCC", className: null, catName: null, pierceItems: 10 },
      ],
      taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
      tagTypes: [],
      statusCodes: [],
      packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 25 }],
      colors: [{ colorId: 2, label: "BLACK", pierceItems: 18 }],
      bindings: [],
    },
    lookups: {
      vendorNames: new Map([
        [21, "PENS ETC (3001795)"],
        [22, "ALT VENDOR"],
      ]),
      taxTypeLabels: new Map([[4, "STATE"]]),
      tagTypeLabels: new Map(),
      statusCodeLabels: new Map(),
      packageTypeLabels: new Map([["EA", "Each"]]),
      colorLabels: new Map([[2, "BLACK"]]),
      bindingLabels: new Map(),
    },
    vendors: [
      { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
      { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
    ],
    byId: new Map<number, string>([
      [21, "PENS ETC (3001795)"],
      [22, "ALT VENDOR"],
    ]),
    loading: false,
    available: true,
    ...overrides,
  });
}

describe("EditItemDialogV2", () => {
  it("renders the phase 4 GM tabs with label-backed selects and no textbook-only fields", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={baseDetail}
      />,
    );

    expect(screen.getByRole("tab", { name: "Primary" })).toBeInTheDocument();
    // Phase 2: More and Advanced are now in-place disclosures inside Primary.
    expect(screen.getByRole("button", { name: /More\b/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Advanced\b/i })).toBeInTheDocument();

    expect(screen.getByLabelText("Vendor")).toBeInTheDocument();
    expect(screen.getByLabelText("Department / Class")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax Type")).toBeInTheDocument();

    expect(screen.queryByLabelText(/Author/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ISBN/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Binding/i)).not.toBeInTheDocument();
  });

  it("renders textbook-aware primary fields and a Textbook tab for single textbook items", async () => {
    await mockDirectoryState({
      refs: {
        vendors: [
          { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
          { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
        ],
        dccs: [
          { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
          { dccId: 1802, deptNum: 222000, classNum: null, catNum: null, deptName: "USED DCC", className: null, catName: null, pierceItems: 10 },
        ],
        taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 25 }],
        colors: [],
        bindings: [
          { bindingId: 15, label: "Hardcover", pierceBooks: 12 },
          { bindingId: 16, label: "Paperback", pierceBooks: 8 },
        ],
      },
      lookups: {
        vendorNames: new Map([
          [21, "PENS ETC (3001795)"],
          [22, "ALT VENDOR"],
        ]),
        taxTypeLabels: new Map([[4, "STATE"]]),
        tagTypeLabels: new Map(),
        statusCodeLabels: new Map(),
        packageTypeLabels: new Map([["EA", "Each"]]),
        colorLabels: new Map(),
        bindingLabels: new Map([
          [15, "Hardcover"],
          [16, "Paperback"],
        ]),
      },
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
            isTextbook: true,
          },
        ]}
        detail={buildTextbookDetail()}
      />,
    );

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Author")).toBeInTheDocument();
    expect(screen.getByLabelText("ISBN")).toBeInTheDocument();
    expect(screen.getByLabelText("Edition")).toBeInTheDocument();
    expect(screen.getByLabelText("Binding")).toBeInTheDocument();
    expect(screen.getByLabelText("Barcode")).toBeInTheDocument();
    expect(screen.getByLabelText("Vendor")).toBeInTheDocument();
    expect(screen.getByLabelText("Department / Class")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax Type")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Textbook" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Textbook" }));
    expect(screen.getByLabelText("Imprint")).toBeInTheDocument();
    expect(screen.getByLabelText("Copyright")).toBeInTheDocument();
    expect(screen.getByLabelText("Text Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Status Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Book Key")).toBeInTheDocument();
  });

  it("preserves the current binding value when binding refs are unavailable", async () => {
    await mockDirectoryState({
      refs: null,
      loading: false,
      available: false,
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
            isTextbook: true,
          },
        ]}
        detail={buildTextbookDetail()}
      />,
    );

    // Trigger displays the fallback label for an unresolved binding id.
    // (Portal content may also render the same label — we pin to the trigger
    // explicitly to avoid coupling the assertion to Base UI's portal-mount
    // behavior, which can differ based on component identity stability.)
    const selectValue = document.querySelector('[data-slot="select-value"]');
    expect(selectValue).not.toBeNull();
    expect(selectValue?.textContent).toContain("Binding #15");
  });

  it("shows the inventory tab for a single GM item and reveals PCOP inventory values", async () => {
    await mockDirectoryState({
      refs: {
        vendors: [
          { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
          { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
        ],
        dccs: [
          { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
          { dccId: 1802, deptNum: 222000, classNum: null, catNum: null, deptName: "USED DCC", className: null, catName: null, pierceItems: 10 },
        ],
        taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
        tagTypes: [
          { tagTypeId: 7, label: "CLEARANCE", subsystem: 1, pierceRows: 3 },
          { tagTypeId: 8, label: "PROMO", subsystem: 1, pierceRows: 4 },
        ],
        statusCodes: [
          { statusCodeId: 11, label: "ACTIVE", pierceRows: 7 },
          { statusCodeId: 12, label: "HOLD", pierceRows: 2 },
        ],
        packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 25 }],
        colors: [{ colorId: 2, label: "BLACK", pierceItems: 18 }],
        bindings: [],
      },
      lookups: {
        vendorNames: new Map([
          [21, "PENS ETC (3001795)"],
          [22, "ALT VENDOR"],
        ]),
        taxTypeLabels: new Map([[4, "STATE"]]),
        tagTypeLabels: new Map([
          [7, "CLEARANCE"],
          [8, "PROMO"],
        ]),
        statusCodeLabels: new Map([
          [11, "ACTIVE"],
          [12, "HOLD"],
        ]),
        packageTypeLabels: new Map([["EA", "Each"]]),
        colorLabels: new Map([[2, "BLACK"]]),
        bindingLabels: new Map(),
      },
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={{
          ...baseDetail,
          inventoryByLocation: [
            baseDetail.inventoryByLocation[0],
            {
              ...baseDetail.inventoryByLocation[1],
              retail: 42.5,
              cost: 21.25,
              expectedCost: 20.5,
              stockOnHand: 8,
              lastSaleDate: "2026-04-15",
              tagTypeId: 7,
              statusCodeId: 11,
              estSales: 13,
              estSalesLocked: true,
              fInvListPriceFlag: true,
              fTxWantListFlag: false,
              fTxBuybackListFlag: true,
              fNoReturns: false,
            },
            baseDetail.inventoryByLocation[2],
          ],
        }}
      />,
    );

    expect(screen.getByRole("tab", { name: "Inventory" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    await userEvent.click(screen.getByRole("button", { name: "PCOP" }));

    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(42.5);
    expect(screen.getByLabelText(/^Cost(\s|$)/)).toHaveValue(21.25);
  });

  it("copies the active retail value to PIER and PFS from PCOP", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={{
          ...baseDetail,
          inventoryByLocation: [
            {
              ...baseDetail.inventoryByLocation[0],
              retail: 39.99,
              cost: 19.5,
            },
            {
              ...baseDetail.inventoryByLocation[1],
              retail: 42.5,
              cost: 21.25,
            },
            {
              ...baseDetail.inventoryByLocation[2],
              retail: 18,
              cost: 9,
            },
          ],
        }}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    await userEvent.click(screen.getByRole("button", { name: "PCOP" }));

    const retailInput = screen.getByLabelText(/^Retail(\s|$)/);
    await userEvent.clear(retailInput);
    await userEvent.type(retailInput, "55.5");

    await userEvent.click(screen.getByRole("button", { name: "Copy retail to other locations" }));
    await userEvent.click(screen.getByRole("button", { name: "PIER" }));
    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(55.5);

    await userEvent.click(screen.getByRole("button", { name: "PFS" }));
    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(55.5);
  });

  it("shows the refs-unavailable alert while keeping the form visible", async () => {
    await mockDirectoryState({
      refs: null,
      vendors: [],
      byId: new Map(),
      loading: false,
      available: false,
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={baseDetail}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Reference data is unavailable right now");
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("shows a loading state for single-item hydration and sparse-edit guidance in bulk mode", async () => {
    await mockDirectoryState();

    const { rerender } = render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "Pending",
          },
        ]}
        detail={null}
        detailLoading
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading item details");

    rerender(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "One",
          },
          {
            sku: 1002,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "Two",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Fields left blank won't be changed/i)).toBeInTheDocument();
  });

  it("shows a persistent selected-item summary for multi-item edits", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: "111222333444",
            retail: 19.99,
            cost: 9.5,
            fDiscontinue: 0,
            description: "Pierce Hoodie",
          },
          {
            sku: 1002,
            barcode: "555666777888",
            retail: 29.99,
            cost: 12.5,
            fDiscontinue: 0,
            description: "Pierce Mug",
            isTextbook: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("Selected items")).toBeInTheDocument();
    expect(screen.getByText("2 items will receive the same shared field updates.")).toBeInTheDocument();
    expect(screen.getByText("SKU 1001")).toBeInTheDocument();
    expect(screen.getByText("Pierce Hoodie")).toBeInTheDocument();
    expect(screen.getByText("111222333444")).toBeInTheDocument();
    expect(screen.getByText("SKU 1002")).toBeInTheDocument();
    expect(screen.getByText("Pierce Mug")).toBeInTheDocument();
    expect(screen.getByText("Textbook")).toBeInTheDocument();
  });

  it("does not clobber in-progress edits when detail hydration finishes", async () => {
    await mockDirectoryState();
    const user = userEvent.setup();

    const { rerender } = render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "Pending description",
          },
        ]}
        detail={null}
        detailLoading
      />,
    );

    const description = screen.getByLabelText("Description");
    await user.clear(description);
    await user.type(description, "User typed description");

    rerender(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "Pending description",
          },
        ]}
        detail={baseDetail}
        detailLoading={false}
      />,
    );

    expect(screen.getByLabelText("Description")).toHaveValue("User typed description");
    expect(screen.getByLabelText("Barcode")).toHaveValue(baseDetail.barcode);
  });

  it("hydrates inventory state when detail finishes loading after the dialog opens", async () => {
    await mockDirectoryState({
      refs: {
        vendors: [
          { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
          { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
        ],
        dccs: [
          { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
          { dccId: 1802, deptNum: 222000, classNum: null, catNum: null, deptName: "USED DCC", className: null, catName: null, pierceItems: 10 },
        ],
        taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
        tagTypes: [{ tagTypeId: 7, label: "CLEARANCE", subsystem: 1, pierceRows: 3 }],
        statusCodes: [{ statusCodeId: 11, label: "ACTIVE", pierceRows: 7 }],
        packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 25 }],
        colors: [{ colorId: 2, label: "BLACK", pierceItems: 18 }],
        bindings: [],
      },
      lookups: {
        vendorNames: new Map([
          [21, "PENS ETC (3001795)"],
          [22, "ALT VENDOR"],
        ]),
        taxTypeLabels: new Map([[4, "STATE"]]),
        tagTypeLabels: new Map([[7, "CLEARANCE"]]),
        statusCodeLabels: new Map([[11, "ACTIVE"]]),
        packageTypeLabels: new Map([["EA", "Each"]]),
        colorLabels: new Map([[2, "BLACK"]]),
        bindingLabels: new Map(),
      },
    });
    const user = userEvent.setup();

    const { rerender } = render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "Pending description",
          },
        ]}
        detail={null}
        detailLoading
      />,
    );

    rerender(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={{
          ...baseDetail,
          inventoryByLocation: [
            baseDetail.inventoryByLocation[0],
            {
              ...baseDetail.inventoryByLocation[1],
              retail: 42.5,
              cost: 21.25,
              expectedCost: 20.5,
              tagTypeId: 7,
              statusCodeId: 11,
            },
            baseDetail.inventoryByLocation[2],
          ],
        }}
        detailLoading={false}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Inventory" }));
    await user.click(screen.getByRole("button", { name: "PCOP" }));

    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(42.5);
    expect(screen.getByLabelText(/^Cost(\s|$)/)).toHaveValue(21.25);
  });

  it("does not clobber in-progress inventory edits when detail hydration finishes", async () => {
    await mockDirectoryState();
    const user = userEvent.setup();

    const { rerender } = render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: null,
            retail: 0,
            cost: 0,
            fDiscontinue: 0,
            description: "Pending description",
          },
        ]}
        detail={null}
        detailLoading
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Inventory" }));
    await user.click(screen.getByRole("button", { name: "PCOP" }));

    const retailInput = screen.getByLabelText(/^Retail(\s|$)/);
    await user.clear(retailInput);
    await user.type(retailInput, "55.5");

    rerender(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={{
          ...baseDetail,
          inventoryByLocation: [
            baseDetail.inventoryByLocation[0],
            {
              ...baseDetail.inventoryByLocation[1],
              retail: 42.5,
              cost: 21.25,
            },
            baseDetail.inventoryByLocation[2],
          ],
        }}
        detailLoading={false}
      />,
    );

    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(55.5);
    expect(screen.getByLabelText(/^Cost(\s|$)/)).toHaveValue(21.25);
  });

  it("keeps current ref-backed IDs visible when refs are unavailable", async () => {
    await mockDirectoryState({
      refs: null,
      vendors: [],
      byId: new Map(),
      loading: false,
      available: false,
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
            vendorId: baseDetail.vendorId ?? undefined,
            dccId: baseDetail.dccId ?? undefined,
            itemTaxTypeId: baseDetail.itemTaxTypeId ?? undefined,
          },
        ]}
        detail={baseDetail}
      />,
    );

    expect(screen.getByLabelText("Vendor")).toHaveTextContent("21");
    expect(screen.getByLabelText("Department / Class")).toHaveTextContent("1313290");
    expect(screen.getByLabelText("Tax Type")).toHaveTextContent("4");
  });

  it("uses the scoped primary location for Primary retail/cost and persists clears as null inventory patches", async () => {
    await mockDirectoryState({
      refs: {
        vendors: [
          { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
          { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
        ],
        dccs: [
          { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
          { dccId: 1802, deptNum: 222000, classNum: null, catNum: null, deptName: "USED DCC", className: null, catName: null, pierceItems: 10 },
        ],
        taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
        tagTypes: [{ tagTypeId: 7, label: "CLEARANCE", subsystem: 1, pierceRows: 3 }],
        statusCodes: [{ statusCodeId: 11, label: "ACTIVE", pierceRows: 7 }],
        packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 25 }],
        colors: [{ colorId: 2, label: "BLACK", pierceItems: 18 }],
        bindings: [],
      },
      lookups: {
        vendorNames: new Map([
          [21, "PENS ETC (3001795)"],
          [22, "ALT VENDOR"],
        ]),
        taxTypeLabels: new Map([[4, "STATE"]]),
        tagTypeLabels: new Map([[7, "CLEARANCE"]]),
        statusCodeLabels: new Map([[11, "ACTIVE"]]),
        packageTypeLabels: new Map([["EA", "Each"]]),
        colorLabels: new Map([[2, "BLACK"]]),
        bindingLabels: new Map(),
      },
    });
    productApiMocks.update.mockResolvedValue({ sku: 1001, appliedFields: [] });
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={{
          ...baseDetail,
          inventoryByLocation: [
            {
              ...baseDetail.inventoryByLocation[0],
              retail: 39.99,
              cost: 19.5,
            },
            {
              ...baseDetail.inventoryByLocation[1],
              retail: 42.5,
              cost: 21.25,
              tagTypeId: 7,
              statusCodeId: 11,
            },
            baseDetail.inventoryByLocation[2],
          ],
        }}
        locationIds={[3, 4]}
        primaryLocationId={3}
      />,
    );

    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(42.5);
    expect(screen.getByLabelText(/^Cost(\s|$)/)).toHaveValue(21.25);

    await user.clear(screen.getByLabelText(/^Retail(\s|$)/));
    await user.clear(screen.getByLabelText(/^Cost(\s|$)/));

    await user.click(screen.getByRole("tab", { name: "Inventory" }));

    await user.click(screen.getByLabelText("Tag Type"));
    await user.click(screen.getAllByText("Clear selection")[0]);

    await user.click(screen.getByLabelText("Status Code"));
    await user.click(screen.getAllByText("Clear selection")[1]);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // Concurrency baseline sends the PIER snapshot (retail 39.99, cost
    // 19.5) even though the dialog was opened with `primaryLocationId={3}`
    // (PCOP). This matches the server's concurrency check in
    // `prism-updates.ts`, which hard-codes `PIERCE_LOCATION_ID = 2` in its
    // SELECT, so sending a PCOP baseline would produce false 409s.
    // Aligning both sides on a primary-location-aware baseline requires
    // a coordinated server + client change — tracked as a follow-up.
    expect(productApiMocks.update).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({
        mode: "v2",
        baseline: {
          sku: 1001,
          barcode: baseDetail.barcode,
          retail: 39.99,
          cost: 19.5,
          fDiscontinue: baseDetail.fDiscontinue,
        },
        patch: {
          inventory: [
            {
              locationId: 3,
              retail: null,
              cost: null,
              tagTypeId: null,
              statusCodeId: null,
            },
          ],
        },
      }),
    );
  });

  it("shows blank primary retail/cost when the scoped primary location has no values", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={baseDetail}
        locationIds={[4]}
        primaryLocationId={4}
      />,
    );

    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveValue(null);
    expect(screen.getByLabelText(/^Cost(\s|$)/)).toHaveValue(null);
  });

  it("keeps a pristine single-item dialog on the no-op save path", async () => {
    await mockDirectoryState();
    productApiMocks.update.mockClear();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={onOpenChange}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={baseDetail}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(productApiMocks.update).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends expanded More and Advanced fields through the V2 item and GM buckets", async () => {
    await mockDirectoryState();
    productApiMocks.update.mockResolvedValue({ sku: 1001, appliedFields: [] });
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={baseDetail}
      />,
    );

    await user.click(screen.getByRole("button", { name: /More\b/i }));
    await user.clear(screen.getByLabelText("Manufacturer ID"));
    await user.type(screen.getByLabelText("Manufacturer ID"), "91");
    await user.clear(screen.getByLabelText("Size"));
    await user.type(screen.getByLabelText("Size"), "XL");
    await user.clear(screen.getByLabelText("Style ID"));
    await user.type(screen.getByLabelText("Style ID"), "44");
    await user.clear(screen.getByLabelText("Season Code"));
    await user.type(screen.getByLabelText("Season Code"), "77");
    await user.clear(screen.getByLabelText("Order Increment"));
    await user.type(screen.getByLabelText("Order Increment"), "6");

    await user.click(screen.getByRole("button", { name: /Advanced\b/i }));
    await user.click(screen.getByLabelText("Perishable"));
    // With Accordion now keepMounted, multiple Select triggers render their
    // "Enabled" selected-value text simultaneously. Target the actual open
    // dropdown option by role instead of matching the plain text.
    const enabledOption = screen.getAllByRole("option", { name: "Enabled" }).at(-1);
    expect(enabledOption).not.toBeUndefined();
    await user.click(enabledOption!);
    await user.clear(screen.getByLabelText("Min Order Qty"));
    await user.type(screen.getByLabelText("Min Order Qty"), "5");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(productApiMocks.update).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({
        mode: "v2",
        patch: expect.objectContaining({
          item: expect.objectContaining({
            styleId: 44,
            itemSeasonCodeId: 77,
            fPerishable: true,
            minOrderQtyItem: 5,
          }),
          gm: expect.objectContaining({
            mfgId: 91,
            size: "XL",
            orderIncrement: 6,
          }),
        }),
      }),
    );
  });

  it("applies bulk edits sequentially per-row with v2 patch + baseline for 409 concurrency", async () => {
    // Bulk save must (a) NOT lose 409 optimistic-concurrency protection and
    // (b) minimize partial-commit damage on failure. Sequential per-row v2
    // PATCH with stop-on-first-error: every row carries its own baseline,
    // and any failure halts the remainder instead of scattershot-applying.
    await mockDirectoryState();
    productApiMocks.update.mockClear();
    productApiMocks.update.mockResolvedValue({ sku: 0, appliedFields: [] });
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: "111222333444",
            retail: 19.99,
            cost: 9.5,
            fDiscontinue: 0,
            description: "Pierce Hoodie",
          },
          {
            sku: 1002,
            barcode: "555666777888",
            retail: 29.99,
            cost: 12.5,
            fDiscontinue: 0,
            description: "Pierce Mug",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /More\b/i }));
    await user.type(screen.getByLabelText("Order Increment"), "3");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(productApiMocks.update).toHaveBeenCalledTimes(2);
    expect(productApiMocks.update).toHaveBeenNthCalledWith(
      1,
      1001,
      expect.objectContaining({
        mode: "v2",
        patch: expect.objectContaining({
          gm: expect.objectContaining({ orderIncrement: 3 }),
        }),
        baseline: expect.objectContaining({
          sku: 1001,
          barcode: "111222333444",
          retail: 19.99,
          cost: 9.5,
          fDiscontinue: 0,
        }),
      }),
    );
    expect(productApiMocks.update).toHaveBeenNthCalledWith(
      2,
      1002,
      expect.objectContaining({
        mode: "v2",
        patch: expect.objectContaining({
          gm: expect.objectContaining({ orderIncrement: 3 }),
        }),
        baseline: expect.objectContaining({
          sku: 1002,
          barcode: "555666777888",
          retail: 29.99,
          cost: 12.5,
          fDiscontinue: 0,
        }),
      }),
    );
  });

  it("stops on the first bulk-save failure, never attempts later rows, and reports partial progress", async () => {
    // Core guarantee: if row 2 of 3 fails, row 3 must NEVER be called. This
    // caps the blast radius to a single mid-flight row and gives the
    // operator a precise "saved N of M" summary so they can retry.
    await mockDirectoryState();
    productApiMocks.update.mockClear();
    productApiMocks.update
      .mockResolvedValueOnce({ sku: 1001, appliedFields: [] })
      .mockRejectedValueOnce(new Error("Invalid vendor"));
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        items={[
          { sku: 1001, barcode: "a", retail: 1, cost: 1, fDiscontinue: 0, description: "A" },
          { sku: 1002, barcode: "b", retail: 2, cost: 2, fDiscontinue: 0, description: "B" },
          { sku: 1003, barcode: "c", retail: 3, cost: 3, fDiscontinue: 0, description: "C" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /More\b/i }));
    await user.type(screen.getByLabelText("Order Increment"), "5");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // Exactly TWO calls: row 1 (success) + row 2 (failure). Row 3 never
    // reached, so stale data there cannot be overwritten.
    expect(productApiMocks.update).toHaveBeenCalledTimes(2);
    expect(productApiMocks.update).toHaveBeenNthCalledWith(1, 1001, expect.anything());
    expect(productApiMocks.update).toHaveBeenNthCalledWith(2, 1002, expect.anything());

    // `onSaved` must NOT fire on partial failure. The products page wires
    // `onSaved` to `setEditOpen(false) + refetch()`, so invoking it here
    // would dismiss the dialog and hide the error summary before the
    // operator sees it. A dedicated `onPartialSaved` callback is tracked
    // as a follow-up; for now we keep the dialog open with the summary.
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    const error = await screen.findByRole("alert");
    expect(error.textContent ?? "").toMatch(/Saved 1 of 3/);
    expect(error.textContent ?? "").toMatch(/Row 2.*SKU 1002/);
    expect(error.textContent ?? "").toMatch(/Invalid vendor/);
    expect(error.textContent ?? "").toMatch(/1 row not attempted/);
    // Retry guidance points the operator at the recovery path — close +
    // reopen, because the dialog's `detail` snapshot is now stale for
    // the already-committed row.
    expect(error.textContent ?? "").toMatch(/Close and reopen/i);

    // Save is disabled post-partial-commit so an in-place retry cannot
    // resend the stale baseline for row 1 (which would trip a false 409).
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    expect(saveButton).toBeDisabled();
  });

  it("re-enables Save when the dialog closes and reopens with the same selection after a partial commit", async () => {
    // The bulkPartialCommit guard must NOT persist across dialog open/close
    // cycles — reopening rehydrates `detail` via editContext so the
    // baseline is fresh and retry is safe again.
    await mockDirectoryState();
    productApiMocks.update.mockClear();
    productApiMocks.update
      .mockResolvedValueOnce({ sku: 1001, appliedFields: [] })
      .mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const items = [
      { sku: 1001, barcode: "a", retail: 1, cost: 1, fDiscontinue: 0, description: "A" },
      { sku: 1002, barcode: "b", retail: 2, cost: 2, fDiscontinue: 0, description: "B" },
    ];

    const { rerender } = render(
      <EditItemDialogV2 open onOpenChange={onOpenChange} items={items} />,
    );

    await user.click(screen.getByRole("button", { name: /More\b/i }));
    await user.type(screen.getByLabelText("Order Increment"), "9");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    // Simulate close + reopen (as a user would after seeing the error).
    rerender(<EditItemDialogV2 open={false} onOpenChange={onOpenChange} items={items} />);
    rerender(<EditItemDialogV2 open onOpenChange={onOpenChange} items={items} />);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("propagates a 409 CONCURRENT_MODIFICATION error from the first failing bulk row", async () => {
    // The per-row `baseline` must still trigger the 409 concurrency path on
    // the server; the hotfix's sequential loop preserves that protection
    // exactly where the prior `productApi.batch` switch would have lost it.
    await mockDirectoryState();
    productApiMocks.update.mockClear();
    const concurrencyError = Object.assign(new Error("CONCURRENT_MODIFICATION"), {
      code: "CONCURRENT_MODIFICATION",
      current: { retail: 99 },
    });
    productApiMocks.update.mockRejectedValueOnce(concurrencyError);
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          { sku: 1001, barcode: "a", retail: 1, cost: 1, fDiscontinue: 0, description: "A" },
          { sku: 1002, barcode: "b", retail: 2, cost: 2, fDiscontinue: 0, description: "B" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /More\b/i }));
    await user.type(screen.getByLabelText("Order Increment"), "7");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // Single attempt, second row never touched.
    expect(productApiMocks.update).toHaveBeenCalledTimes(1);
    const error = await screen.findByRole("alert");
    expect(error.textContent ?? "").toMatch(/CONCURRENT_MODIFICATION/);
    expect(error.textContent ?? "").toMatch(/Saved 0 of 2/);
  });

  it("sends changed textbook fields through the v2 textbook bucket", async () => {
    await mockDirectoryState({
      refs: {
        vendors: [
          { vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 },
          { vendorId: 22, name: "ALT VENDOR", pierceItems: 5 },
        ],
        dccs: [
          { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
          { dccId: 1802, deptNum: 222000, classNum: null, catNum: null, deptName: "USED DCC", className: null, catName: null, pierceItems: 10 },
        ],
        taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 25 }],
        colors: [],
        bindings: [
          { bindingId: 15, label: "Hardcover", pierceBooks: 12 },
          { bindingId: 16, label: "Paperback", pierceBooks: 8 },
        ],
      },
      lookups: {
        vendorNames: new Map([
          [21, "PENS ETC (3001795)"],
          [22, "ALT VENDOR"],
        ]),
        taxTypeLabels: new Map([[4, "STATE"]]),
        tagTypeLabels: new Map(),
        statusCodeLabels: new Map(),
        packageTypeLabels: new Map([["EA", "Each"]]),
        colorLabels: new Map(),
        bindingLabels: new Map([
          [15, "Hardcover"],
          [16, "Paperback"],
        ]),
      },
    });
    productApiMocks.update.mockResolvedValue({ sku: 1001, appliedFields: [] });
    const user = userEvent.setup();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
            isTextbook: true,
          },
        ]}
        detail={buildTextbookDetail()}
      />,
    );

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Updated title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(productApiMocks.update).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({
        mode: "v2",
        patch: expect.objectContaining({
          textbook: expect.objectContaining({
            title: "Updated title",
          }),
        }),
      }),
    );
  });

  it("constrains textbook text status to positive integers in the UI", async () => {
    await mockDirectoryState({
      refs: {
        vendors: [{ vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 50 }],
        dccs: [
          { dccId: 1313290, deptNum: 111010, classNum: null, catNum: null, deptName: "NOT USE=111010", className: "DO NOT USE", catName: null, pierceItems: 30 },
        ],
        taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 40 }],
        tagTypes: [],
        statusCodes: [],
        packageTypes: [],
        colors: [],
        bindings: [{ bindingId: 15, label: "Hardcover", pierceBooks: 12 }],
      },
      lookups: {
        vendorNames: new Map([[21, "PENS ETC (3001795)"]]),
        taxTypeLabels: new Map([[4, "STATE"]]),
        tagTypeLabels: new Map(),
        statusCodeLabels: new Map(),
        packageTypeLabels: new Map(),
        colorLabels: new Map(),
        bindingLabels: new Map([[15, "Hardcover"]]),
      },
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
            isTextbook: true,
          },
        ]}
        detail={buildTextbookDetail()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Textbook" }));
    expect(screen.getByLabelText("Text Status")).toHaveAttribute("min", "1");
  });

  // --- Phase 2 visual polish ------------------------------------------------

  it("keeps internal phase notes out of the dialog's user-facing copy", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent ?? "").not.toMatch(/Phase \d/);
    expect(dialog.textContent ?? "").not.toMatch(/V2 patch contract/i);
    expect(dialog.textContent ?? "").not.toMatch(/parity-only/i);
  });

  it("renders money inputs with tabular-nums and the barcode with font-mono for legibility", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText(/^Retail(\s|$)/)).toHaveClass("tabular-nums");
    expect(screen.getByLabelText(/^Cost(\s|$)/)).toHaveClass("tabular-nums");
    expect(screen.getByLabelText("Barcode")).toHaveClass("font-mono");
  });

  it("shows a Textbook mode badge and a Primary-location subtitle in the header for a single textbook", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
            isTextbook: true,
          },
        ]}
        detail={buildTextbookDetail()}
      />,
    );

    const header = screen.getByRole("dialog").querySelector('[data-slot="dialog-header"]');
    expect(header?.textContent ?? "").toContain("Textbook");
    expect(header?.textContent ?? "").toMatch(/Primary location[:\s]+PIER/i);
  });

  it("shows a Bulk scope badge when editing multiple items and no location subtitle in bulk mode", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
          {
            sku: 1002,
            barcode: "9998887770001",
            retail: 5.25,
            cost: 2.1,
            fDiscontinue: 0,
            description: "Second item",
          },
        ]}
      />,
    );

    const header = screen.getByRole("dialog").querySelector('[data-slot="dialog-header"]');
    expect(header?.textContent ?? "").toContain("Bulk");
    // Bulk mode edits all selected items per-row; a single primary location
    // does not apply. The subtitle should be absent.
    expect(header?.textContent ?? "").not.toMatch(/Primary location/i);
  });

  it("suffixes the Primary retail/cost labels with the active primary location", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText(/Retail\s*\(PIER\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cost\s*\(PIER\)/)).toBeInTheDocument();
  });

  it("drops More and Advanced from the tab list and exposes them as in-place disclosures inside Primary", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
      />,
    );

    // Tab list: Primary + Inventory only (no More, no Advanced).
    expect(screen.queryByRole("tab", { name: "More" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Advanced" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Inventory" })).toBeInTheDocument();

    // Disclosures are present in the Primary tab as accordion triggers.
    expect(
      screen.getByRole("button", { name: /More\b.*packaging/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Advanced\b.*flags/i }),
    ).toBeInTheDocument();
  });

  it("shows a mixed-selection warning in bulk mode when Textbook + GM items are selected together", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: "GM item",
          },
          {
            sku: 2002,
            barcode: "9781234567890",
            retail: 80,
            cost: 40,
            fDiscontinue: 0,
            description: "Textbook item",
            isTextbook: true,
          },
        ]}
      />,
    );

    const warning = screen.getByRole("status");
    expect(warning).toBeInTheDocument();
    expect(warning.textContent ?? "").toMatch(/mixed selection/i);
    expect(warning.textContent ?? "").toMatch(/textbook/i);
  });

  it("does not show the mixed-selection warning in a homogeneous bulk (all GM)", async () => {
    await mockDirectoryState();

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: "First GM",
          },
          {
            sku: 1002,
            barcode: "9998887770001",
            retail: 5.25,
            cost: 2.1,
            fDiscontinue: 0,
            description: "Second GM",
          },
        ]}
      />,
    );

    expect(screen.queryByText(/mixed selection/i)).toBeNull();
  });

  it("shows a per-field 'labels unavailable' hint beneath each ref-backed select when refs are down", async () => {
    await mockDirectoryState({
      refs: null,
      loading: false,
      available: false,
    });

    render(
      <EditItemDialogV2
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 1001,
            barcode: baseDetail.barcode,
            retail: 42.5,
            cost: 21.25,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
      />,
    );

    // Three ref-backed selects in the GM Primary: Vendor, Department/Class,
    // Tax Type. Each should render the muted hint.
    const hints = screen.getAllByText(/connect to Prism/i);
    expect(hints.length).toBeGreaterThanOrEqual(3);
  });
});
