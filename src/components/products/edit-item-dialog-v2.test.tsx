import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductEditDetails } from "@/domains/product/types";
import { EditItemDialogV2 } from "./edit-item-dialog-v2";

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
};

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
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
            fDiscontinue: baseDetail.fDiscontinue,
            description: baseDetail.description ?? undefined,
          },
        ]}
        detail={baseDetail}
      />,
    );

    expect(screen.getByRole("tab", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Advanced" })).toBeInTheDocument();

    expect(screen.getByLabelText("Vendor")).toBeInTheDocument();
    expect(screen.getByLabelText("Department / Class")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax Type")).toBeInTheDocument();

    expect(screen.queryByLabelText(/Author/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ISBN/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Binding/i)).not.toBeInTheDocument();
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
            retail: baseDetail.retail ?? 0,
            cost: baseDetail.cost ?? 0,
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
});
